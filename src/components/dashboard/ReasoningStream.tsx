import { useState, useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import type { LogEntry, LogEntryType } from "@/types/agent";

interface ReasoningStreamProps {
  entries: LogEntry[];
  onAsk: (question: string) => void;
  isRunning: boolean;
}

const typeConfig: Record<LogEntryType, { label: string; dotColor: string; bgColor: string; borderColor: string }> = {
  tool_call:    { label: "TOOL",     dotColor: "bg-blue-400",           bgColor: "bg-blue-500/5",    borderColor: "border-l-blue-500/30" },
  tool_result:  { label: "RESULT",   dotColor: "bg-blue-400/60",        bgColor: "bg-surface-2/30",  borderColor: "border-l-blue-500/15" },
  health_check: { label: "HEALTH",   dotColor: "bg-status-ok",          bgColor: "bg-green-500/5",   borderColor: "border-l-green-500/30" },
  recovery:     { label: "RECOVERY", dotColor: "bg-red-400",            bgColor: "bg-red-500/8",     borderColor: "border-l-red-500/40" },
  reasoning:    { label: "THINK",    dotColor: "bg-muted-foreground/50", bgColor: "",                 borderColor: "border-l-transparent" },
  error:        { label: "ERROR",    dotColor: "bg-status-error",       bgColor: "bg-red-500/10",    borderColor: "border-l-red-500/50" },
};

export function ReasoningStream({ entries, onAsk, isRunning }: ReasoningStreamProps) {
  const [question, setQuestion] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    onAsk(question.trim());
    setQuestion("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-10 flex items-center justify-between px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Agent Activity Stream
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/40 px-1.5 py-0.5 rounded bg-surface-2">
          {entries.length} events
        </span>
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
              const isRecovery = entry.type === "recovery";
              const isError = entry.type === "error";
              const isHealth = entry.type === "health_check";
              return (
                <div
                  key={entry.id}
                  className={`animate-fade-in px-4 py-2.5 transition-colors border-l-2 ${config.borderColor} ${config.bgColor}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dotColor} ${
                      isRecovery || isError ? "animate-pulse" : ""
                    }`} />
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${
                      isRecovery ? "text-red-400 font-bold" :
                      isError ? "text-status-error font-bold" :
                      isHealth ? "text-green-400" :
                      "text-muted-foreground"
                    }`}>
                      {config.label}
                    </span>
                    {entry.latency !== undefined && (
                      <span className={`text-[10px] font-mono ${
                        entry.latency > 1000 ? "text-status-error font-semibold" : "text-muted-foreground/50"
                      }`}>
                        {entry.latency}ms
                      </span>
                    )}
                    {entry.success === false && (
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-red-500/15 text-red-400">
                        FAIL
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-muted-foreground/30 ml-auto">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                  <p className={`text-[12px] font-mono leading-relaxed pl-3.5 ${
                    isRecovery ? "text-red-300" :
                    isError ? "text-red-400" :
                    "text-secondary-foreground"
                  }`}>
                    {entry.content}
                  </p>
                </div>
              );
            })}
            <div ref={bottomRef} />
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
            disabled={!question.trim() || isRunning}
            className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
