import { useState, useEffect } from "react";

const API_BASE = "http://localhost:8000";

interface RegisteredAgent {
  agent_name: string;
  framework: string;
  session_id: string;
  health: string;
  event_count: number;
  on_failure: string;
  registered_at: string;
}

interface PendingApproval {
  pending: boolean;
  session_id?: string;
  agent_name?: string;
  proposed_fix?: string;
  failure_context?: Record<string, any>;
  requested_at?: string;
}

type TabId = "connected" | "integrate" | "approval";

const CODE_DECORATOR = `from sentinel_sdk import monitor

@monitor(
    agent_name="My Research Agent",
    framework="langchain",
    on_failure="pause"
)
def run_my_agent(task: str) -> str:
    result = my_existing_agent.run(task)
    return result

# That's it — AgentSentinel is now monitoring
result = run_my_agent("Research AI companies")`;

const CODE_MANUAL = `from sentinel_sdk import connect

sentinel = connect("My Agent", framework="crewai")

# Before each tool call:
tracker = sentinel.track_tool_call("web_search", {"query": "AI"})
try:
    result = web_search("AI")
    sentinel.track_tool_result(tracker, result)
except Exception as e:
    sentinel.track_tool_result(tracker, None, error=str(e))

# Every 2 calls — check health + approval flow:
health = sentinel.check_health()
if health["should_recover"]:
    decision = sentinel.wait_for_approval(
        proposed_fix=health["proposed_fix"],
        failure_context=health
    )
    # decision["decision"] is "approved", "declined", or "manual"

sentinel.complete(final_result)`;

const CODE_STRANDS = `from sentinel_sdk import wrap_strands_agent
from strands import Agent
from strands.models import BedrockModel

agent = Agent(
    model=BedrockModel(model_id="..."),
    tools=[web_search, calculator]
)

# Wrap it — one line
monitored = wrap_strands_agent(agent, agent_name="My Agent")

# Use exactly like before
result = monitored("Research task here")`;

function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mb-6">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <div className="relative rounded-lg border border-gray-800 bg-gray-950 overflow-hidden">
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 text-[10px] font-mono px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors z-10"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <pre className="p-4 pr-20 overflow-x-auto text-sm font-mono leading-relaxed text-gray-300 whitespace-pre">
          {code}
        </pre>
      </div>
    </div>
  );
}

export default function AgentConnector() {
  const [registeredAgents, setRegisteredAgents] = useState<RegisteredAgent[]>([]);
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [manualFix, setManualFix] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("connected");

  useEffect(() => {
    const fetchAgents = () => {
      fetch(`${API_BASE}/api/registered-agents`)
        .then((r) => r.json())
        .then((data) => setRegisteredAgents(data))
        .catch(() => {});
    };
    fetchAgents();
    const interval = setInterval(fetchAgents, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchApproval = () => {
      fetch(`${API_BASE}/api/pending-approval`)
        .then((r) => r.json())
        .then((data) => {
          if (data.pending) {
            setPendingApproval(data);
            setActiveTab("approval");
          } else {
            setPendingApproval(null);
          }
        })
        .catch(() => {});
    };
    fetchApproval();
    const interval = setInterval(fetchApproval, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDecision = async (decision: string, customFix?: string) => {
    if (!pendingApproval?.session_id) return;
    try {
      await fetch(`${API_BASE}/api/approve-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: pendingApproval.session_id,
          decision,
          custom_fix: customFix || null,
        }),
      });
      setPendingApproval(null);
      setShowManualInput(false);
      setManualFix("");
      setActiveTab("connected");
    } catch {}
  };

  const healthDot = (h: string) => {
    if (h === "critical") return "bg-red-500";
    if (h === "degraded") return "bg-yellow-500";
    return "bg-green-500";
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "connected", label: "Connected Agents" },
    { id: "integrate", label: "Integrate Your Agent" },
  ];

  if (pendingApproval) {
    tabs.push({ id: "approval", label: "⚡ Approval Required" });
  }

  return (
    <div className="rounded-lg border border-border bg-surface-1 overflow-hidden">
      <div className="flex items-center border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground/70"
            } ${tab.id === "approval" ? "animate-pulse text-red-400" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* ─── TAB 1: Connected Agents ─── */}
        {activeTab === "connected" && (
          <div>
            {registeredAgents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground/50 italic">
                  No agents connected yet
                </p>
                <p className="text-xs text-muted-foreground/30 mt-1">
                  Use the Integration tab to connect your first agent
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {registeredAgents.map((agent) => (
                  <div
                    key={agent.session_id}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${healthDot(agent.health)}`} />
                      <div>
                        <span className="text-sm font-semibold text-foreground">
                          {agent.agent_name}
                        </span>
                        <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground/60">
                          {agent.framework}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground/50">
                      <span>{agent.event_count} events</span>
                      <span>{agent.session_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: Integrate Your Agent ─── */}
        {activeTab === "integrate" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Option 1 — Python Decorator (Simplest)
              </h3>
              <p className="text-xs text-muted-foreground/60 mb-3">
                Wrap any Python agent function with one line
              </p>
              <CopyBlock code={CODE_DECORATOR} label="pip install agentsentinel" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Option 2 — Manual SDK (Full Control)
              </h3>
              <p className="text-xs text-muted-foreground/60 mb-3">
                Track each tool call, check health, handle approvals
              </p>
              <CopyBlock code={CODE_MANUAL} label="Best for custom agent loops" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Option 3 — Strands Native Wrapper
              </h3>
              <p className="text-xs text-muted-foreground/60 mb-3">
                One-line wrap for AWS Strands agents
              </p>
              <CopyBlock code={CODE_STRANDS} label="Best for AWS Bedrock / Strands users" />
            </div>
          </div>
        )}

        {/* ─── TAB 3: Approval Required ─── */}
        {activeTab === "approval" && pendingApproval && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-yellow-400">
                ⚠️ Agent Paused — Your Decision Required
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Agent: {pendingApproval.agent_name || "Unknown"} &middot;{" "}
                <span className="text-muted-foreground/40">
                  Session: {pendingApproval.session_id}
                </span>
              </p>
            </div>

            <div className="rounded-lg border border-red-800 bg-red-950/40 p-4">
              <p className="text-[10px] font-bold tracking-widest text-red-400 mb-2 uppercase">
                FAILURE DETECTED
              </p>
              {pendingApproval.failure_context && (
                <div className="space-y-1 text-sm font-mono">
                  {Object.entries(pendingApproval.failure_context).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-muted-foreground/50 shrink-0">{k}:</span>
                      <span className="text-red-300">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-blue-800 bg-blue-950/40 p-4">
              <p className="text-[10px] font-bold tracking-widest text-blue-400 mb-2 uppercase">
                PROPOSED FIX (by Claude via Bedrock)
              </p>
              <p className="text-sm text-foreground">{pendingApproval.proposed_fix}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleDecision("approved")}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: "#22c55e" }}
              >
                ✅ Approve Fix
              </button>
              <button
                onClick={() => handleDecision("declined")}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: "#ef4444" }}
              >
                ❌ Decline &amp; Stop
              </button>
            </div>

            <div>
              <button
                onClick={() => setShowManualInput(!showManualInput)}
                className="w-full py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                ✏️ Apply Custom Fix Instead
              </button>
              {showManualInput && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={manualFix}
                    onChange={(e) => setManualFix(e.target.value)}
                    placeholder="Describe your custom fix..."
                    rows={3}
                    className="w-full rounded-lg border border-border bg-surface-2 p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 resize-none"
                  />
                  <button
                    onClick={() => handleDecision("manual", manualFix)}
                    disabled={!manualFix.trim()}
                    className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-colors"
                    style={{ backgroundColor: "#8b5cf6" }}
                  >
                    Apply My Fix
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "approval" && !pendingApproval && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground/50 italic">
              No pending approvals
            </p>
            <p className="text-xs text-muted-foreground/30 mt-1">
              When a connected agent detects failure, approval requests appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
