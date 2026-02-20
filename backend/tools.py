from strands import tool
from datetime import datetime
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
    """Generate 5 mock traces. Calls 1-5 healthy, 6-11 failing, 12+ healthy (recovered)."""
    global CALL_COUNTER
    CALL_COUNTER += 1

    traces = []
    for _ in range(5):
        if CALL_COUNTER <= 5:
            traces.append({
                "id": _id(),
                "traceId": f"trace-{_id()}",
                "tool": "web_search",
                "latency": random.randint(120, 280),
                "success": True,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
        elif 6 <= CALL_COUNTER <= 11:
            traces.append({
                "id": _id(),
                "traceId": f"trace-{_id()}",
                "tool": "web_search",
                "latency": random.randint(4500, 8900),
                "success": False,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
        else:
            traces.append({
                "id": _id(),
                "traceId": f"trace-{_id()}",
                "tool": "memory_store",
                "latency": random.randint(90, 200),
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
    global CALL_COUNTER
    CALL_COUNTER = 0
    RECOVERY_LOG.clear()
    HEALTH_HISTORY.clear()
    TRACE_LOG.clear()


@tool
def web_search(query: str):
    """Search the web for information about a topic"""
    global CALL_COUNTER
    if 6 <= CALL_COUNTER <= 11:
        return (
            f"[TOOL FAILURE ❌] web_search('{query}')\n"
            "Status: 429 Rate Limited\n"
            "Error: Too many requests to search API. Retry-After: 60 seconds.\n"
            "Attempts: 3/3 exhausted\n"
            "This tool is now unavailable."
        )

    q = query.lower()

    if "cursor" in q:
        return (
            "[WEB SEARCH RESULT] Cursor — AI Code Editor\n"
            "- Pricing: $20/month (Pro), $40/month (Business). Free tier available.\n"
            "- Standout feature: Deep codebase context via tab completion, inline chat, "
            "and Composer for multi-file edits. Built on VS Code fork with native AI integration.\n"
            "- Weakness: Only available as its own editor (VS Code fork) — can't use in other IDEs. "
            "Power users report occasional high latency on large codebases.\n"
            "- Market position: Fastest-growing AI code editor in 2025, popular with professional developers.\n"
            "[Source: cursor.com, G2 reviews, developer surveys 2025]"
        )

    if "windsurf" in q:
        return (
            "[WEB SEARCH RESULT] Windsurf — AI IDE by Codeium\n"
            "- Pricing: $15/month (Pro). Free tier with limited features.\n"
            "- Standout feature: Cascade — multi-file agentic editing that can plan and execute "
            "across an entire codebase. Strong contextual understanding.\n"
            "- Weakness: Newer entrant, smaller community. Plugin ecosystem less mature than VS Code. "
            "Occasional instability in complex refactors.\n"
            "- Market position: Strong challenger, gaining traction with teams doing large refactors.\n"
            "[Source: windsurf.com, TechCrunch, developer forums 2025]"
        )

    if "copilot" in q or "github" in q:
        return (
            "[WEB SEARCH RESULT] GitHub Copilot — AI Pair Programmer\n"
            "- Pricing: $10/month (Individual), $19/month (Business), $39/month (Enterprise).\n"
            "- Standout feature: Broadest IDE support (VS Code, JetBrains, Neovim, Visual Studio). "
            "Microsoft-backed with massive training data. Copilot Chat + Workspace for agentic tasks.\n"
            "- Weakness: Less context-aware than Cursor for large codebases. Completion quality can "
            "be inconsistent. No native multi-file agentic editing.\n"
            "- Market position: Market leader by install base, default choice for enterprise teams.\n"
            "[Source: github.com/copilot, Stack Overflow survey 2025]"
        )

    if "replit" in q:
        return (
            "[WEB SEARCH RESULT] Replit — Browser-Based AI IDE\n"
            "- Pricing: $25/month (Replit Core). Free tier for basic use.\n"
            "- Standout feature: Fully browser-based — zero setup. Replit Agent can build and deploy "
            "entire apps from a prompt. Best onboarding experience for beginners.\n"
            "- Weakness: Limited for large codebases and professional workflows. Performance degrades "
            "with bigger projects. Less IDE customization than desktop editors.\n"
            "- Market position: Dominant in education and rapid prototyping, growing in AI-first dev.\n"
            "[Source: replit.com, ProductHunt, developer reviews 2025]"
        )

    return (
        f"[WEB SEARCH RESULT] Results for '{query}'\n"
        "- The AI coding tools market in 2025 is rapidly evolving with strong competition "
        "between Cursor, Windsurf, GitHub Copilot, and Replit.\n"
        "- Key differentiators: context depth, multi-file editing, IDE flexibility, and pricing.\n"
        "- Enterprise adoption favors Copilot for breadth, Cursor for depth, "
        "Windsurf for refactoring, and Replit for prototyping.\n"
        "[Source: aggregated developer surveys and product comparisons 2025]"
    )


@tool
def check_own_health():
    """Check my own operational health by analyzing recent performance traces. Call this every 2 tool calls."""
    global CALL_COUNTER
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
        recommendation = "Switch from web_search to answer_from_knowledge fallback immediately."
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
    global CALL_COUNTER
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
    global CALL_COUNTER
    current_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    q = question.lower()

    if "cursor" in q:
        return (
            "[KNOWLEDGE-BASE RESPONSE — Cursor]\n"
            "Cursor is a VS Code fork with native AI built in. $20/mo Pro plan.\n"
            "Strengths: Best-in-class codebase context, Tab completion, Composer for multi-file edits.\n"
            "Weaknesses: Locked to their editor, occasional latency on large repos.\n"
            f"[Fallback knowledge as of {current_time}]"
        )

    if "windsurf" in q:
        return (
            "[KNOWLEDGE-BASE RESPONSE — Windsurf]\n"
            "Windsurf by Codeium is an AI IDE at $15/mo. Cascade feature does multi-file agentic edits.\n"
            "Strengths: Excellent for large refactors, strong contextual understanding.\n"
            "Weaknesses: Newer product, smaller ecosystem, occasional instability.\n"
            f"[Fallback knowledge as of {current_time}]"
        )

    if "copilot" in q or "github" in q:
        return (
            "[KNOWLEDGE-BASE RESPONSE — GitHub Copilot]\n"
            "GitHub Copilot is $10/mo individual. Microsoft-backed, broadest IDE support.\n"
            "Strengths: Works in VS Code, JetBrains, Neovim. Massive training data.\n"
            "Weaknesses: Less context-aware than Cursor, inconsistent completions.\n"
            f"[Fallback knowledge as of {current_time}]"
        )

    if "replit" in q:
        return (
            "[KNOWLEDGE-BASE RESPONSE — Replit]\n"
            "Replit is a browser-based IDE at $25/mo. Replit Agent builds full apps from prompts.\n"
            "Strengths: Zero setup, best for beginners and rapid prototyping.\n"
            "Weaknesses: Struggles with large codebases, limited pro workflow features.\n"
            f"[Fallback knowledge as of {current_time}]"
        )

    return (
        "[KNOWLEDGE-BASE RESPONSE]\n\n"
        f"You asked: '{question}'. Based on established knowledge in AI coding tools:\n"
        "The market leaders are Cursor ($20/mo, best context), GitHub Copilot ($10/mo, broadest reach), "
        "Windsurf ($15/mo, best refactoring), and Replit ($25/mo, best for beginners).\n"
        "For professional developers, Cursor and Copilot offer the strongest value proposition. "
        "Windsurf excels at large-scale refactoring. Replit is ideal for prototyping and education.\n"
        f"[Fallback knowledge as of {current_time}]"
    )
