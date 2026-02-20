import { useState, useCallback, useRef, useEffect } from "react";
import type { LogEntry } from "@/types/agent";

const API_BASE = "http://localhost:8000";

const DEFAULT_TASK =
  "Analyze the AI coding tools market — Cursor, Windsurf, GitHub Copilot, Replit. " +
  "For each: pricing, key features, weaknesses, and growth trajectory.";

const generateId = () => Math.random().toString(36).substring(2, 10);

type AgentName = "analyst" | "critic" | "scout" | "synthesizer";
type AgentRunStatus = "waiting" | "running" | "complete" | "error";

interface GraphNode {
  id: string;
  type: string;
  label: string;
  agent: string;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
}

interface PrismState {
  status: "idle" | "running";
  sessionId: string;
  agentStatuses: Record<AgentName, AgentRunStatus>;
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  synthesisOutput: string;
  reasoningStream: LogEntry[];
}

export function useAgentState() {
  const [state, setState] = useState<PrismState>({
    status: "idle",
    sessionId: `prism_${Date.now()}`,
    agentStatuses: {
      analyst: "waiting",
      critic: "waiting",
      scout: "waiting",
      synthesizer: "waiting",
    },
    graphNodes: [],
    graphEdges: [],
    synthesisOutput: "",
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
      ].slice(-80),
    }));
  }, []);

  const setAgentStatus = useCallback((agent: string, status: AgentRunStatus) => {
    if (!["analyst", "critic", "scout", "synthesizer"].includes(agent)) return;
    setState((prev) => ({
      ...prev,
      agentStatuses: { ...prev.agentStatuses, [agent as AgentName]: status },
    }));
  }, []);

  const pollBackend = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      setIsConnected(res.ok);
    } catch {
      setIsConnected(false);
    }
  }, []);

  const askAgent = useCallback(
    async (question: string) => {
      const sessionId = `prism_${Date.now()}`;

      setState((prev) => ({
        ...prev,
        status: "running",
        sessionId,
        agentStatuses: {
          analyst: "waiting",
          critic: "waiting",
          scout: "waiting",
          synthesizer: "waiting",
        },
        graphNodes: [],
        graphEdges: [],
        synthesisOutput: "",
        reasoningStream: [],
      }));

      addLogEntry({ type: "reasoning", content: `Starting research: "${question}"` });

      try {
        const response = await fetch(`${API_BASE}/ask`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, session_id: sessionId }),
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
                const agent = event.agent || "system";

                switch (event.type) {
                  case "progress": {
                    if (["analyst", "critic", "scout", "synthesizer"].includes(agent)) {
                      setAgentStatus(agent, "running");
                    }
                    addLogEntry({ type: "reasoning", content: event.data });
                    break;
                  }

                  case "agent_complete": {
                    setAgentStatus(agent, "complete");
                    addLogEntry({ type: "tool_result", content: event.data, success: true });
                    break;
                  }

                  case "agent_error": {
                    setAgentStatus(agent, "error");
                    addLogEntry({ type: "error", content: event.data });
                    break;
                  }

                  case "graph_update": {
                    try {
                      const gd = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                      setState((prev) => ({
                        ...prev,
                        graphNodes: gd.nodes || prev.graphNodes,
                        graphEdges: gd.edges || prev.graphEdges,
                      }));
                    } catch {}
                    break;
                  }

                  case "synthesis_complete": {
                    setAgentStatus("synthesizer", "complete");
                    setState((prev) => ({ ...prev, synthesisOutput: event.data }));
                    addLogEntry({ type: "reasoning", content: "🧠 Synthesis report generated" });
                    break;
                  }

                  case "complete": {
                    addLogEntry({ type: "reasoning", content: event.data });
                    setState((prev) => ({ ...prev, status: "idle" }));
                    break;
                  }

                  case "error": {
                    addLogEntry({ type: "error", content: event.data });
                    setState((prev) => ({ ...prev, status: "idle" }));
                    break;
                  }
                }
              } catch {
                // ignore malformed
              }
            }
          }
        }
      } catch {
        addLogEntry({
          type: "error",
          content: "Backend not connected. Start the backend on http://localhost:8000",
        });
      } finally {
        setState((prev) => ({ ...prev, status: "idle" }));
      }
    },
    [addLogEntry, setAgentStatus]
  );

  const runAgent = useCallback(() => {
    askAgent(DEFAULT_TASK);
  }, [askAgent]);

  const resetAgent = useCallback(() => {
    const sid = state.sessionId;
    setState({
      status: "idle",
      sessionId: `prism_${Date.now()}`,
      agentStatuses: {
        analyst: "waiting",
        critic: "waiting",
        scout: "waiting",
        synthesizer: "waiting",
      },
      graphNodes: [],
      graphEdges: [],
      synthesisOutput: "",
      reasoningStream: [],
    });
    fetch(`${API_BASE}/api/reset-session/${sid}`, { method: "POST" }).catch(() => {});
  }, [state.sessionId]);

  useEffect(() => {
    pollBackend();
    pollingRef.current = setInterval(pollBackend, 3000);
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
