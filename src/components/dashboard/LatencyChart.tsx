import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import type { TraceEntry, HealthStatus } from "@/types/agent";

interface LatencyChartProps {
  traces: TraceEntry[];
  healthStatus: HealthStatus;
}

export function LatencyChart({ traces, healthStatus }: LatencyChartProps) {
  const data = traces.slice(-20).map((t, i) => ({
    index: i + 1,
    latency: Math.round(t.latency),
    success: t.success,
  }));

  if (data.length === 0) {
    return (
      <div className="h-[140px] flex items-center justify-center text-muted-foreground/30 text-xs font-mono">
        Waiting for data
      </div>
    );
  }

  const isDegraded = healthStatus === "degraded" || healthStatus === "critical";
  const strokeColor = isDegraded ? "hsl(0, 72%, 51%)" : "hsl(142, 71%, 45%)";

  return (
    <div className="h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="latencyFillGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="latencyFillRed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="index"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: "hsl(0, 0%, 30%)" }}
          />
          <YAxis
            domain={[0, 10000]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: "hsl(0, 0%, 30%)" }}
            width={40}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(0, 0%, 8%)",
              border: "1px solid hsl(0, 0%, 15%)",
              borderRadius: "6px",
              fontSize: "11px",
              fontFamily: "IBM Plex Mono, monospace",
              color: "hsl(0, 0%, 70%)",
            }}
            formatter={(value: number) => [`${value}ms`, "Latency"]}
            labelFormatter={(label) => `#${label}`}
          />
          <ReferenceLine
            y={1000}
            stroke="hsl(45, 93%, 47%)"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            label={{
              value: "Degradation Threshold",
              position: "insideTopRight",
              fill: "hsl(45, 93%, 47%)",
              fontSize: 9,
              fontFamily: "monospace",
            }}
          />
          <Area
            type="monotone"
            dataKey="latency"
            stroke={strokeColor}
            fill={isDegraded ? "url(#latencyFillRed)" : "url(#latencyFillGreen)"}
            strokeWidth={1.5}
            dot={(props: any) => {
              const { cx, cy, payload, index: dotIndex } = props;
              const isLast = dotIndex === data.length - 1;
              if (!payload.success) {
                return (
                  <circle
                    key={`dot-${payload.index}`}
                    cx={cx}
                    cy={cy}
                    r={isLast ? 5 : 3.5}
                    fill="hsl(0, 72%, 51%)"
                    stroke="hsl(0, 72%, 40%)"
                    strokeWidth={isLast ? 2 : 1}
                    className={isLast && isDegraded ? "animate-pulse" : ""}
                  />
                );
              }
              return (
                <circle
                  key={`dot-${payload.index}`}
                  cx={cx}
                  cy={cy}
                  r={isLast ? 4 : 2}
                  fill={isLast ? "hsl(142, 71%, 45%)" : "hsl(142, 71%, 45%)"}
                  stroke={isLast ? "hsl(142, 71%, 35%)" : "none"}
                  strokeWidth={isLast ? 2 : 0}
                />
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
