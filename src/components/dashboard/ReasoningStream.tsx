import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import type { LogEntry, LogEntryType } from "@/types/agent";

interface ReasoningStreamProps {
  entries: LogEntry[];
  onAsk: (question: string) => void;
  isRunning: boolean;
}

const typeConfig: Record<LogEntryType, { label: string; dotColor: string }> = {
  tool_call: { label: "tool", dotColor: "bg-foreground/40" },
  tool_result: { label: "result", dotColor: "bg-foreground/40" },
  health_check: { label: "health", dotColor: "bg-status-ok" },
  recovery: { label: "recovery", dotColor: "bg-status-warn" },
  reasoning: { label: "think", dotColor: "bg-muted-foreground/50" },
  error: { label: "error", dotColor: "bg-status-error" },
};

export function ReasoningStream({ entries, onAsk }: ReasoningStreamProps) {
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
      <div className="h-10 flex items-center px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reasoning</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 px-6">
            <p className="text-sm">Waiting for input</p>
            <p className="text-xs mt-1">Run the agent or ask a question</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {entries.map((entry) => {
              const config = typeConfig[entry.type];
              return (
                <div key={entry.id} className="animate-fade-in px-4 py-2.5 hover:bg-surface-2/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dotColor}`} />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      {config.label}
                    </span>
                    {entry.latency !== undefined && (
                      <span className={`text-[10px] font-mono ${entry.latency > 1000 ? "text-status-error" : "text-muted-foreground/50"}`}>
                        {entry.latency}ms
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-muted-foreground/30 ml-auto">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[12px] font-mono leading-relaxed text-secondary-foreground pl-3.5">
                    {entry.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-border shrink-0">
        <div className="flex items-center gap-2 bg-surface-2 rounded-lg border border-border px-3 py-1.5 focus-within:border-foreground/20 transition-colors">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask something..."
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
          <button
            type="submit"
            disabled={!question.trim()}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
