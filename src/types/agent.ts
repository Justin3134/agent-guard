export type HealthStatus = "healthy" | "degraded" | "critical";
export type AgentStatus = "running" | "idle";
export type SimulationPhase = 1 | 2 | 3;

export type LogEntryType = "tool_call" | "tool_result" | "health_check" | "recovery" | "reasoning" | "error";

export interface LogEntry {
  id: string;
  timestamp: string;
  type: LogEntryType;
  content: string;
  tool?: string;
  latency?: number;
  success?: boolean;
}

export interface HealthCheck {
  id: string;
  timestamp: string;
  status: HealthStatus;
  latency: number;
  tool: string;
  success: boolean;
}

export interface RecoveryEvent {
  id: string;
  timestamp: string;
  trigger: string;
  previousStrategy: string;
  newStrategy: string;
  description: string;
}

export interface TraceEntry {
  id: string;
  traceId: string;
  tool: string;
  latency: number;
  success: boolean;
  timestamp: string;
}

export interface AgentState {
  status: AgentStatus;
  healthStatus: HealthStatus;
  phase: SimulationPhase;
  totalToolCalls: number;
  sessionStart: string;
  avgLatency: number;
  consecutiveFailures: number;
  healthHistory: HealthCheck[];
  recoveryLog: RecoveryEvent[];
  traces: TraceEntry[];
  reasoningStream: LogEntry[];
}
