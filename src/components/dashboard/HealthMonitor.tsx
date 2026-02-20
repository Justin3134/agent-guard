import { Activity, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { LatencyChart } from "./LatencyChart";
import type { HealthStatus, TraceEntry } from "@/types/agent";

interface HealthMonitorProps {
  healthStatus: HealthStatus;
  traces: TraceEntry[];
  avgLatency: number;
  consecutiveFailures: number;
}

const statusConfig: Record<HealthStatus, { icon: React.ElementType; label: string; bgClass: string; textClass: string; ringClass: string }> = {
  healthy: {
    icon: CheckCircle,
    label: "All Systems Nominal",
    bgClass: "bg-health-ok/10",
    textClass: "text-health-ok",
    ringClass: "ring-health-ok/30",
  },
  degraded: {
    icon: AlertTriangle,
    label: "Performance Degraded",
    bgClass: "bg-health-degraded/10",
    textClass: "text-health-degraded",
    ringClass: "ring-health-degraded/30",
  },
  critical: {
    icon: XCircle,
    label: "Critical — Tool Failure",
    bgClass: "bg-health-critical/10",
    textClass: "text-health-critical",
    ringClass: "ring-health-critical/30",
  },
};

export function HealthMonitor({ healthStatus, traces, avgLatency, consecutiveFailures }: HealthMonitorProps) {
  const config = statusConfig[healthStatus];
  const StatusIcon = config.icon;
  const recentTraces = traces.slice(-5).reverse();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Live Health Monitor
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {/* Health Status Banner */}
        <div className={`rounded-lg p-4 ring-1 ${config.bgClass} ${config.ringClass} transition-all duration-500`}>
          <div className="flex items-center gap-3">
            <StatusIcon className={`h-6 w-6 ${config.textClass} ${healthStatus === "critical" ? "animate-pulse" : ""}`} />
            <div>
              <p className={`text-sm font-semibold ${config.textClass}`}>{config.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                Agent health status • Last updated {new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>

        {/* Latency Chart */}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Tool Call Latency (last 20)
          </p>
          <LatencyChart traces={traces} />
        </div>

        {/* Recent Traces */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Recent Traces
          </p>
          {recentTraces.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Activity className="h-6 w-6 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No traces yet</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recentTraces.map((trace) => (
                <div
                  key={trace.id}
                  className={`animate-fade-in-up flex items-center justify-between rounded-md border px-3 py-2 font-mono text-xs ${
                    trace.success
                      ? "border-border bg-card"
                      : "border-log-error/30 bg-log-error/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${trace.success ? "bg-health-ok" : "bg-health-critical animate-pulse"}`} />
                    <span className="text-muted-foreground">{trace.traceId.slice(0, 14)}</span>
                    <span className="text-foreground font-medium">{trace.tool}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={trace.latency > 1000 ? "text-health-critical" : "text-muted-foreground"}>
                      {trace.latency}ms
                    </span>
                    <span className={trace.success ? "text-health-ok" : "text-health-critical font-semibold"}>
                      {trace.success ? "OK" : "FAIL"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Avg Latency</p>
            <p className="text-xl font-mono font-bold mt-1">
              {avgLatency}<span className="text-xs text-muted-foreground ml-1">ms</span>
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Consecutive Failures</p>
            <p className={`text-xl font-mono font-bold mt-1 ${consecutiveFailures > 0 ? "text-health-critical" : "text-foreground"}`}>
              {consecutiveFailures}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
