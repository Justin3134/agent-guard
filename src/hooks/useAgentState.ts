import { useState, useCallback, useRef, useEffect } from "react";
import type {
  AgentState,
  HealthCheck,
  RecoveryEvent,
  TraceEntry,
  LogEntry,
  HealthStatus,
  SimulationPhase,
} from "@/types/agent";

const API_BASE = "http://localhost:8000";

const generateId = () => Math.random().toString(36).substring(2, 10);

// Demo data generators for when backend is unavailable
function generateDemoHealthCheck(phase: SimulationPhase, index: number): HealthCheck {
  const tools = ["web_search", "calculator", "code_interpreter", "file_reader"];
  const tool = tools[index % tools.length];
  const isPhase2 = phase === 2;
  const isFailing = isPhase2 && tool === "web_search";

  return {
    id: generateId(),
    timestamp: new Date(Date.now() - (20 - index) * 3000).toISOString(),
    status: isFailing ? "critical" : "healthy",
    latency: isFailing ? 2500 + Math.random() * 3000 : 80 + Math.random() * 150,
    tool,
    success: !isFailing,
  };
}

function generateDemoTrace(phase: SimulationPhase, index: number): TraceEntry {
  const tools = ["web_search", "calculator", "code_interpreter", "file_reader", "memory_store"];
  const tool = tools[index % tools.length];
  const isPhase2 = phase === 2;
  const isFailing = isPhase2 && tool === "web_search";

  return {
    id: generateId(),
    traceId: `trace-${generateId()}`,
    tool,
    latency: isFailing ? 3200 + Math.random() * 2000 : 50 + Math.random() * 200,
    success: !isFailing,
    timestamp: new Date(Date.now() - (10 - index) * 2000).toISOString(),
  };
}

export function useAgentState() {
  const [state, setState] = useState<AgentState>({
    status: "idle",
    healthStatus: "healthy",
    phase: 1,
    totalToolCalls: 0,
    sessionStart: new Date().toISOString(),
    avgLatency: 0,
    consecutiveFailures: 0,
    healthHistory: [],
    recoveryLog: [],
    traces: [],
    reasoningStream: [],
  });

  const [isConnected, setIsConnected] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const phaseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const addLogEntry = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    setState((prev) => ({
      ...prev,
      reasoningStream: [
        ...prev.reasoningStream,
        { ...entry, id: generateId(), timestamp: new Date().toISOString() },
      ].slice(-50),
    }));
  }, []);

  const pollBackend = useCallback(async () => {
    try {
      const [healthRes, recoveryRes] = await Promise.all([
        fetch(`${API_BASE}/health-history`),
        fetch(`${API_BASE}/recovery-log`),
      ]);

      if (healthRes.ok && recoveryRes.ok) {
        const healthHistory = await healthRes.json();
        const recoveryLog = await recoveryRes.json();
        setIsConnected(true);
        setState((prev) => ({ ...prev, healthHistory, recoveryLog }));
      }
    } catch {
      setIsConnected(false);
    }
  }, []);

  const runSimulation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: "running",
      phase: 1,
      healthStatus: "healthy",
      totalToolCalls: 0,
      consecutiveFailures: 0,
      healthHistory: [],
      recoveryLog: [],
      traces: [],
      reasoningStream: [],
      sessionStart: new Date().toISOString(),
    }));

    // Phase 1: Normal operation
    const phase1Entries: Omit<LogEntry, "id" | "timestamp">[] = [
      { type: "reasoning", content: "Initializing agent... Loading tools and strategies." },
      { type: "tool_call", content: "Calling web_search('latest AI research papers 2025')", tool: "web_search", latency: 120, success: true },
      { type: "tool_result", content: "Found 12 relevant papers from arxiv and semantic scholar.", tool: "web_search", latency: 120, success: true },
      { type: "health_check", content: "Health check passed. All tools responding within normal latency bounds.", success: true },
      { type: "tool_call", content: "Calling calculator(aggregate_citation_counts)", tool: "calculator", latency: 45, success: true },
      { type: "tool_result", content: "Aggregated citation data for 12 papers. Mean citations: 47.3", tool: "calculator", latency: 45, success: true },
      { type: "reasoning", content: "Task progressing normally. Web search and calculator tools are healthy. Compiling summary." },
    ];

    let entryIndex = 0;
    const addEntries = (entries: Omit<LogEntry, "id" | "timestamp">[], startDelay: number) => {
      entries.forEach((entry, i) => {
        setTimeout(() => {
          addLogEntry(entry);
          if (entry.type === "tool_call" || entry.type === "tool_result") {
            setState((prev) => {
              const newTrace: TraceEntry = {
                id: generateId(),
                traceId: `trace-${generateId()}`,
                tool: entry.tool || "unknown",
                latency: entry.latency || 0,
                success: entry.success ?? true,
                timestamp: new Date().toISOString(),
              };
              const newTraces = [...prev.traces, newTrace].slice(-20);
              const avgLatency = newTraces.reduce((a, t) => a + t.latency, 0) / newTraces.length;
              return {
                ...prev,
                totalToolCalls: prev.totalToolCalls + (entry.type === "tool_call" ? 1 : 0),
                traces: newTraces,
                avgLatency: Math.round(avgLatency),
                healthHistory: [
                  ...prev.healthHistory,
                  generateDemoHealthCheck(prev.phase, prev.healthHistory.length),
                ].slice(-20),
              };
            });
          }
        }, startDelay + i * 1800);
      });
    };

    addEntries(phase1Entries, 500);

    // Phase 2: Failure detection
    const phase2Delay = phase1Entries.length * 1800 + 2000;
    setTimeout(() => {
      setState((prev) => ({ ...prev, phase: 2, healthStatus: "degraded" }));
      addLogEntry({ type: "reasoning", content: "⚠ Anomaly detected. web_search latency exceeding threshold." });
    }, phase2Delay);

    const phase2Entries: Omit<LogEntry, "id" | "timestamp">[] = [
      { type: "tool_call", content: "Calling web_search('transformer architecture improvements')", tool: "web_search", latency: 3200, success: false },
      { type: "error", content: "web_search FAILED — Timeout after 3200ms. Service appears degraded.", tool: "web_search", latency: 3200, success: false },
      { type: "health_check", content: "Health check FAILED for web_search. Consecutive failures: 1", success: false },
      { type: "tool_call", content: "Calling web_search('neural network scaling laws')", tool: "web_search", latency: 4100, success: false },
      { type: "error", content: "web_search FAILED — Timeout after 4100ms. Consecutive failures: 2", tool: "web_search", latency: 4100, success: false },
      { type: "health_check", content: "Health check CRITICAL. web_search unresponsive. Triggering recovery protocol.", success: false },
      { type: "reasoning", content: "🚨 Tool failure threshold breached. Initiating self-healing sequence..." },
    ];

    addEntries(phase2Entries, phase2Delay + 1500);

    phase2Entries.forEach((entry, i) => {
      if (entry.type === "error" || (entry.type === "health_check" && !entry.success)) {
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            healthStatus: "critical",
            consecutiveFailures: prev.consecutiveFailures + 1,
          }));
        }, phase2Delay + 1500 + i * 1800);
      }
    });

    // Phase 3: Recovery
    const phase3Delay = phase2Delay + phase2Entries.length * 1800 + 2000;
    setTimeout(() => {
      const recoveryEvent: RecoveryEvent = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        trigger: "web_search consecutive failures exceeded threshold (3)",
        previousStrategy: "web_search (primary)",
        newStrategy: "memory_store + cached_results (fallback)",
        description: "Agent detected persistent web_search failures and autonomously switched to fallback strategy using cached research data and memory store.",
      };

      setState((prev) => ({
        ...prev,
        phase: 3,
        healthStatus: "healthy",
        consecutiveFailures: 0,
        recoveryLog: [...prev.recoveryLog, recoveryEvent],
      }));

      addLogEntry({ type: "recovery", content: "✅ Self-healing complete. Switched from web_search to memory_store + cached_results." });
    }, phase3Delay);

    const phase3Entries: Omit<LogEntry, "id" | "timestamp">[] = [
      { type: "tool_call", content: "Calling memory_store('retrieve cached research data')", tool: "memory_store", latency: 35, success: true },
      { type: "tool_result", content: "Retrieved 8 cached research summaries from memory store.", tool: "memory_store", latency: 35, success: true },
      { type: "health_check", content: "Health check passed. Fallback strategy operating normally.", success: true },
      { type: "reasoning", content: "Recovery successful. Continuing task with fallback strategy. All systems nominal." },
      { type: "tool_call", content: "Calling calculator(compare_results)", tool: "calculator", latency: 52, success: true },
      { type: "tool_result", content: "Analysis complete. Results compiled using fallback data sources.", tool: "calculator", latency: 52, success: true },
    ];

    addEntries(phase3Entries, phase3Delay + 1500);

    // End simulation
    setTimeout(() => {
      setState((prev) => ({ ...prev, status: "idle" }));
    }, phase3Delay + phase3Entries.length * 1800 + 2000);
  }, [addLogEntry]);

  const resetSimulation = useCallback(() => {
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
    setState({
      status: "idle",
      healthStatus: "healthy",
      phase: 1,
      totalToolCalls: 0,
      sessionStart: new Date().toISOString(),
      avgLatency: 0,
      consecutiveFailures: 0,
      healthHistory: [],
      recoveryLog: [],
      traces: [],
      reasoningStream: [],
    });

    // Try backend reset
    fetch(`${API_BASE}/reset`, { method: "POST" }).catch(() => {});
  }, []);

  const askAgent = useCallback(async (question: string) => {
    addLogEntry({ type: "reasoning", content: `Processing user query: "${question}"` });

    try {
      const res = await fetch(`${API_BASE}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
        }

        addLogEntry({ type: "tool_result", content: accumulated });
      } else {
        throw new Error("Backend unavailable");
      }
    } catch {
      addLogEntry({
        type: "reasoning",
        content: `Agent would process: "${question}" — Backend not connected, showing demo mode.`,
      });
    }
  }, [addLogEntry]);

  // Start polling when connected
  useEffect(() => {
    pollBackend();
    pollingRef.current = setInterval(pollBackend, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pollBackend]);

  return {
    state,
    isConnected,
    runSimulation,
    resetSimulation,
    askAgent,
  };
}
