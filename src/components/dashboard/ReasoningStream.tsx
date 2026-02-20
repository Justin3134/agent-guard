import { useState, useRef, useEffect } from "react";
import { Send, Wrench, Heart, AlertTriangle, Brain, XCircle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { LogEntry, LogEntryType } from "@/types/agent";

interface ReasoningStreamProps {
  entries: LogEntry[];
  onAsk: (question: string) => void;
  isRunning: boolean;
}

const typeConfig: Record<LogEntryType, { icon: React.ElementType; colorClass: string; label: string }> = {
  tool_call: { icon: Wrench, colorClass: "text-log-tool border-log-tool/30 bg-log-tool/5", label: "TOOL" },
  tool_result: { icon: Wrench, colorClass: "text-log-tool border-log-tool/30 bg-log-tool/5", label: "RESULT" },
  health_check: { icon: Heart, colorClass: "text-log-health border-log-health/30 bg-log-health/5", label: "HEALTH" },
  recovery: { icon: RefreshCw, colorClass: "text-log-recovery border-log-recovery/30 bg-log-recovery/5", label: "RECOVERY" },
  reasoning: { icon: Brain, colorClass: "text-log-reasoning border-log-reasoning/30 bg-log-reasoning/5", label: "THINK" },
  error: { icon: XCircle, colorClass: "text-log-error border-log-error/30 bg-log-error/5", label: "ERROR" },
};

export function ReasoningStream({ entries, onAsk, isRunning }: ReasoningStreamProps) {
  const [question, setQuestion] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    onAsk(question.trim());
    setQuestion("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Agent Reasoning
        </h2>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Brain className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm">Agent is waiting for a task...</p>
            <p className="text-xs mt-1 opacity-60">Click "Run Agent" or submit a question below</p>
          </div>
        ) : (
          entries.map((entry) => {
            const config = typeConfig[entry.type];
            const Icon = config.icon;
            return (
              <div
                key={entry.id}
                className={`animate-fade-in-up rounded-md border px-3 py-2 ${config.colorClass}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-mono font-semibold uppercase opacity-70">
                        {config.label}
                      </span>
                      {entry.latency !== undefined && (
                        <span className="text-[10px] font-mono opacity-50">
                          {entry.latency}ms
                        </span>
                      )}
                      <span className="text-[10px] font-mono opacity-30 ml-auto">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs font-mono leading-relaxed break-words">{entry.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask the agent a question..."
            className="text-xs font-mono bg-muted border-border"
          />
          <Button type="submit" size="sm" disabled={!question.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
