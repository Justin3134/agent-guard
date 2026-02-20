import { useEffect, useState } from "react";

interface StatusBarProps {
  totalToolCalls: number;
  sessionStart: string;
  isConnected: boolean;
}

export function StatusBar({ totalToolCalls, sessionStart, isConnected }: StatusBarProps) {
  const [uptime, setUptime] = useState("0:00");

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - new Date(sessionStart).getTime()) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setUptime(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  const items = [
    { label: "Model", value: "Claude 3.5 Sonnet" },
    { label: "Framework", value: "AWS Strands" },
    { label: "Obs", value: "Datadog LLMObs" },
    { label: "Calls", value: String(totalToolCalls) },
    { label: "Uptime", value: uptime },
  ];

  return (
    <div className="flex items-center justify-between h-7 px-4 border-t border-border bg-surface-1 text-[10px] font-mono text-muted-foreground/50 shrink-0">
      <div className="flex items-center gap-4">
        {items.map(({ label, value }) => (
          <span key={label}>
            {label} <span className="text-muted-foreground">{value}</span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`h-1 w-1 rounded-full ${isConnected ? "bg-status-ok" : "bg-muted-foreground/30"}`} />
        <span>{isConnected ? "Connected" : "Demo"}</span>
      </div>
    </div>
  );
}
