import { LatencyChart } from "./LatencyChart";
import type { HealthStatus, TraceEntry } from "@/types/agent";

interface HealthMonitorProps {
  healthStatus: HealthStatus;
  traces: TraceEntry[];
  avgLatency: number;
  consecutiveFailures: number;
}

const statusConfig: Record<HealthStatus, { label: string; dotColor: string; textColor: string }> = {
  healthy: { label: "Healthy", dotColor: "bg-status-ok", textColor: "text-status-ok" },
  degraded: { label: "Degraded", dotColor: "bg-status-warn animate-subtle-pulse", textColor: "text-status-warn" },
  critical: { label: "Critical", dotColor: "bg-status-error animate-subtle-pulse", textColor: "text-status-error" },
};

export function HealthMonitor({ healthStatus, traces, avgLatency, consecutiveFailures }: HealthMonitorProps) {
  const config = statusConfig[healthStatus];
  const recentTraces = traces.slice(-5).reverse();

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 flex items-center justify-between px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Health</span>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${config.dotColor}`} />
          <span className={`text-xs font-semibold ${config.textColor}`}>{config.label}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-5">
        {/* Latency Chart */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-medium text-muted-foreground">Latency</span>
            <span className="text-[10px] font-mono text-muted-foreground/50">last 20 calls</span>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-3">
            <LatencyChart traces={traces} healthStatus={healthStatus} />
          </div>
        </div>

        {/* Recent Traces */}
        <div>
          <span className="text-[11px] font-medium text-muted-foreground">Recent Traces</span>
          {recentTraces.length === 0 ? (
            <p className="text-xs text-muted-foreground/40 mt-3 text-center py-6">No traces yet</p>
          ) : (
            <div className="mt-2 space-y-px rounded-lg border border-border overflow-hidden">
              {recentTraces.map((trace, i) => (
                <div
                  key={trace.id}
                  className={`animate-fade-in flex items-center justify-between px-3 py-2 text-xs font-mono ${
                    i > 0 ? "border-t border-border" : ""
                  } ${trace.success ? "bg-surface-1" : "bg-status-error/5"}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${trace.success ? "bg-status-ok" : "bg-status-error"}`} />
                    <span className="text-muted-foreground/60">{trace.traceId.slice(0, 12)}</span>
                    <span className="text-foreground">{trace.tool}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`tabular-nums ${trace.latency > 1000 ? "text-status-error" : "text-muted-foreground"}`}>
                      {trace.latency}ms
                    </span>
                    <span className={`w-6 text-right ${trace.success ? "text-status-ok" : "text-status-error font-semibold"}`}>
                      {trace.success ? "ok" : "fail"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-surface-1 p-3">
            <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Avg Latency</span>
            <p className="text-lg font-mono font-semibold mt-1 tabular-nums">
              {avgLatency}<span className="text-xs text-muted-foreground ml-0.5">ms</span>
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-1 p-3">
            <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">Failures</span>
            <p className={`text-lg font-mono font-semibold mt-1 tabular-nums ${consecutiveFailures > 0 ? "text-status-error" : ""}`}>
              {consecutiveFailures}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
