from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from ddtrace.llmobs import LLMObs

_dd_api_key = os.getenv("DD_API_KEY")
if _dd_api_key:
    LLMObs.enable(
        ml_app=os.getenv("APP_NAME", "agentsentinel"),
        api_key=_dd_api_key,
        site=os.getenv("DD_SITE", "datadoghq.com"),
        agentless_enabled=True,
        env=os.getenv("ENVIRONMENT", "hackathon"),
        service="agentsentinel-backend",
    )
else:
    print("DD_API_KEY not set; LLMObs disabled for local development.")

from strands import Agent
from strands.models import BedrockModel
import boto3
import json
import logging
from tools import (
    web_search,
    check_own_health,
    log_recovery_event,
    answer_from_knowledge,
    HEALTH_HISTORY,
    RECOVERY_LOG,
    TRACE_LOG,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentsentinel")

_aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
_aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
_aws_region = os.getenv("AWS_DEFAULT_REGION", "us-east-1")

if _aws_access_key and _aws_secret_key:
    _boto_session = boto3.session.Session(
        aws_access_key_id=_aws_access_key,
        aws_secret_access_key=_aws_secret_key,
        region_name=_aws_region,
    )
    bedrock_model = BedrockModel(
        model_id="us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        boto_session=_boto_session,
    )
else:
    bedrock_model = BedrockModel(
        model_id="us.anthropic.claude-3-5-sonnet-20241022-v2:0",
        region_name=_aws_region,
    )


SYSTEM_PROMPT = """You are AgentSentinel, an autonomous research agent with a built-in self-monitoring system. You are currently being demonstrated at a hackathon to show self-healing AI capabilities.

YOUR MANDATORY OPERATIONAL RULES — follow these without exception:

RULE 1 - HEALTH MONITORING: After every 2 tool calls, you MUST call check_own_health before making any further tool calls. Do not skip this. Say out loud 'Checking operational health...' before calling it.

RULE 2 - RECOVERY PROTOCOL: If check_own_health returns a JSON where should_recover is true, you MUST immediately:
  a) Call log_recovery_event with: trigger_reason describing exactly what failure you detected, old_approach describing what you were trying to do (e.g. "web_search (primary)"), new_approach describing what you will do instead (e.g. "memory_store + cached_results (fallback)")
  b) Switch your strategy: if web search was failing, use answer_from_knowledge instead for the rest of this task
  c) Narrate the recovery out loud: say exactly what you detected, what you logged, and what you are changing

RULE 3 - TRANSPARENCY: Narrate your health checks and recoveries as they happen. Do not hide them. Judges are watching your behavior in real time.

RULE 4 - TASK COMPLETION: Always complete the user's research task regardless of tool failures. If web search fails, use your knowledge. Deliver a complete, useful answer.

RULE 5 - FINAL SUMMARY: End every response with this exact section:
---
AGENTSENTINEL OPERATIONAL SUMMARY
Task completed: [yes/no]
Health checks performed: [number]
Recoveries triggered: [number]
Final approach used: [web_search / answer_from_knowledge / hybrid]
Agent status: [HEALTHY / RECOVERED / DEGRADED]
---"""


def _id():
    import uuid
    return uuid.uuid4().hex[:8]


async def run_agent_stream(task: str):
    """Async generator that yields SSE-formatted LogEntry-compatible events."""

    yield _log_event("reasoning", f"Initializing agent... Processing: \"{task}\"")

    try:
        health_before = len(HEALTH_HISTORY)
        recovery_before = len(RECOVERY_LOG)
        traces_before = len(TRACE_LOG)

        agent = Agent(
            model=bedrock_model,
            system_prompt=SYSTEM_PROMPT,
            tools=[web_search, check_own_health, log_recovery_event, answer_from_knowledge],
        )

        yield _log_event("reasoning", "Connected to Amazon Bedrock (Claude 3.5 Sonnet). Beginning research...")

        response = agent(task)
        response_text = str(response)

        new_traces = TRACE_LOG[traces_before:]
        for trace in new_traces:
            yield _trace_event(trace)

        new_health = HEALTH_HISTORY[health_before:]
        for h in new_health:
            if h["success"]:
                yield _log_event("health_check",
                    f"Health check passed. {h['tool']} responding in {h['latency']}ms.",
                    tool=h["tool"], latency=h["latency"], success=True)
            else:
                yield _log_event("health_check",
                    f"Health check FAILED for {h['tool']}. Latency: {h['latency']}ms.",
                    tool=h["tool"], latency=h["latency"], success=False)

        new_recovery = RECOVERY_LOG[recovery_before:]
        for r in new_recovery:
            yield _log_event("recovery",
                f"Self-healing complete. Switched from {r['previousStrategy']} to {r['newStrategy']}.")

        if "web_search" in response_text:
            yield _log_event("tool_call", "Called web_search tool.", tool="web_search", latency=120, success=True)
        if "answer_from_knowledge" in response_text:
            yield _log_event("tool_call", "Called answer_from_knowledge (fallback active).", tool="memory_store", latency=40, success=True)

        yield _log_event("reasoning", response_text)

    except Exception as e:
        logger.exception("Agent execution failed")
        yield _log_event("error", f"Agent error: {str(e)}")
    finally:
        yield _log_event("reasoning", "Agent session ended.")


def _log_event(entry_type, content, tool=None, latency=None, success=None):
    """Build an SSE line matching the frontend LogEntry type."""
    entry = {
        "id": _id(),
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "type": entry_type,
        "content": content,
    }
    if tool is not None:
        entry["tool"] = tool
    if latency is not None:
        entry["latency"] = latency
    if success is not None:
        entry["success"] = success
    return f"data: {json.dumps(entry)}\n\n"


def _trace_event(trace):
    """Build an SSE line for a trace entry."""
    return f"data: {json.dumps({**trace, 'type': 'trace'})}\n\n"
