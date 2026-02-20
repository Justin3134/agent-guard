import { useEffect, useState } from "react";
import { Cpu, Code, Eye, Hash, Clock } from "lucide-react";

interface StatusBarProps {
  totalToolCalls: number;
  sessionStart: string;
  isConnected: boolean;
}

export function StatusBar({ totalToolCalls, sessionStart, isConnected }: StatusBarProps) {
  const [uptime, setUptime] = useState("0:00");

  useEffect(() => {
    const interval = setInterval(() => {
      const start = new Date(sessionStart).getTime();
      const diff = Math.floor((Date.now() - start) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setUptime(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStart]);

  const items = [
    { icon: Cpu, label: "Model", value: "Claude 3.5 Sonnet" },
    { icon: Code, label: "Framework", value: "AWS Strands" },
    { icon: Eye, label: "Observability", value: "Datadog LLMObs" },
    { icon: Hash, label: "Tool Calls", value: totalToolCalls.toString() },
    { icon: Clock, label: "Uptime", value: uptime },
  ];

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-border bg-card text-[10px] font-mono text-muted-foreground">
      <div className="flex items-center gap-4">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon className="h-3 w-3 opacity-40" />
            <span className="opacity-50">{label}:</span>
            <span className="text-foreground opacity-70">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-health-ok" : "bg-muted-foreground"}`} />
        <span>{isConnected ? "Backend Connected" : "Demo Mode"}</span>
      </div>
    </div>
  );
}
