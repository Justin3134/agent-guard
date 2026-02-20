import type { RecoveryEvent, HealthCheck } from "@/types/agent";

interface SelfHealingPanelProps {
  recoveryLog: RecoveryEvent[];
  healthHistory: HealthCheck[];
}

export function SelfHealingPanel({ recoveryLog, healthHistory }: SelfHealingPanelProps) {
  const recentChecks = healthHistory.slice(-5).reverse();

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
              🟢 Agent operating normally — no recoveries triggered
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
