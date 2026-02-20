"""
demo_customer_agent.py

Simulates a customer's existing CrewAI research agent connecting to AgentSentinel.
Uses raw HTTP POST calls — no SDK import needed. Just the requests library.

Run AFTER starting the AgentSentinel backend:
    cd backend && source venv/bin/activate && python main.py

Then in another terminal:
    cd backend && source venv/bin/activate && python demo_customer_agent.py

Open http://localhost:8080 in your browser to see the dashboard update live.
"""

import time
import sys
import requests

API = "http://localhost:8000"


def post(path, body):
    return requests.post(f"{API}{path}", json=body, timeout=10)


def get(path):
    return requests.get(f"{API}{path}", timeout=10)


def send_tool_event(session_id, agent_name, tool_name, call_number, duration_ms, success, error=None):
    event = {
        "event_id": f"evt_{int(time.time() * 1000)}",
        "event_type": "tool_result" if success else "tool_error",
        "agent_name": agent_name,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "data": {
            "tool_name": tool_name,
            "call_number": call_number,
            "duration_ms": duration_ms,
            "error": error,
        },
        "duration_ms": duration_ms,
        "success": success,
        "error_message": error,
        "session_id": session_id,
    }
    post("/api/agent-event", event)


def send_health_check_event(session_id, agent_name, call_number):
    event = {
        "event_id": f"evt_{int(time.time() * 1000)}",
        "event_type": "health_check",
        "agent_name": agent_name,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "data": {"call_number": call_number, "action": "health_check"},
        "success": True,
        "session_id": session_id,
    }
    post("/api/agent-event", event)


def run():
    agent_name = "Acme Corp Research Agent"
    framework = "crewai"

    print()
    print("=" * 56)
    print("   ACME CORP RESEARCH AGENT")
    print("   Connecting to AgentSentinel...")
    print("=" * 56)
    print()

    # ── Step 1: Register ─────────────────────────────────
    resp = post("/api/register-agent", {
        "agent_name": agent_name,
        "framework": framework,
        "session_id": "will_be_replaced",
        "on_failure": "pause",
    })
    data = resp.json()
    session_id = data["session_id"]
    print(f"  ✓ Registered with AgentSentinel (session: {session_id})")
    print(f"  ✓ Framework: {framework}")
    print(f"  ✓ Failure mode: pause + request approval")
    print()
    print("  Task: Compare Cursor, Windsurf, GitHub Copilot, Replit")
    print("  ─" * 28)
    print()

    # ── Step 2: Tool call sequence ────────────────────────
    # Call 1 — SUCCESS
    print("  [1/7] web_search(\"Cursor IDE pricing 2025\")")
    time.sleep(0.34)
    send_tool_event(session_id, agent_name, "web_search", 1, 340, True)
    print("        ✅ 340ms — Cursor Pro $20/mo, Tab completion, codebase context")
    print()
    time.sleep(0.8)

    # Call 2 — SUCCESS
    print("  [2/7] web_search(\"Windsurf IDE features\")")
    time.sleep(0.29)
    send_tool_event(session_id, agent_name, "web_search", 2, 290, True)
    print("        ✅ 290ms — Windsurf $15/mo, Cascade multi-file editing")
    print()
    time.sleep(0.5)

    # Health check after 2 calls
    print("  [Health Check] Analyzing Datadog traces...")
    send_health_check_event(session_id, agent_name, 2)
    health = get(f"/api/agent-health/{session_id}").json()
    print(f"  [Health Check] Status: {health.get('overall_health', 'unknown').upper()}")
    print()
    time.sleep(1.0)

    # Call 3 — FAIL
    print("  [3/7] web_search(\"GitHub Copilot enterprise\")")
    time.sleep(1.2)
    send_tool_event(session_id, agent_name, "web_search", 3, 7200, False, error="RateLimitError 429")
    print("        ❌ 7200ms — RateLimitError 429")
    print()
    time.sleep(0.8)

    # Call 4 — FAIL
    print("  [4/7] web_search(\"GitHub Copilot pricing\")")
    time.sleep(1.5)
    send_tool_event(session_id, agent_name, "web_search", 4, 8100, False, error="RateLimitError 429")
    print("        ❌ 8100ms — RateLimitError 429")
    print()
    time.sleep(0.5)

    # Health check after calls 3-4
    print("  [Health Check] Analyzing Datadog traces...")
    send_health_check_event(session_id, agent_name, 4)
    health = get(f"/api/agent-health/{session_id}").json()
    status = health.get("overall_health", "unknown").upper()
    print(f"  [Health Check] Status: {status} — consecutive failures: {health.get('consecutive_failures', 0)}")
    print()
    time.sleep(1.0)

    # Call 5 — FAIL
    print("  [5/7] web_search(\"Replit AI features\")")
    time.sleep(1.8)
    send_tool_event(session_id, agent_name, "web_search", 5, 9400, False, error="RateLimitError 429")
    print("        ❌ 9400ms — RateLimitError 429")
    print()
    time.sleep(0.5)

    # ── Step 3: Request approval ──────────────────────────
    print("  ╔══════════════════════════════════════════════╗")
    print("  ║  ⚠️  3 CONSECUTIVE FAILURES DETECTED         ║")
    print("  ║  Agent requesting human approval...          ║")
    print("  ╚══════════════════════════════════════════════╝")
    print()

    post("/api/request-approval", {
        "session_id": session_id,
        "proposed_fix": (
            "web_search API is rate limited with 3 consecutive failures "
            "averaging 8,233ms latency. Recommend switching to built-in "
            "knowledge base for remaining research on GitHub Copilot and "
            "Replit. Estimated completion: 2 more steps using answer_from_knowledge."
        ),
        "failure_context": {
            "failed_tool": "web_search",
            "consecutive_failures": 3,
            "avg_latency_ms": 8233,
            "completed_steps": 2,
            "remaining_steps": 2,
            "error": "RateLimitError 429",
        },
    })

    # ── Step 4: Wait for approval ─────────────────────────
    print("  ⏸️  Agent paused. Waiting for approval on dashboard...")
    print("  → Open http://localhost:8080 and check the right panel")
    print()
    sys.stdout.write("  Waiting ")
    sys.stdout.flush()

    dots = 0
    start = time.time()
    decision = None

    while time.time() - start < 120:
        resp = get(f"/api/approval-status/{session_id}")
        data = resp.json()

        if data.get("decision") in ("approved", "declined", "manual"):
            decision = data
            break

        dots += 1
        sys.stdout.write(".")
        sys.stdout.flush()
        time.sleep(1)

    print()
    print()

    if decision is None:
        decision = {"decision": "declined", "reason": "timeout"}

    verdict = decision.get("decision", "unknown")

    # ── Step 5: Handle decision ───────────────────────────
    if verdict == "approved":
        print("  ✅ APPROVED — continuing with answer_from_knowledge")
        print()
        time.sleep(0.5)

        # Call 6 — answer_from_knowledge SUCCESS
        print("  [6/7] answer_from_knowledge(\"GitHub Copilot pricing\")")
        time.sleep(0.15)
        send_tool_event(session_id, agent_name, "answer_from_knowledge", 6, 150, True)
        print("        ✅ 150ms — Copilot $10/mo individual, $19/mo business")
        print()
        time.sleep(0.8)

        # Call 7 — answer_from_knowledge SUCCESS
        print("  [7/7] answer_from_knowledge(\"Replit AI features\")")
        time.sleep(0.15)
        send_tool_event(session_id, agent_name, "answer_from_knowledge", 7, 150, True)
        print("        ✅ 150ms — Replit $25/mo, browser-based, best for beginners")
        print()
        time.sleep(0.5)

        print("  ─" * 28)
        print("  RESEARCH OUTPUT:")
        print()
        print("  1. Cursor    — $20/mo  — Best: codebase-aware Tab completion")
        print("  2. Windsurf  — $15/mo  — Best: Cascade multi-file editing")
        print("  3. Copilot   — $10/mo  — Best: broadest IDE support")
        print("  4. Replit    — $25/mo  — Best: zero-setup browser IDE")
        print()
        print("  Ranking: Cursor > Copilot > Windsurf > Replit (for pro devs)")
        resolution = "approved"

    elif verdict == "manual":
        custom_fix = decision.get("custom_fix", "")
        print(f"  ✏️  CUSTOM FIX: {custom_fix}")
        print()
        time.sleep(0.5)

        print("  [6/7] Executing custom fix...")
        time.sleep(0.15)
        send_tool_event(session_id, agent_name, "custom_step", 6, 200, True)
        print("        ✅ 200ms")
        print()

        print("  [7/7] Completing task with custom approach...")
        time.sleep(0.15)
        send_tool_event(session_id, agent_name, "custom_step", 7, 180, True)
        print("        ✅ 180ms")
        resolution = "manual"

    else:
        print("  ❌ DECLINED — agent stopped. User taking over.")
        resolution = "declined"

    # ── Step 6: Complete event ────────────────────────────
    post("/api/agent-event", {
        "event_id": f"evt_{int(time.time() * 1000)}",
        "event_type": "complete",
        "agent_name": agent_name,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "data": {"result": "AI coding tool comparison complete"},
        "success": True,
        "session_id": session_id,
    })

    # ── Step 7: Summary ──────────────────────────────────
    total_calls = 7 if verdict in ("approved", "manual") else 5
    print()
    print("  ═" * 28)
    print("  DEMO COMPLETE")
    print(f"  Agent: {agent_name}")
    print("  Task: AI coding tool comparison")
    print(f"  Tool calls made: {total_calls}")
    print("  Failures detected: 3")
    print(f"  Resolution: {resolution}")
    print("  Check dashboard: http://localhost:8080")
    print("  ═" * 28)
    print()


if __name__ == "__main__":
    run()
