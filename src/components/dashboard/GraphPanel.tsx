import { useEffect, useRef, useMemo } from "react";

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

interface GraphPanelProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const AGENT_COLORS: Record<string, string> = {
  analyst: "#60a5fa",
  critic: "#f87171",
  scout: "#4ade80",
  synthesizer: "#c084fc",
  "": "#9ca3af",
};

function agentColor(agent: string): string {
  return AGENT_COLORS[agent] || AGENT_COLORS[""];
}

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
}

function layoutNodes(nodes: GraphNode[], width: number, height: number): LayoutNode[] {
  if (nodes.length === 0) return [];

  const topics = nodes.filter((n) => n.type === "Topic");
  const findings = nodes.filter((n) => n.type === "Finding");

  const cx = width / 2;
  const cy = height / 2;
  const topicRadius = Math.min(width, height) * 0.3;

  const positioned: Record<string, { x: number; y: number }> = {};

  topics.forEach((t, i) => {
    const angle = (2 * Math.PI * i) / Math.max(topics.length, 1) - Math.PI / 2;
    positioned[t.id] = {
      x: cx + topicRadius * Math.cos(angle),
      y: cy + topicRadius * Math.sin(angle),
    };
  });

  findings.forEach((f, i) => {
    const jitter = ((i * 7 + 3) % 11) / 11;
    positioned[f.id] = {
      x: cx + (topicRadius * 0.5 + jitter * topicRadius * 0.8) * Math.cos(i * 1.2),
      y: cy + (topicRadius * 0.5 + jitter * topicRadius * 0.8) * Math.sin(i * 1.2),
    };
  });

  return nodes.map((n) => ({
    ...n,
    x: positioned[n.id]?.x ?? cx,
    y: positioned[n.id]?.y ?? cy,
  }));
}

export default function GraphPanel({ nodes, edges }: GraphPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const width = 600;
  const height = 400;

  const layoutResult = useMemo(
    () => layoutNodes(nodes, width, height),
    [nodes]
  );

  const nodeMap = useMemo(() => {
    const m: Record<string, LayoutNode> = {};
    for (const n of layoutResult) m[n.id] = n;
    return m;
  }, [layoutResult]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [nodes.length]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="h-10 flex items-center justify-between px-4 border-b border-border shrink-0">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Live Knowledge Graph
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground/50 italic">
            Knowledge graph will build here as agents research...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" ref={containerRef}>
      <div className="h-10 flex items-center justify-between px-4 border-b border-border shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Live Knowledge Graph
        </span>
        <span className="text-[10px] font-mono text-muted-foreground/40 px-1.5 py-0.5 rounded bg-surface-2">
          {nodes.length} nodes · {edges.length} connections
        </span>
      </div>

      <div className="flex-1 relative overflow-hidden bg-surface-2/20">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {edges.map((e, i) => {
            const src = nodeMap[e.source];
            const tgt = nodeMap[e.target];
            if (!src || !tgt) return null;
            return (
              <line
                key={`edge-${i}`}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke="#4b5563"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            );
          })}

          {layoutResult.map((n) => {
            const color = agentColor(n.agent);
            const isTopic = n.type === "Topic";

            return (
              <g key={n.id}>
                {isTopic ? (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={20}
                    fill={color}
                    fillOpacity={0.2}
                    stroke={color}
                    strokeWidth={1.5}
                  >
                    <animate
                      attributeName="r"
                      values="18;22;18"
                      dur="3s"
                      repeatCount="1"
                    />
                  </circle>
                ) : (
                  <rect
                    x={n.x - 50}
                    y={n.y - 12}
                    width={100}
                    height={24}
                    rx={4}
                    fill={color}
                    fillOpacity={0.12}
                    stroke={color}
                    strokeWidth={1}
                  >
                    <animate
                      attributeName="opacity"
                      values="0;1"
                      dur="0.5s"
                      repeatCount="1"
                    />
                  </rect>
                )}
                <text
                  x={n.x}
                  y={n.y + (isTopic ? 4 : 3)}
                  textAnchor="middle"
                  fill="#e5e7eb"
                  fontSize={isTopic ? 10 : 8}
                  fontFamily="monospace"
                  fontWeight={isTopic ? 600 : 400}
                >
                  {n.label.length > 18 ? n.label.slice(0, 18) + "…" : n.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex flex-col gap-1 text-[10px] font-mono bg-background/80 p-2 rounded border border-border">
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "#60a5fa" }} />
            <span className="text-muted-foreground">Analyst (metrics)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "#f87171" }} />
            <span className="text-muted-foreground">Critic (risks)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "#4ade80" }} />
            <span className="text-muted-foreground">Scout (trends)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: "#c084fc" }} />
            <span className="text-muted-foreground">Synthesizer</span>
          </div>
        </div>
      </div>
    </div>
  );
}
