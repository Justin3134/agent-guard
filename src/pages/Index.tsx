import { Navbar } from "@/components/dashboard/Navbar";
import { ReasoningStream } from "@/components/dashboard/ReasoningStream";
import { HealthMonitor } from "@/components/dashboard/HealthMonitor";
import { SelfHealingPanel } from "@/components/dashboard/SelfHealingPanel";
import { StatusBar } from "@/components/dashboard/StatusBar";
import { useAgentState } from "@/hooks/useAgentState";

const Index = () => {
  const { state, isConnected, runAgent, resetAgent, askAgent } = useAgentState();

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <Navbar
        agentStatus={state.status}
        phase={state.phase}
        onRun={runAgent}
        onReset={resetAgent}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Agent Reasoning */}
        <div className="w-[340px] border-r border-border flex-shrink-0">
          <ReasoningStream
            entries={state.reasoningStream}
            onAsk={askAgent}
            isRunning={state.status === "running"}
          />
        </div>

        {/* Center Panel - Health Monitor */}
        <div className="flex-1 min-w-0">
          <HealthMonitor
            healthStatus={state.healthStatus}
            traces={state.traces}
            avgLatency={state.avgLatency}
            consecutiveFailures={state.consecutiveFailures}
          />
        </div>

        {/* Right Panel - Self-Healing */}
        <div className="w-[320px] border-l border-border flex-shrink-0">
          <SelfHealingPanel
            recoveryLog={state.recoveryLog}
            healthHistory={state.healthHistory}
          />
        </div>
      </div>

      <StatusBar
        totalToolCalls={state.totalToolCalls}
        sessionStart={state.sessionStart}
        isConnected={isConnected}
      />
    </div>
  );
};

export default Index;
