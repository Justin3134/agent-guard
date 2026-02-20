import { Zap, ArrowRight, Clock, Heart, Shield } from "lucide-react";
import type { RecoveryEvent, HealthCheck } from "@/types/agent";

interface SelfHealingPanelProps {
  recoveryLog: RecoveryEvent[];
  healthHistory: HealthCheck[];
}

export function SelfHealingPanel({ recoveryLog, healthHistory }: SelfHealingPanelProps) {
  const recentChecks = healthHistory.slice(-5).reverse();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Self-Healing Events
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {/* Recovery Events */}
        {recoveryLog.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Shield className="h-8 w-8 mb-3 opacity-20" />
            <p className="text-sm font-medium">No recovery events yet</p>
            <p className="text-xs mt-1 opacity-60 text-center px-4">
              When the agent detects failures and switches strategies, events will appear here.
            </p>
          </div>
        ) : (
          recoveryLog.map((event) => (
            <div
              key={event.id}
              className="animate-slide-in rounded-lg border border-log-recovery/30 bg-log-recovery/5 p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3.5 w-3.5 text-log-recovery" />
                <span className="text-[10px] font-mono font-semibold text-log-recovery uppercase">
                  Recovery Event
                </span>
                <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>

              <p className="text-xs text-foreground mb-2">{event.description}</p>

              <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                <span className="text-health-critical">{event.previousStrategy}</span>
                <ArrowRight className="h-3 w-3 text-log-recovery" />
                <span className="text-health-ok">{event.newStrategy}</span>
              </div>

              <div className="mt-2 text-[10px] font-mono text-muted-foreground">
                <span className="opacity-60">Trigger:</span> {event.trigger}
              </div>
            </div>
          ))
        )}

        {/* Health Check History */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Heart className="h-3 w-3" />
            Recent Health Checks
          </p>
          {recentChecks.length === 0 ? (
            <p className="text-xs text-muted-foreground opacity-50 text-center py-4">No health checks yet</p>
          ) : (
            <div className="space-y-1">
              {recentChecks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-mono"
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${check.success ? "bg-health-ok" : "bg-health-critical"}`} />
                    <span className="text-muted-foreground">{check.tool}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={check.latency > 1000 ? "text-health-critical" : "text-muted-foreground"}>
                      {Math.round(check.latency)}ms
                    </span>
                    <Clock className="h-3 w-3 text-muted-foreground opacity-40" />
                    <span className="text-muted-foreground opacity-60">
                      {new Date(check.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
