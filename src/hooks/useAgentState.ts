import { useState, useCallback, useRef, useEffect } from "react";
import type {
  AgentState,
  HealthCheck,
  TraceEntry,
  LogEntry,
  HealthStatus,
  SimulationPhase,
} from "@/types/agent";

const API_BASE = "http://localhost:8000";

const DEFAULT_TASK =
  "Research and compare these 4 AI coding tools: Cursor, Windsurf, GitHub Copilot, " +
  "and Replit. For each tool provide: monthly pricing, standout feature, and biggest " +
  "weakness. Then rank them by value for a professional developer.";

const generateId = () => Math.random().toString(36).substring(2, 10);

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

  const addLogEntry = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    setState((prev) => ({
      ...prev,
      reasoningStream: [
        ...prev.reasoningStream,
        { ...entry, id: generateId(), timestamp: new Date().toISOString() },
      ].slice(-50),
    }));
  }, []);

  const fetchRecoveryLog = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/recovery-log`);
      if (res.ok) {
        const recoveryLog = await res.json();
        setState((prev) => ({ ...prev, recoveryLog }));
      }
    } catch {}
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

  const askAgent = useCallback(
    async (question: string) => {
      setState((prev) => ({
        ...prev,
        status: "running",
        phase: 1,
        healthStatus: "healthy",
        totalToolCalls: 0,
        consecutiveFailures: 0,
        avgLatency: 0,
        healthHistory: [],
        recoveryLog: [],
        traces: [],
        reasoningStream: [],
        sessionStart: new Date().toISOString(),
      }));

      try {
        await fetch(`${API_BASE}/reset`, { method: "POST" });
      } catch {}

      addLogEntry({ type: "reasoning", content: `Processing: "${question}"` });

      try {
        const response = await fetch(`${API_BASE}/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        setIsConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const messages = buffer.split("\n\n");
          buffer = messages.pop() || "";

          for (const message of messages) {
            const lines = message.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;

              const raw = line.slice(6).trim();
              if (raw === "[DONE]") {
                setState((prev) => ({ ...prev, status: "idle" }));
                return;
              }

              try {
                const event = JSON.parse(raw);

                switch (event.type) {
                  case "progress":
                    addLogEntry({ type: "reasoning", content: event.data });
                    break;

                  case "tool_call":
                    addLogEntry({ type: "tool_call", content: event.data });
                    break;

                  case "trace": {
                    try {
                      const trace =
                        typeof event.data === "string"
                          ? JSON.parse(event.data)
                          : event.data;
                      setState((prev) => {
                        const newTrace: TraceEntry = {
                          id: trace.id || generateId(),
                          traceId: trace.traceId || `trace-${generateId()}`,
                          tool: trace.tool || "unknown",
                          latency: trace.latency || 0,
                          success: trace.success ?? true,
                          timestamp: trace.timestamp || new Date().toISOString(),
                        };
                        const newTraces = [...prev.traces, newTrace].slice(-20);
                        const avgLatency =
                          newTraces.length > 0
                            ? Math.round(
                                newTraces.reduce((a, t) => a + t.latency, 0) /
                                  newTraces.length
                              )
                            : 0;
                        const consecutiveFailures = (() => {
                          let count = 0;
                          for (let i = newTraces.length - 1; i >= 0; i--) {
                            if (!newTraces[i].success) count++;
                            else break;
                          }
                          return count;
                        })();
                        const healthStatus: HealthStatus =
                          consecutiveFailures >= 3
                            ? "critical"
                            : consecutiveFailures >= 2
                            ? "degraded"
                            : "healthy";
                        const phase: SimulationPhase =
                          healthStatus === "critical"
                            ? 2
                            : healthStatus === "degraded"
                            ? 2
                            : prev.recoveryLog.length > 0
                            ? 3
                            : 1;
                        return {
                          ...prev,
                          traces: newTraces,
                          avgLatency,
                          consecutiveFailures,
                          healthStatus,
                          phase,
                          totalToolCalls: prev.totalToolCalls + 1,
                        };
                      });
                    } catch {}
                    break;
                  }

                  case "health_check": {
                    try {
                      const health =
                        typeof event.data === "string"
                          ? JSON.parse(event.data)
                          : event.data;
                      const healthEntry: HealthCheck = {
                        id: health.id || generateId(),
                        timestamp: health.timestamp || new Date().toISOString(),
                        status:
                          health.status ||
                          (health.success ? "healthy" : "critical"),
                        latency: health.latency || health.avg_latency_ms || 0,
                        tool: health.tool || "system",
                        success: health.success ?? true,
                      };
                      setState((prev) => {
                        const newHealthStatus: HealthStatus =
                          health.overall_health || health.status || prev.healthStatus;
                        const newPhase: SimulationPhase =
                          newHealthStatus === "critical" || newHealthStatus === "degraded"
                            ? 2
                            : prev.recoveryLog.length > 0
                            ? 3
                            : 1;
                        return {
                          ...prev,
                          healthHistory: [
                            ...prev.healthHistory,
                            healthEntry,
                          ].slice(-20),
                          healthStatus: newHealthStatus,
                          consecutiveFailures:
                            health.consecutive_failures ?? prev.consecutiveFailures,
                          avgLatency: health.avg_latency_ms ?? prev.avgLatency,
                          phase: newPhase,
                        };
                      });
                      addLogEntry({
                        type: "health_check",
                        content: `[Health Check] Status: ${(
                          health.overall_health ||
                          health.status ||
                          "unknown"
                        ).toUpperCase()} | Failures: ${
                          health.consecutive_failures ?? 0
                        } | Latency: ${
                          health.avg_latency_ms ?? health.latency ?? 0
                        }ms`,
                        success: health.success,
                      });
                    } catch {}
                    break;
                  }

                  case "recovery": {
                    try {
                      const recovery =
                        typeof event.data === "string"
                          ? JSON.parse(event.data)
                          : event.data;
                      setState((prev) => ({
                        ...prev,
                        healthStatus: "healthy" as HealthStatus,
                        consecutiveFailures: 0,
                        phase: 3 as SimulationPhase,
                        recoveryLog: [...prev.recoveryLog, recovery],
                      }));
                      addLogEntry({
                        type: "recovery",
                        content: `[Recovery] ${
                          recovery.trigger || "degradation detected"
                        } → ${recovery.newStrategy || "fallback strategy"}`,
                      });
                      fetchRecoveryLog();
                    } catch {}
                    break;
                  }

                  case "complete":
                    addLogEntry({
                      type: "reasoning",
                      content:
                        "[Task Complete] " +
                        (event.data || "").slice(0, 500) +
                        "...",
                    });
                    setState((prev) => ({ ...prev, status: "idle" }));
                    break;

                  case "error":
                    addLogEntry({ type: "error", content: event.data });
                    setState((prev) => ({ ...prev, status: "idle" }));
                    break;
                }
              } catch {
                // ignore malformed events
              }
            }
          }
        }
      } catch {
        addLogEntry({
          type: "error",
          content:
            "Backend not connected. Make sure the backend is running on http://localhost:8000",
        });
      } finally {
        setState((prev) => ({ ...prev, status: "idle" }));
      }
    },
    [addLogEntry, fetchRecoveryLog]
  );

  const runAgent = useCallback(() => {
    askAgent(DEFAULT_TASK);
  }, [askAgent]);

  const resetAgent = useCallback(() => {
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
    fetch(`${API_BASE}/reset`, { method: "POST" }).catch(() => {});
  }, []);

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
    runAgent,
    resetAgent,
    askAgent,
  };
}
