import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import type { TraceEntry } from "@/types/agent";

interface LatencyChartProps {
  traces: TraceEntry[];
}

export function LatencyChart({ traces }: LatencyChartProps) {
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

  return (
    <div className="h-[140px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="latencyFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(0, 0%, 93%)" stopOpacity={0.08} />
              <stop offset="100%" stopColor="hsl(0, 0%, 93%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="index"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: "hsl(0, 0%, 30%)" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 9, fill: "hsl(0, 0%, 30%)" }}
            width={32}
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
            y={500}
            stroke="hsl(0, 0%, 20%)"
            strokeDasharray="3 3"
          />
          <Area
            type="monotone"
            dataKey="latency"
            stroke="hsl(0, 0%, 50%)"
            fill="url(#latencyFill)"
            strokeWidth={1.5}
            dot={(props: any) => {
              const { cx, cy, payload } = props;
              if (!payload.success) {
                return (
                  <circle
                    key={`dot-${payload.index}`}
                    cx={cx}
                    cy={cy}
                    r={3.5}
                    fill="hsl(0, 65%, 52%)"
                    stroke="hsl(0, 65%, 52%)"
                    strokeWidth={1}
                  />
                );
              }
              return (
                <circle
                  key={`dot-${payload.index}`}
                  cx={cx}
                  cy={cy}
                  r={2}
                  fill="hsl(0, 0%, 50%)"
                  stroke="none"
                />
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
