import { Shield, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentStatus, SimulationPhase } from "@/types/agent";

interface NavbarProps {
  agentStatus: AgentStatus;
  phase: SimulationPhase;
  onRun: () => void;
  onReset: () => void;
}

const phaseLabels: Record<SimulationPhase, string> = {
  1: "Normal Operation",
  2: "Failure Detection",
  3: "Self-Healed",
};

const phaseColors: Record<SimulationPhase, string> = {
  1: "bg-health-ok/20 text-health-ok",
  2: "bg-health-degraded/20 text-health-degraded",
  3: "bg-health-ok/20 text-health-ok",
};

export function Navbar({ agentStatus, phase, onRun, onReset }: NavbarProps) {
  const isRunning = agentStatus === "running";

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold tracking-tight">AgentGuard</span>
        </div>
        <div className={`ml-4 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium ${phaseColors[phase]}`}>
          Phase {phase}: {phaseLabels[phase]}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 mr-2">
          <div className={`h-2 w-2 rounded-full ${isRunning ? "bg-health-ok animate-pulse-glow" : "bg-muted-foreground"}`} />
          <span className="text-xs font-mono text-muted-foreground">
            {isRunning ? "Agent Running" : "Agent Idle"}
          </span>
        </div>

        <Button
          size="sm"
          onClick={onRun}
          disabled={isRunning}
          className="gap-1.5"
        >
          <Play className="h-3.5 w-3.5" />
          Run Agent
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onReset}
          className="gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>
    </nav>
  );
}
