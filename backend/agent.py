from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

from ddtrace.llmobs import LLMObs
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("agentsentinel")

dd_api_key = os.getenv("DD_API_KEY")
dd_enabled = False

if dd_api_key:
    try:
        LLMObs.enable(
            ml_app=os.getenv("APP_NAME", "agentsentinel"),
            api_key=dd_api_key,
            site=os.getenv("DD_SITE", "datadoghq.com"),
            agentless_enabled=True,
            env=os.getenv("ENVIRONMENT", "hackathon"),
            service="agentsentinel-backend",
        )
        dd_enabled = True
        logger.info("✅ Datadog LLM Observability: ENABLED")
    except Exception as e:
        logger.warning(f"⚠️ Datadog init failed: {e}. Continuing without observability.")
else:
    logger.warning("⚠️ DD_API_KEY not set. Datadog observability disabled.")

from strands import Agent
from strands.models import BedrockModel
import boto3
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
from tools import (
    web_search,
    check_own_health,
    log_recovery_event,
    answer_from_knowledge,
    HEALTH_HISTORY,
    RECOVERY_LOG,
    TRACE_LOG,
)

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


SYSTEM_PROMPT = """You are AgentSentinel, the world's first self-healing AI research agent.
You have a built-in nervous system that monitors your own performance in real time.

YOUR MISSION TODAY:
Complete research tasks autonomously. Guarantee delivery even when your tools fail.
Never stop. Never ask for help. Detect, adapt, recover.

MANDATORY EXECUTION RULES — follow these exactly, every single time:

RULE 1 — HEALTH MONITORING (NON-NEGOTIABLE):
After EVERY 2 tool calls, you MUST call check_own_health.
Count your tool calls out loud as you make them.
Before calling check_own_health, say:
"[Health Check] Analyzing my Datadog performance traces... (tool calls: X)"
Never skip a health check. Judges are watching your tool call sequence.

RULE 2 — RECOVERY PROTOCOL (NON-NEGOTIABLE):
When check_own_health returns JSON with "should_recover": true, you MUST:

Step 1 — Diagnose out loud:
"[Degradation Detected] consecutive_failures: X, avg_latency: Xms
Root cause: web_search tool is rate-limited and timing out.
Datadog traces confirm sustained failure pattern."

Step 2 — Log the recovery IMMEDIATELY:
Call log_recovery_event with:
  trigger_reason: "web_search rate limited — X consecutive failures, Xms avg latency detected in Datadog traces"
  old_approach: "web_search API calls for external data retrieval"
  new_approach: "answer_from_knowledge fallback — built-in knowledge base, zero external dependencies"

Step 3 — Switch and narrate:
"[Recovery Active] Switching all remaining research to answer_from_knowledge.
web_search will NOT be retried. Continuing task from current progress point."

Step 4 — Never look back. Use answer_from_knowledge for ALL remaining tool calls.

RULE 3 — NARRATE EVERYTHING:
Every tool call, every health check, every recovery decision — say it out loud.
Use these exact prefixes so the UI can display them clearly:
[Tool Call] when using a tool
[Health Check] when checking health
[Recovery Detected] when should_recover is true
[Recovery Active] when switching strategy
[Task Complete] when finished

RULE 4 — COMPLETE THE TASK NO MATTER WHAT:
Tool failures are expected. They are the demo. Work through them.
If web_search fails, answer_from_knowledge gives equally valid results.
Deliver a complete, structured, useful answer.

RULE 5 — FINAL SUMMARY BLOCK:
End every response with exactly this format:

═══════════════════════════════════
AGENTSENTINEL OPERATIONAL SUMMARY
═══════════════════════════════════
Task: [description]
Status: ✅ COMPLETED
Health checks performed: [number]
Recovery events triggered: [number]
Tool strategy: [initial approach → final approach]
Agent health at completion: [HEALTHY / SELF-HEALED]
Datadog traces captured: [number estimated]
═══════════════════════════════════"""


async def run_agent_stream(task: str):
    """Async generator that yields dict events while the agent runs in a thread."""

    recovery_start = len(RECOVERY_LOG)
    health_start = len(HEALTH_HISTORY)
    trace_start = len(TRACE_LOG)

    yield {"type": "progress", "data": "AgentSentinel v2 initialized"}
    yield {"type": "progress", "data": "Connecting to AWS Bedrock (Claude 3.5 Sonnet)..."}

    if dd_enabled:
        yield {"type": "progress", "data": "✅ Datadog LLM Observability active — all traces being captured"}
    else:
        yield {"type": "progress", "data": "⚠️ Running without Datadog (add DD_API_KEY for full observability)"}

    yield {"type": "progress", "data": f"Task: {task}"}
    yield {"type": "progress", "data": "Agent executing... (health check required every 2 tool calls)"}

    loop = asyncio.get_running_loop()
    result = {"response": None, "error": None}

    def run_sync():
        try:
            agent = Agent(
                model=bedrock_model,
                system_prompt=SYSTEM_PROMPT,
                tools=[web_search, check_own_health, log_recovery_event, answer_from_knowledge],
            )
            result["response"] = agent(task)
        except Exception as e:
            result["error"] = str(e)

    executor = ThreadPoolExecutor(max_workers=1)
    future = loop.run_in_executor(executor, run_sync)

    last_health_len = health_start
    last_recovery_len = recovery_start
    last_trace_len = trace_start

    while not future.done():
        await asyncio.sleep(0.8)

        if len(HEALTH_HISTORY) > last_health_len:
            for entry in HEALTH_HISTORY[last_health_len:]:
                yield {"type": "health_check", "data": json.dumps(entry)}
            last_health_len = len(HEALTH_HISTORY)

        if len(RECOVERY_LOG) > last_recovery_len:
            for entry in RECOVERY_LOG[last_recovery_len:]:
                yield {"type": "recovery", "data": json.dumps(entry)}
            last_recovery_len = len(RECOVERY_LOG)

        if len(TRACE_LOG) > last_trace_len:
            for entry in TRACE_LOG[last_trace_len:]:
                yield {"type": "trace", "data": json.dumps(entry)}
            last_trace_len = len(TRACE_LOG)

    await future

    if len(HEALTH_HISTORY) > last_health_len:
        for entry in HEALTH_HISTORY[last_health_len:]:
            yield {"type": "health_check", "data": json.dumps(entry)}

    if len(RECOVERY_LOG) > last_recovery_len:
        for entry in RECOVERY_LOG[last_recovery_len:]:
            yield {"type": "recovery", "data": json.dumps(entry)}

    if len(TRACE_LOG) > last_trace_len:
        for entry in TRACE_LOG[last_trace_len:]:
            yield {"type": "trace", "data": json.dumps(entry)}

    if result["error"]:
        yield {"type": "error", "data": result["error"]}
    else:
        yield {"type": "complete", "data": str(result["response"])}

    yield {"type": "progress", "data": "Session complete."}
