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
    tool: t.tool,
  }));

  if (data.length === 0) {
    return (
      <div className="h-[160px] flex items-center justify-center text-muted-foreground text-xs font-mono">
        Waiting for trace data...
      </div>
    );
  }

  return (
    <div className="h-[160px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(210, 100%, 56%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="spikeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="index"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "hsl(215, 15%, 50%)" }}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(222, 40%, 8%)",
              border: "1px solid hsl(222, 25%, 15%)",
              borderRadius: "6px",
              fontSize: "11px",
              fontFamily: "JetBrains Mono, monospace",
            }}
            labelStyle={{ color: "hsl(210, 20%, 60%)" }}
            formatter={(value: number) => [`${value}ms`, "Latency"]}
            labelFormatter={(label) => `Call #${label}`}
          />
          <ReferenceLine
            y={500}
            stroke="hsl(38, 92%, 50%)"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="latency"
            stroke="hsl(210, 100%, 56%)"
            fill="url(#latencyGradient)"
            strokeWidth={2}
            dot={(props: any) => {
              const { cx, cy, payload } = props;
              if (!payload.success) {
                return (
                  <circle
                    key={`dot-${payload.index}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill="hsl(0, 72%, 51%)"
                    stroke="hsl(0, 72%, 51%)"
                    strokeWidth={2}
                    opacity={0.9}
                  />
                );
              }
              return (
                <circle
                  key={`dot-${payload.index}`}
                  cx={cx}
                  cy={cy}
                  r={2.5}
                  fill="hsl(210, 100%, 56%)"
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
