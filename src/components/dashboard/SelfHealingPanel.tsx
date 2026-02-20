import { useState, useEffect } from "react";
import type { RecoveryEvent, HealthCheck } from "@/types/agent";

const API_BASE = "http://localhost:8000";

interface PendingApproval {
  pending: boolean;
  session_id?: string;
  agent_name?: string;
  proposed_fix?: string;
  failure_context?: Record<string, any>;
  requested_at?: string;
}

interface SelfHealingPanelProps {
  recoveryLog: RecoveryEvent[];
  healthHistory: HealthCheck[];
}

export function SelfHealingPanel({ recoveryLog, healthHistory }: SelfHealingPanelProps) {
  const recentChecks = healthHistory.slice(-5).reverse();
  const [pendingApproval, setPendingApproval] = useState<PendingApproval | null>(null);
  const [manualFix, setManualFix] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    const poll = () => {
      fetch(`${API_BASE}/api/pending-approval`)
        .then((r) => r.json())
        .then((data) => {
          if (data.pending) {
            setPendingApproval(data);
          } else {
            setPendingApproval(null);
            setShowManualInput(false);
            setManualFix("");
          }
        })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDecision = async (decision: string, customFix?: string) => {
    if (!pendingApproval?.session_id) return;
    setDeciding(true);
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
    } catch {}
    setDeciding(false);
  };

  if (pendingApproval) {
    return (
      <div className="flex flex-col h-full border-2 border-red-500 animate-pulse rounded-lg">
        <div className="h-10 flex items-center px-4 border-b border-red-500/30 bg-red-950/30 shrink-0">
          <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
            ⚡ Action Required
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-bold text-red-400">⚡ AGENT PAUSED</h2>
            <p className="text-xs text-muted-foreground mt-1">
              {pendingApproval.agent_name || "External Agent"} needs your decision
            </p>
          </div>

          <div className="rounded-lg border border-red-800 bg-red-950/40 p-3">
            <p className="text-[10px] font-bold tracking-widest text-red-400 mb-2 uppercase">
              FAILURE DETECTED
            </p>
            {pendingApproval.failure_context && (
              <div className="space-y-1.5">
                {Object.entries(pendingApproval.failure_context).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-[11px] font-mono">
                    <span className="text-muted-foreground/50 shrink-0">{k}:</span>
                    <span className="text-red-300">{String(v)}{k === "avg_latency_ms" ? "ms" : ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-blue-800 bg-blue-950/40 p-3">
            <p className="text-[10px] font-bold tracking-widest text-blue-400 mb-2 uppercase">
              PROPOSED FIX (by Claude via Bedrock)
            </p>
            <p className="text-xs text-foreground leading-relaxed">
              {pendingApproval.proposed_fix}
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <button
              onClick={() => handleDecision("approved")}
              disabled={deciding}
              className="w-full h-12 rounded-lg text-lg font-bold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#22c55e" }}
            >
              ✅ Approve Fix
            </button>
            <button
              onClick={() => handleDecision("declined")}
              disabled={deciding}
              className="w-full h-12 rounded-lg text-lg font-bold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "#ef4444" }}
            >
              ❌ Decline &amp; Stop
            </button>
            <button
              onClick={() => setShowManualInput(!showManualInput)}
              className="w-full h-10 rounded-lg text-base font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
              style={showManualInput ? { backgroundColor: "rgba(139,92,246,0.15)" } : {}}
            >
              ✏️ Apply Custom Fix Instead
            </button>
            {showManualInput && (
              <div className="space-y-2 pt-1">
                <textarea
                  value={manualFix}
                  onChange={(e) => setManualFix(e.target.value)}
                  placeholder="Describe your custom fix..."
                  rows={3}
                  className="w-full rounded-lg border border-border bg-surface-2 p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/20 resize-none"
                />
                <button
                  onClick={() => handleDecision("manual", manualFix)}
                  disabled={!manualFix.trim() || deciding}
                  className="w-full h-10 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-colors"
                  style={{ backgroundColor: "#8b5cf6" }}
                >
                  Apply My Fix
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 flex items-center justify-between px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recovery</span>
        {recoveryLog.length > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
            {recoveryLog.length} event{recoveryLog.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {recoveryLog.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-xs text-muted-foreground/50 italic">
              🟢 All agents operating normally
            </p>
          </div>
        ) : (
          recoveryLog.map((event, idx) => (
            <div
              key={event.id}
              className="animate-fade-in rounded-lg border border-border bg-surface-1 border-l-4 border-l-red-500 overflow-hidden"
              style={{
                animation: idx === recoveryLog.length - 1
                  ? "recovery-flash 2s ease-out"
                  : undefined,
              }}
            >
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">
                    ⚡ RECOVERY EVENT
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/40">
                    {new Date(event.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>

                <span className="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground/50">
                  recovery_{idx + 1}
                </span>

                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-yellow-500/80">
                    TRIGGER
                  </span>
                  <p className="text-[11px] leading-relaxed text-yellow-400/90 mt-0.5 font-mono">
                    {event.trigger}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded px-2.5 py-2 bg-red-950/30 border border-red-900/20">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-red-400">
                      BEFORE
                    </span>
                    <p className="text-[11px] font-mono text-muted-foreground mt-1 leading-relaxed">
                      {event.previousStrategy}
                    </p>
                  </div>
                  <div className="rounded px-2.5 py-2 bg-green-950/30 border border-green-900/20">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-green-400">
                      AFTER
                    </span>
                    <p className="text-[11px] font-mono text-muted-foreground mt-1 leading-relaxed">
                      {event.newStrategy}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] font-mono text-green-400/70">
                  ✅ Agent resumed task successfully
                </p>
              </div>
            </div>
          ))
        )}

        {/* Health Checks */}
        <div className="pt-2">
          <span className="text-[11px] font-medium text-muted-foreground/60">Health Checks</span>
          {recentChecks.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/30 text-center py-4">None yet</p>
          ) : (
            <div className="mt-2 space-y-px rounded-lg border border-border overflow-hidden">
              {recentChecks.map((check, i) => (
                <div
                  key={check.id}
                  className={`flex items-center justify-between px-3 py-1.5 text-[11px] font-mono bg-surface-1 ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${check.success ? "bg-status-ok" : "bg-status-error"}`} />
                    <span className="text-muted-foreground">{check.tool}</span>
                  </div>
                  <span className={`tabular-nums ${check.latency > 1000 ? "text-status-error" : "text-muted-foreground/50"}`}>
                    {Math.round(check.latency)}ms
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes recovery-flash {
          0% { background-color: rgba(239, 68, 68, 0.15); }
          100% { background-color: transparent; }
        }
      `}</style>
    </div>
  );
}
