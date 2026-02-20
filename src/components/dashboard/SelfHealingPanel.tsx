import { ArrowRight } from "lucide-react";
import type { RecoveryEvent, HealthCheck } from "@/types/agent";

interface SelfHealingPanelProps {
  recoveryLog: RecoveryEvent[];
  healthHistory: HealthCheck[];
}

export function SelfHealingPanel({ recoveryLog, healthHistory }: SelfHealingPanelProps) {
  const recentChecks = healthHistory.slice(-5).reverse();

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Recovery</span>
        {recoveryLog.length > 0 && (
          <span className="ml-2 text-[10px] font-mono text-muted-foreground/50">{recoveryLog.length}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {recoveryLog.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/30">
            <p className="text-xs">No recovery events</p>
            <p className="text-[10px] mt-1">Self-healing events appear here</p>
          </div>
        ) : (
          recoveryLog.map((event) => (
            <div
              key={event.id}
              className="animate-fade-in rounded-lg border border-border bg-surface-1 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-status-warn" />
                  <span className="text-[10px] font-mono font-medium text-status-warn uppercase">
                    Recovery
                  </span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground/40">
                  {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>

              <p className="text-[12px] leading-relaxed text-secondary-foreground mb-3">{event.description}</p>

              <div className="flex items-center gap-2 text-[10px] font-mono bg-surface-2 rounded px-2.5 py-1.5">
                <span className="text-status-error">{event.previousStrategy}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-status-ok">{event.newStrategy}</span>
              </div>

              <p className="mt-2 text-[10px] font-mono text-muted-foreground/50">
                {event.trigger}
              </p>
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
    </div>
  );
}
