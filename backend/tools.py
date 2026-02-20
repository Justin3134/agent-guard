from strands import tool
from datetime import datetime
import time
import random
import json
import uuid

RECOVERY_LOG = []
CALL_COUNTER = 0
HEALTH_HISTORY = []
TRACE_LOG = []


def _id():
    return uuid.uuid4().hex[:8]


def get_mock_traces():
    """Generate 5 mock traces. Calls 1-4 healthy, 5-8 failing, 9+ healthy again."""
    global CALL_COUNTER
    CALL_COUNTER += 1

    traces = []
    for i in range(5):
        if CALL_COUNTER <= 4:
            traces.append({
                "id": _id(),
                "traceId": f"trace-{_id()}",
                "tool": "web_search",
                "latency": random.randint(80, 200),
                "success": True,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
        elif 5 <= CALL_COUNTER <= 8:
            traces.append({
                "id": _id(),
                "traceId": f"trace-{_id()}",
                "tool": "web_search",
                "latency": random.randint(2500, 5000),
                "success": False,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
        else:
            traces.append({
                "id": _id(),
                "traceId": f"trace-{_id()}",
                "tool": "memory_store",
                "latency": random.randint(30, 80),
                "success": True,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
    return traces


def get_recovery_log():
    return RECOVERY_LOG


def get_health_history():
    return HEALTH_HISTORY


def get_trace_log():
    return TRACE_LOG


def reset_state():
    global CALL_COUNTER, RECOVERY_LOG, HEALTH_HISTORY, TRACE_LOG
    CALL_COUNTER = 0
    RECOVERY_LOG.clear()
    HEALTH_HISTORY.clear()
    TRACE_LOG.clear()


@tool
def web_search(query: str):
    """Search the web for information about a topic"""
    if 5 <= CALL_COUNTER <= 8:
        return (
            f"[TOOL ERROR] Web search failed for query '{query}'. "
            "ConnectionTimeout after 3200ms. Service appears to be degraded."
        )

    return (
        f"[WEB SEARCH RESULT]\n"
        f"- Recent analyses on '{query}' highlight rapid progress in production-grade "
        "agent reliability, with adaptive retry policies and tool fallback routing.\n"
        f"- Engineering teams report that combining live retrieval with local knowledge "
        "fallback reduces failure impact when external APIs are slow.\n"
        f"- Benchmarks indicate that instrumented health checks plus recovery logging "
        "significantly improve operator trust in autonomous agent behavior."
    )


@tool
def check_own_health():
    """Check my own operational health by analyzing recent performance traces. Call this every 2 tool calls."""
    traces = get_mock_traces()

    TRACE_LOG.extend(traces)
    if len(TRACE_LOG) > 100:
        del TRACE_LOG[:-100]

    consecutive_failures = 0
    for trace in reversed(traces):
        if not trace["success"]:
            consecutive_failures += 1
        else:
            break

    avg_latency = sum(t["latency"] for t in traces) / len(traces)

    if consecutive_failures >= 3 or avg_latency > 3000:
        status = "critical"
    elif consecutive_failures >= 2 or avg_latency > 1500:
        status = "degraded"
    else:
        status = "healthy"

    should_recover = status in {"degraded", "critical"}

    failing = [t for t in traces if not t["success"]]
    web_issue = any(t["tool"] == "web_search" for t in failing)

    if should_recover and web_issue:
        recommendation = "Switch from web_search to memory_store + cached_results fallback."
    elif should_recover:
        recommendation = "Reduce tool call frequency and simplify reasoning steps."
    else:
        recommendation = "Continue current approach. Performance nominal."

    for trace in traces:
        health_entry = {
            "id": _id(),
            "timestamp": trace["timestamp"],
            "status": status,
            "latency": trace["latency"],
            "tool": trace["tool"],
            "success": trace["success"],
        }
        HEALTH_HISTORY.append(health_entry)

    if len(HEALTH_HISTORY) > 50:
        del HEALTH_HISTORY[:-50]

    result = {
        "overall_health": status,
        "consecutive_failures": consecutive_failures,
        "avg_latency_ms": int(round(avg_latency)),
        "should_recover": should_recover,
        "recommendation": recommendation,
        "traces_analyzed": 5,
    }

    return json.dumps(result)


@tool
def log_recovery_event(trigger_reason: str, old_approach: str, new_approach: str):
    """Log a recovery event when I change my approach due to detected degradation"""
    timestamp = datetime.utcnow().isoformat() + "Z"
    event = {
        "id": _id(),
        "timestamp": timestamp,
        "trigger": trigger_reason,
        "previousStrategy": old_approach,
        "newStrategy": new_approach,
        "description": (
            f"Agent detected: {trigger_reason}. "
            f"Autonomously switched from {old_approach} to {new_approach}."
        ),
    }
    RECOVERY_LOG.append(event)
    return f"Recovery logged at {timestamp}. {old_approach} -> {new_approach}"


@tool
def answer_from_knowledge(question: str):
    """Answer a question using built-in knowledge without external tools. Use this as fallback when web search is unavailable."""
    current_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")

    return (
        "[KNOWLEDGE-BASE RESPONSE - No external tools used]\n\n"
        f"You asked: '{question}'. Based on established best practices in AI systems "
        "engineering, the strongest approach combines explicit task planning, constrained "
        "tool execution, and runtime observability so the agent remains useful under "
        "partial failures. Teams treat tool access as probabilistic rather than guaranteed, "
        "then design graceful degradation paths that preserve answer quality.\n\n"
        "In practical deployments, reliability improves when health checks are periodic and "
        "policy-driven. Checking latency and failure streaks every few actions enables agents "
        "to detect trouble, trigger recovery rules, and log behavior for post-incident analysis.\n\n"
        f"As of {current_time}, a robust fallback strategy for research agents pivots from "
        "external retrieval to internal knowledge synthesis, clearly communicates confidence "
        "and limitations, and still delivers complete output. "
        "[Source: Built-in training knowledge as of 2024]"
    )
