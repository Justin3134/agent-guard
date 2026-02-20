import { Navbar } from "@/components/dashboard/Navbar";
import { ReasoningStream } from "@/components/dashboard/ReasoningStream";
import GraphPanel from "@/components/dashboard/GraphPanel";
import { useAgentState } from "@/hooks/useAgentState";

type AgentRunStatus = "waiting" | "running" | "complete" | "error";

const AGENT_META: { key: string; icon: string; label: string; color: string }[] = [
  { key: "analyst", icon: "🔢", label: "Analyst", color: "#60a5fa" },
  { key: "critic", icon: "⚠️", label: "Critic", color: "#f87171" },
  { key: "scout", icon: "🔭", label: "Scout", color: "#4ade80" },
  { key: "synthesizer", icon: "🧠", label: "Synthesizer", color: "#c084fc" },
];

function statusLabel(s: AgentRunStatus): string {
  switch (s) {
    case "waiting": return "WAITING";
    case "running": return "RUNNING";
    case "complete": return "COMPLETE";
    case "error": return "ERROR";
  }
}

function SynthesisPanel({ output }: { output: string }) {
  if (!output) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-10 flex items-center px-4 border-b border-border shrink-0">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Research Synthesis
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-muted-foreground/50 italic text-center">
            Synthesis will appear here after all agents complete their research
          </p>
        </div>
      </div>
    );
  }

  const sections = output.split(/^(## .+)$/m);

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Research Synthesis
        </span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        {sections.map((section, i) => {
          if (!section.trim()) return null;
          const isHeader = section.startsWith("## ");
          if (isHeader) {
            return (
              <h3
                key={i}
                className="text-xs font-bold text-foreground uppercase tracking-wider pt-2 pb-1 border-b border-border"
              >
                {section.replace("## ", "")}
              </h3>
            );
          }
          return (
            <p key={i} className="text-[11px] font-mono leading-relaxed text-muted-foreground">
              {section}
            </p>
          );
        })}
      </div>
    </div>
  );
}

const Index = () => {
  const { state, isConnected, runAgent, resetAgent, askAgent } = useAgentState();

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Navbar
        isRunning={state.status === "running"}
        onRun={runAgent}
        onReset={resetAgent}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Panel — Agent Activity */}
        <div className="w-[320px] border-r border-border flex-shrink-0">
          <ReasoningStream
            entries={state.reasoningStream}
            onAsk={askAgent}
            isRunning={state.status === "running"}
          />
        </div>

        {/* Center Panel — Live Knowledge Graph */}
        <div className="flex-1 min-w-0">
          <GraphPanel
            nodes={state.graphNodes}
            edges={state.graphEdges}
          />
        </div>

        {/* Right Panel — Synthesis */}
        <div className="w-[320px] border-l border-border flex-shrink-0">
          <SynthesisPanel output={state.synthesisOutput} />
        </div>
      </div>

      {/* Bottom strip — Agent status indicators */}
      <div className="h-16 border-t border-border bg-surface-1 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          {AGENT_META.map(({ key, icon, label, color }) => {
            const status = state.agentStatuses[key as keyof typeof state.agentStatuses];
            const isRunning = status === "running";
            const isComplete = status === "complete";
            const isError = status === "error";
            const isWaiting = status === "waiting";

            return (
              <div
                key={key}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                  isRunning
                    ? "border-foreground/20 bg-foreground/5"
                    : isComplete
                    ? "border-border bg-surface-2/50"
                    : isError
                    ? "border-red-500/30 bg-red-500/5"
                    : "border-border/50 bg-transparent opacity-50"
                }`}
              >
                <span>{icon}</span>
                <div
                  className={`h-2 w-2 rounded-full ${
                    isRunning ? "animate-pulse" : ""
                  }`}
                  style={{
                    backgroundColor: isWaiting ? "#6b7280" : isError ? "#ef4444" : color,
                    opacity: isWaiting ? 0.4 : 1,
                  }}
                />
                <span className={`${isWaiting ? "text-muted-foreground/40" : "text-foreground"}`}>
                  {label}
                </span>
                <span className={`text-[10px] ${
                  isComplete ? "text-green-400" :
                  isError ? "text-red-400" :
                  isRunning ? "text-foreground" :
                  "text-muted-foreground/30"
                }`}>
                  {isComplete ? "✓" : ""} {statusLabel(status)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-muted-foreground/50">
          <span>{state.graphNodes.length} nodes</span>
          <span>·</span>
          <span>{state.graphEdges.length} edges</span>
          <span>·</span>
          <div className="flex items-center gap-1">
            <div className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`} />
            <span>{isConnected ? "Connected" : "Offline"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
