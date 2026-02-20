import { useState, useEffect } from "react";
import { Play, RotateCcw } from "lucide-react";

import type { AgentStatus, SimulationPhase } from "@/types/agent";

interface NavbarProps {
  agentStatus: AgentStatus;
  phase: SimulationPhase;
  onRun: () => void;
  onReset: () => void;
}

const phaseLabels: Record<SimulationPhase, string> = {
  1: "Normal",
  2: "Detecting",
  3: "Recovered",
};

interface DatadogStatus {
  enabled: boolean;
  dashboard_url: string;
}

export function Navbar({ agentStatus, phase, onRun, onReset }: NavbarProps) {
  const isRunning = agentStatus === "running";
  const [ddStatus, setDdStatus] = useState<DatadogStatus | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/datadog-status")
      .then((res) => res.json())
      .then((data) => setDdStatus(data))
      .catch(() => setDdStatus(null));
  }, []);

  return (
    <nav className="flex items-center justify-between h-12 px-4 border-b border-border bg-surface-1">
      <div className="flex items-center gap-4">
        <div className="flex items-center">
          <span className="text-sm font-semibold tracking-[-0.02em] text-foreground">AgentSentinel</span>
        </div>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${
            phase === 1 ? "bg-status-ok" : phase === 2 ? "bg-status-warn animate-subtle-pulse" : "bg-status-ok"
          }`} />
          <span className="text-xs font-mono text-muted-foreground">
            Phase {phase} · {phaseLabels[phase]}
          </span>
        </div>

        <div className="h-4 w-px bg-border" />

        {ddStatus?.enabled ? (
          <a
            href={ddStatus.dashboard_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-medium text-white transition-colors"
            style={{ backgroundColor: "#22c55e" }}
          >
            ● Datadog Live
          </a>
        ) : (
          <span
            className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: "#6b7280" }}
          >
            ○ Datadog Offline
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 mr-3">
          <div className={`h-1.5 w-1.5 rounded-full ${isRunning ? "bg-status-ok animate-subtle-pulse" : "bg-muted-foreground/40"}`} />
          <span className="text-xs text-muted-foreground">
            {isRunning ? "Running" : "Idle"}
          </span>
        </div>

        <button
          onClick={onRun}
          disabled={isRunning}
          className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="h-3 w-3" />
          Run Agent
        </button>

        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 h-7 px-3 text-xs font-medium rounded-md border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>
    </nav>
  );
}
