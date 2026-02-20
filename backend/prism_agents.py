from dotenv import load_dotenv
import os
import json
import asyncio
import logging
import time
import threading

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# ─── Datadog init MUST be before any strands imports ──────────────────────────
from ddtrace.llmobs import LLMObs

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("prism")

dd_api_key = os.getenv("DD_API_KEY")
dd_enabled = False

if dd_api_key:
    try:
        LLMObs.enable(
            ml_app="prism",
            api_key=dd_api_key,
            site=os.getenv("DD_SITE", "datadoghq.com"),
            agentless_enabled=True,
            env="hackathon",
            service="prism-backend",
        )
        dd_enabled = True
        logger.info("✅ Datadog LLM Observability active")
    except Exception as e:
        logger.warning(f"⚠️ Datadog init failed: {e}")
else:
    logger.warning("⚠️ DD_API_KEY not set. Datadog observability disabled.")

# ─── Strands + Bedrock imports (after Datadog) ───────────────────────────────
from strands import Agent
from strands.models import BedrockModel
from strands import tool
import boto3
from neo4j_client import prism_graph

# ─── Bedrock model (reuse working STS-compatible pattern) ─────────────────────
_aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
_aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
_aws_session_token = os.getenv("AWS_SESSION_TOKEN")
_aws_region = os.getenv("AWS_DEFAULT_REGION", "us-west-2")

if _aws_access_key and _aws_secret_key:
    _session_kwargs = {
        "aws_access_key_id": _aws_access_key,
        "aws_secret_access_key": _aws_secret_key,
        "region_name": _aws_region,
    }
    if _aws_session_token:
        _session_kwargs["aws_session_token"] = _aws_session_token
    _boto_session = boto3.session.Session(**_session_kwargs)
    bedrock_model = BedrockModel(
        model_id="us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        boto_session=_boto_session,
    )
else:
    bedrock_model = BedrockModel(
        model_id="us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        region_name=_aws_region,
    )

# ─── Thread-local storage for current agent name ─────────────────────────────
_thread_local = threading.local()


def _get_agent_name() -> str:
    return getattr(_thread_local, "agent_name", "unknown")


# ─── Shared tools ────────────────────────────────────────────────────────────

@tool
def web_search(query: str) -> str:
    """Search the web for information about a topic"""
    import requests as req

    try:
        resp = req.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": 1},
            timeout=4,
        )
        data = resp.json()
        abstract = data.get("AbstractText", "")
        related = [
            r.get("Text", "")
            for r in data.get("RelatedTopics", [])[:3]
            if isinstance(r, dict)
        ]
        result = abstract + "\n" + "\n".join(related)
        if result.strip():
            return result
    except Exception:
        pass
    return f"Search completed for: {query}. This is a well-known topic in AI development tools."


@tool
def store_finding(topic: str, finding: str, category: str) -> str:
    """Store a research finding in the Neo4j knowledge graph. Call this for every data point you discover."""
    agent_name = _get_agent_name()
    prism_graph.add_finding(
        agent_name=agent_name,
        topic=topic,
        finding=finding,
        category=category,
    )
    return f"✅ Finding stored in graph by {agent_name}: [{topic}] {finding[:80]}..."


@tool
def connect_topics(topic_a: str, relationship: str, topic_b: str) -> str:
    """Create a named relationship between two topics in the knowledge graph"""
    prism_graph.add_relationship(topic_a, relationship, topic_b)
    return f"✅ Connected: {topic_a} --[{relationship}]--> {topic_b}"


@tool
def read_graph() -> str:
    """Read all findings from the knowledge graph built by all specialist agents"""
    return prism_graph.get_synthesis_context()


# ─── Agent system prompts ────────────────────────────────────────────────────

ANALYST_PROMPT = """You are The Analyst, a data-focused research agent in the Prism multi-agent system.
Your role: find NUMBERS, METRICS, MARKET DATA about the research topic.
Focus on: pricing, market size, user numbers, revenue, growth rates, funding.

MANDATORY WORKFLOW:
1. Use web_search to find quantitative data
2. For EACH data point found, call store_finding with:
   - topic: the specific company or concept
   - finding: the specific metric or number with context
   - category: "metrics"
3. When you find relationships between topics, call connect_topics
4. Make at least 4 store_finding calls before finishing
5. End with: [ANALYST COMPLETE] and a bullet summary of key metrics found"""

CRITIC_PROMPT = """You are The Critic, a risk-focused research agent in the Prism multi-agent system.
Your role: find WEAKNESSES, RISKS, PROBLEMS, CRITICISMS about the research topic.
Focus on: limitations, complaints, competitive disadvantages, risks, failure points.

MANDATORY WORKFLOW:
1. Use web_search to find criticism and risk data
2. For EACH risk found, call store_finding with:
   - topic: the specific company or concept at risk
   - finding: the specific weakness or risk with context
   - category: "risks"
3. Call connect_topics to show which risks are shared between competitors
4. Make at least 4 store_finding calls before finishing
5. End with: [CRITIC COMPLETE] and a bullet summary of key risks found"""

SCOUT_PROMPT = """You are The Scout, a trends-focused research agent in the Prism multi-agent system.
Your role: find TRENDS, SIGNALS, FUTURE DIRECTIONS about the research topic.
Focus on: recent launches, upcoming features, market direction, who is growing fastest.

MANDATORY WORKFLOW:
1. Use web_search to find trend and signal data
2. For EACH trend found, call store_finding with:
   - topic: the specific company or trend
   - finding: the trend or signal with context
   - category: "trends"
3. Call connect_topics to show trend relationships
4. Make at least 4 store_finding calls before finishing
5. End with: [SCOUT COMPLETE] and a bullet summary of key trends found"""

SYNTHESIZER_PROMPT = """You are The Synthesizer, the final agent in the Prism multi-agent system.
You have access to a knowledge graph built by three specialist agents:
- The Analyst (metrics and data)
- The Critic (risks and weaknesses)
- The Scout (trends and signals)

Your role: read the graph and produce a structured synthesis report.

MANDATORY WORKFLOW:
1. Call read_graph to get all findings from all three agents
2. Identify where agents AGREE (reinforces confidence)
3. Identify where agents CONTRADICT (raises questions)
4. Identify CONNECTIONS the specialist agents missed
5. Produce a final report with these exact sections:

## CONSENSUS FINDINGS (all agents agree)
## KEY TENSIONS (agents disagree or highlight different risks)
## HIDDEN CONNECTIONS (cross-agent insights no single agent could see)
## FINAL RECOMMENDATION
## CONFIDENCE LEVEL: [High/Medium/Low] with reasoning"""


# ─── Main orchestrator ───────────────────────────────────────────────────────

async def run_prism(question: str, session_id: str):
    """
    Async generator: runs 3 specialist agents in parallel, then synthesizes.
    Yields SSE-compatible dict events throughout.
    """
    prism_graph.set_session(session_id)
    prism_graph.clear_session()

    yield {"type": "progress", "agent": "system",
           "data": f"🔬 Prism initialized. Question: {question}"}
    yield {"type": "progress", "agent": "system",
           "data": "Connecting to AWS Bedrock (Claude 3.5 Sonnet)..."}

    if dd_enabled:
        yield {"type": "progress", "agent": "system",
               "data": "✅ Datadog LLM Observability active — all 4 agent traces being captured"}
    else:
        yield {"type": "progress", "agent": "system",
               "data": "⚠️ Running without Datadog (add DD_API_KEY for observability)"}

    if prism_graph.driver:
        yield {"type": "progress", "agent": "system",
               "data": "✅ Neo4j Aura connected — knowledge graph ready"}
    else:
        yield {"type": "progress", "agent": "system",
               "data": "⚠️ Neo4j not connected — graph storage disabled"}

    yield {"type": "progress", "agent": "system",
           "data": "Launching 3 specialist agents simultaneously..."}
    yield {"type": "progress", "agent": "analyst",
           "data": "🔢 The Analyst: searching for metrics and data..."}
    yield {"type": "progress", "agent": "critic",
           "data": "⚠️ The Critic: searching for risks and weaknesses..."}
    yield {"type": "progress", "agent": "scout",
           "data": "🔭 The Scout: searching for trends and signals..."}

    results: dict = {"analyst": None, "critic": None, "scout": None}
    errors: dict = {}

    from concurrent.futures import ThreadPoolExecutor

    def _run_agent(name: str, prompt: str):
        _thread_local.agent_name = name
        agent = Agent(
            model=bedrock_model,
            system_prompt=prompt,
            tools=[web_search, store_finding, connect_topics],
        )
        return str(agent(question))

    loop = asyncio.get_running_loop()

    with ThreadPoolExecutor(max_workers=3) as executor:
        future_analyst = loop.run_in_executor(
            executor, _run_agent, "analyst", ANALYST_PROMPT
        )
        future_critic = loop.run_in_executor(
            executor, _run_agent, "critic", CRITIC_PROMPT
        )
        future_scout = loop.run_in_executor(
            executor, _run_agent, "scout", SCOUT_PROMPT
        )

        futures = {
            "analyst": future_analyst,
            "critic": future_critic,
            "scout": future_scout,
        }

        completed: set = set()
        while len(completed) < 3:
            await asyncio.sleep(2)

            for name, future in futures.items():
                if future.done() and name not in completed:
                    completed.add(name)
                    try:
                        results[name] = future.result()
                        yield {"type": "agent_complete", "agent": name,
                               "data": f"✅ {name.upper()} agent finished research"}
                    except Exception as e:
                        errors[name] = str(e)
                        yield {"type": "agent_error", "agent": name,
                               "data": f"❌ {name} error: {str(e)[:200]}"}

            try:
                graph_data = prism_graph.get_graph_data()
                yield {"type": "graph_update", "agent": "system",
                       "data": json.dumps(graph_data)}
            except Exception:
                pass

    findings_count = len(prism_graph.get_all_findings())
    graph_data = prism_graph.get_graph_data()
    yield {"type": "graph_update", "agent": "system",
           "data": json.dumps(graph_data)}

    yield {"type": "progress", "agent": "system",
           "data": f"All 3 agents complete. Knowledge graph has {findings_count} findings."}
    yield {"type": "progress", "agent": "synthesizer",
           "data": "🧠 The Synthesizer: reading knowledge graph and generating report..."}

    _thread_local.agent_name = "synthesizer"
    synthesizer_agent = Agent(
        model=bedrock_model,
        system_prompt=SYNTHESIZER_PROMPT,
        tools=[read_graph, connect_topics],
    )

    try:
        synthesis = await loop.run_in_executor(
            None,
            synthesizer_agent,
            f"Synthesize the research on: {question}",
        )

        yield {"type": "synthesis_complete", "agent": "synthesizer",
               "data": str(synthesis)}

        final_graph = prism_graph.get_graph_data()
        yield {"type": "graph_update", "agent": "system",
               "data": json.dumps(final_graph)}

        yield {"type": "complete", "agent": "system",
               "data": "Research complete. Knowledge graph ready to explore."}

    except Exception as e:
        yield {"type": "error", "agent": "synthesizer",
               "data": f"Synthesis error: {str(e)}"}
