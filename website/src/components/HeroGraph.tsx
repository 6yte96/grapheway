"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface NodeData {
  id: string;
  label: string;
  sublabel: string;
  badge: string;
  type: "root" | "discovery" | "graph" | "mcp" | "action" | "stream" | "docs" | "compat";
  nx: number; // normalized target position 0..1
  ny: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  log: string;
}

interface EdgeData {
  from: string;
  to: string;
  label: string;
}

const INITIAL_NODES: Omit<NodeData, "x" | "y" | "vx" | "vy" | "width" | "height">[] = [
  {
    id: "root",
    label: "/",
    sublabel: "Site Root",
    badge: "ENTRYPOINT",
    type: "root",
    nx: 0.16,
    ny: 0.48,
    log: "AGENT INSPECT // GET / -> Schema.org JSON-LD graph injected into <head>",
  },
  {
    id: "discovery",
    label: "/.well-known/agent",
    sublabel: "A2A Manifest",
    badge: "DISCOVERY",
    type: "discovery",
    nx: 0.48,
    ny: 0.18,
    log: "AGENT DISCOVERY // GET /.well-known/agent -> 200 OK (capabilities: graph, mcp)",
  },
  {
    id: "graph",
    label: "/graph/v1",
    sublabel: "Typed Graph",
    badge: "GRAPH API",
    type: "graph",
    nx: 0.48,
    ny: 0.52,
    log: "AGENT GRAPH // GET /graph/v1/search?q=install -> 25 pages, 1,927 edges",
  },
  {
    id: "mcp",
    label: "/mcp",
    sublabel: "Model Context",
    badge: "MCP SERVER",
    type: "mcp",
    nx: 0.82,
    ny: 0.22,
    log: "AGENT MCP // POST /mcp tools/list -> spec-aligned tools + markdown resources",
  },
  {
    id: "events",
    label: "/events",
    sublabel: "SSE Stream",
    badge: "REALTIME",
    type: "stream",
    nx: 0.48,
    ny: 0.85,
    log: "AGENT SSE // GET /graph/v1/events -> listening for live graph_patch updates",
  },
  {
    id: "docs",
    label: "/docs/quickstart",
    sublabel: "Markdown Node",
    badge: "RESOURCE",
    type: "docs",
    nx: 0.18,
    ny: 0.82,
    log: "AGENT RESOURCE // resources/read grapheway://docs/quickstart -> 1.4KB markdown",
  },
  {
    id: "action",
    label: "check_status",
    sublabel: "Site Action",
    badge: "TOOL",
    type: "action",
    nx: 0.82,
    ny: 0.72,
    log: "AGENT ACTION // POST /mcp tools/call check_status {\"serial\":\"dev-01\"} -> 200",
  },
  {
    id: "compat",
    label: "/llms.txt",
    sublabel: "Static Fallback",
    badge: "COMPAT",
    type: "compat",
    nx: 0.16,
    ny: 0.18,
    log: "AGENT COMPAT // GET /llms.txt -> legacy static context for fallback bots",
  },
];

const EDGES: EdgeData[] = [
  { from: "root", to: "discovery", label: "exposes" },
  { from: "root", to: "compat", label: "serves" },
  { from: "discovery", to: "graph", label: "declares" },
  { from: "discovery", to: "mcp", label: "declares" },
  { from: "graph", to: "events", label: "streams" },
  { from: "graph", to: "docs", label: "contains" },
  { from: "mcp", to: "action", label: "calls" },
  { from: "docs", to: "action", label: "references" },
];

const ADJACENCY: Record<string, string[]> = {
  root: ["discovery", "compat"],
  discovery: ["graph", "mcp"],
  graph: ["events", "docs"],
  mcp: ["action"],
  docs: ["action"],
  events: ["graph"],
  action: ["mcp"],
  compat: ["root"],
};

function getShortestPath(fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId];
  const queue: string[][] = [[fromId]];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const curr = path[path.length - 1];
    if (curr === toId) return path;

    const neighbors = new Set<string>([
      ...(ADJACENCY[curr] || []),
      ...Object.entries(ADJACENCY)
        .filter(([_, targets]) => targets.includes(curr))
        .map(([source]) => source),
    ]);

    for (const next of neighbors) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [fromId, toId];
}

export function HeroGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeLog, setActiveLog] = useState<string>(
    "AGENT IDLE // knowledge graph loaded (8 nodes, 8 edges) · 0 scraping"
  );
  const [activeHopCount, setActiveHopCount] = useState<number>(0);

  // Mutable animation state
  const stateRef = useRef({
    nodes: [] as NodeData[],
    width: 440,
    height: 350,
    dpr: 1,
    hoveredNodeId: null as string | null,
    draggedNodeId: null as string | null,
    dragStart: { x: 0, y: 0 },
    agent: {
      fromNodeId: "root",
      toNodeId: "discovery",
      progress: 0,
      speed: 0.014,
      pathQueue: ["discovery", "graph", "mcp", "action", "docs", "graph", "events", "root"],
      pulseRing: 0,
    },
    lastInteraction: Date.now(),
  });

  // Initialize or resize nodes
  const initNodes = useCallback((w: number, h: number) => {
    const scale = Math.max(0.72, Math.min(1.05, w / 440));
    const cardW = Math.round(98 * scale);
    const cardH = Math.round(34 * scale);

    stateRef.current.nodes = INITIAL_NODES.map((n) => {
      const existing = stateRef.current.nodes.find((ex) => ex.id === n.id);
      return {
        ...n,
        width: cardW,
        height: cardH,
        x: existing ? existing.x : n.nx * w,
        y: existing ? existing.y : n.ny * h,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0,
      };
    });
  }, []);

  // Trigger automated agent walk
  const walkAgent = useCallback(() => {
    const state = stateRef.current;
    const patrolCycle = ["discovery", "graph", "mcp", "action", "docs", "events", "discovery"];
    const curr = state.agent.toNodeId;
    const nextIndex = (patrolCycle.indexOf(curr) + 1) % patrolCycle.length;
    const target = patrolCycle[nextIndex] || "discovery";

    const path = getShortestPath(curr, target);
    state.agent.pathQueue = path.slice(1);
    setActiveLog(`AGENT DISPATCH // route calculated: ${path.join(" ➔ ")}`);
    state.lastInteraction = Date.now();
  }, []);

  // Reset node positions
  const resetLayout = useCallback(() => {
    const { width, height } = stateRef.current;
    stateRef.current.nodes.forEach((n) => {
      n.x = n.nx * width;
      n.y = n.ny * height;
      n.vx = 0;
      n.vy = 0;
    });
    setActiveLog("OBSERVATORY RESET // equilibrium layout restored");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const g: CanvasRenderingContext2D = ctx;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let running = true;

    function resize() {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.max(300, Math.min(380, Math.floor(w * 0.78)));

      stateRef.current.width = w;
      stateRef.current.height = h;
      stateRef.current.dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(w * stateRef.current.dpr);
      canvas.height = Math.round(h * stateRef.current.dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      initNodes(w, h);
    }

    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(container);
    resize();

    // Palette helper
    function getPalette() {
      const isDark = document.documentElement.classList.contains("dark");
      return {
        isDark,
        bg: isDark ? "#24221f" : "#F2F8FC",
        surface: isDark ? "#302d28" : "#ffffff",
        rule: isDark ? "#F2F8FC" : "#000000",
        ruleSoft: isDark ? "rgba(242, 248, 252, 0.25)" : "rgba(0, 0, 0, 0.22)",
        gridLine: isDark ? "rgba(242, 248, 252, 0.04)" : "rgba(0, 0, 0, 0.04)",
        ink: isDark ? "#F2F8FC" : "#000000",
        inkMuted: isDark ? "rgba(242, 248, 252, 0.65)" : "rgba(0, 0, 0, 0.65)",
        highlightBg: isDark ? "#F2F8FC" : "#000000",
        highlightText: isDark ? "#24221f" : "#F2F8FC",
        accent: isDark ? "#f5b942" : "#000000",
        activeEdge: isDark ? "#f5b942" : "#000000",
      };
    }

    // Geometry helper: rectangle border intersection
    function getRectIntersection(
      cx: number,
      cy: number,
      hw: number,
      hh: number,
      targetX: number,
      targetY: number
    ) {
      const dx = targetX - cx;
      const dy = targetY - cy;
      if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return { x: cx, y: cy };
      const angle = Math.atan2(dy, dx);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const tx = Math.abs(cos) > 0.0001 ? hw / Math.abs(cos) : Infinity;
      const ty = Math.abs(sin) > 0.0001 ? hh / Math.abs(sin) : Infinity;
      const t = Math.min(tx, ty);
      return { x: cx + t * cos, y: cy + t * sin };
    }

    // Physics step
    function updatePhysics() {
      const { nodes, width, height, draggedNodeId } = stateRef.current;
      const k = 0.045; // spring to target
      const damping = 0.72;

      for (const n of nodes) {
        if (n.id === draggedNodeId) continue;

        const targetX = n.nx * width;
        const targetY = n.ny * height;

        // Force toward assigned grid coordinate
        let fx = (targetX - n.x) * k;
        let fy = (targetY - n.y) * k;

        // Repulsion between node boxes
        for (const o of nodes) {
          if (o.id === n.id) continue;
          const dx = n.x - o.x;
          const dy = n.y - o.y;
          const dist = Math.hypot(dx, dy);
          const minDist = (n.width + o.width) * 0.58;
          if (dist < minDist && dist > 0.1) {
            const rep = ((minDist - dist) / dist) * 0.9;
            fx += dx * rep;
            fy += dy * rep;
          }
        }

        n.vx = (n.vx + fx) * damping;
        n.vy = (n.vy + fy) * damping;
        n.x += n.vx;
        n.y += n.vy;

        // Bounds clamping
        const pad = 8;
        n.x = Math.max(n.width / 2 + pad, Math.min(width - n.width / 2 - pad, n.x));
        n.y = Math.max(n.height / 2 + pad, Math.min(height - n.height / 2 - pad, n.y));
      }
    }

    // Agent traversal step
    function updateAgent() {
      const { agent, nodes } = stateRef.current;
      if (agent.pathQueue.length === 0) {
        // Idle patrol timeout: if user has not interacted for 4 seconds, pick next patrol
        if (Date.now() - stateRef.current.lastInteraction > 3800) {
          walkAgent();
        }
        return;
      }

      agent.progress += agent.speed;
      agent.pulseRing = (agent.pulseRing + 0.06) % 1;

      if (agent.progress >= 1) {
        agent.progress = 0;
        agent.fromNodeId = agent.toNodeId;
        const nextTarget = agent.pathQueue.shift();
        if (nextTarget) {
          agent.toNodeId = nextTarget;
          const node = nodes.find((n) => n.id === nextTarget);
          if (node) {
            setActiveLog(node.log);
            setActiveHopCount((prev) => prev + 1);
          }
        }
      }
    }

    // Render step
    function draw() {
      const { nodes, width, height, dpr, hoveredNodeId, agent } = stateRef.current;
      const p = getPalette();

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, width, height);

      // 1. Blueprint grid paper
      g.strokeStyle = p.gridLine;
      g.lineWidth = 1;
      const gridSize = 24;
      g.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        g.moveTo(x, 0);
        g.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        g.moveTo(0, y);
        g.lineTo(width, y);
      }
      g.stroke();

      // Node lookup map
      const nodeMap = new Map<string, NodeData>();
      nodes.forEach((n) => nodeMap.set(n.id, n));

      // 2. Draw Edges
      EDGES.forEach((edge) => {
        const fromNode = nodeMap.get(edge.from);
        const toNode = nodeMap.get(edge.to);
        if (!fromNode || !toNode) return;

        const isTraversing =
          (agent.fromNodeId === edge.from && agent.toNodeId === edge.to) ||
          (agent.fromNodeId === edge.to && agent.toNodeId === edge.from);

        const isHovered =
          hoveredNodeId === edge.from || hoveredNodeId === edge.to;

        // Truncate at card boundaries
        const start = getRectIntersection(
          fromNode.x,
          fromNode.y,
          fromNode.width / 2 + 1,
          fromNode.height / 2 + 1,
          toNode.x,
          toNode.y
        );
        const end = getRectIntersection(
          toNode.x,
          toNode.y,
          toNode.width / 2 + 1,
          toNode.height / 2 + 1,
          fromNode.x,
          fromNode.y
        );

        // Edge line
        g.beginPath();
        g.moveTo(start.x, start.y);
        g.lineTo(end.x, end.y);

        if (isTraversing) {
          g.strokeStyle = p.activeEdge;
          g.lineWidth = 2.2;
        } else if (isHovered) {
          g.strokeStyle = p.rule;
          g.lineWidth = 1.6;
        } else {
          g.strokeStyle = p.ruleSoft;
          g.lineWidth = 1;
        }
        g.stroke();

        // Arrowhead at endpoint
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const arrowSize = 5;
        g.fillStyle = isTraversing ? p.activeEdge : isHovered ? p.rule : p.ruleSoft;
        g.beginPath();
        g.moveTo(end.x, end.y);
        g.lineTo(
          end.x - arrowSize * Math.cos(angle - Math.PI / 6),
          end.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        g.lineTo(
          end.x - arrowSize * Math.cos(angle + Math.PI / 6),
          end.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        g.closePath();
        g.fill();

        // Edge label tag at midpoint
        const midX = (start.x + end.x) / 2;
        const midY = (start.y + end.y) / 2;
        g.font = "8px 'Space Mono', monospace";
        const labelW = g.measureText(edge.label).width + 6;
        const labelH = 12;

        g.fillStyle = p.bg;
        g.fillRect(midX - labelW / 2, midY - labelH / 2, labelW, labelH);
        g.strokeStyle = isTraversing ? p.activeEdge : p.ruleSoft;
        g.lineWidth = 0.8;
        g.strokeRect(midX - labelW / 2, midY - labelH / 2, labelW, labelH);

        g.fillStyle = isTraversing ? p.ink : p.inkMuted;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(edge.label, midX, midY + 0.5);
      });

      // 3. Draw Agent traversal pulse
      if (!reduced) {
        const fromNode = nodeMap.get(agent.fromNodeId);
        const toNode = nodeMap.get(agent.toNodeId);
        if (fromNode && toNode) {
          const start = getRectIntersection(
            fromNode.x,
            fromNode.y,
            fromNode.width / 2,
            fromNode.height / 2,
            toNode.x,
            toNode.y
          );
          const end = getRectIntersection(
            toNode.x,
            toNode.y,
            toNode.width / 2,
            toNode.height / 2,
            fromNode.x,
            fromNode.y
          );

          const curX = start.x + (end.x - start.x) * agent.progress;
          const curY = start.y + (end.y - start.y) * agent.progress;

          // Expanding pulse radar ring
          const ringR = 4 + 10 * agent.pulseRing;
          g.beginPath();
          g.arc(curX, curY, ringR, 0, Math.PI * 2);
          g.strokeStyle = `rgba(${p.isDark ? "245, 185, 66" : "0, 0, 0"}, ${1 - agent.pulseRing})`;
          g.lineWidth = 1.2;
          g.stroke();

          // Core agent bead
          g.beginPath();
          g.arc(curX, curY, 3.8, 0, Math.PI * 2);
          g.fillStyle = p.highlightBg;
          g.fill();
          g.strokeStyle = p.highlightText;
          g.lineWidth = 1;
          g.stroke();
        }
      }

      // 4. Draw Nodes
      nodes.forEach((n) => {
        const isHovered = hoveredNodeId === n.id;
        const isAgentHere = agent.toNodeId === n.id;
        const left = n.x - n.width / 2;
        const top = n.y - n.height / 2;

        // Card shadow / border cage
        g.fillStyle = isHovered ? p.highlightBg : p.surface;
        g.fillRect(left, top, n.width, n.height);

        g.strokeStyle = isHovered ? p.highlightBg : isAgentHere ? p.activeEdge : p.rule;
        g.lineWidth = isAgentHere ? 1.8 : 1;
        g.strokeRect(left, top, n.width, n.height);

        // Badge line (Space Mono 8px)
        g.font = "bold 7.5px 'Space Mono', monospace";
        g.fillStyle = isHovered ? p.highlightText : p.inkMuted;
        g.textAlign = "left";
        g.textBaseline = "top";
        g.fillText(n.badge, left + 6, top + 5);

        // Label line (Space Mono 9.5px)
        g.font = "bold 9.5px 'Space Mono', monospace";
        g.fillStyle = isHovered ? p.highlightText : p.ink;
        g.fillText(n.label, left + 6, top + 17);

        // Live beacon dot on active node
        if (isAgentHere) {
          g.beginPath();
          g.arc(left + n.width - 7, top + 7, 2.5, 0, Math.PI * 2);
          g.fillStyle = p.isDark ? "#f5b942" : "#10b981";
          g.fill();
        }
      });
    }

    function frame() {
      if (running) {
        if (!reduced) {
          updatePhysics();
          updateAgent();
        }
        draw();
      }
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    // Pointer events (interactive drag & hover)
    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const { nodes, draggedNodeId } = stateRef.current;

      if (draggedNodeId) {
        const node = nodes.find((n) => n.id === draggedNodeId);
        if (node) {
          node.x = px;
          node.y = py;
          node.vx = 0;
          node.vy = 0;
        }
        return;
      }

      // Check hover
      let hovered: NodeData | null = null;
      for (const n of nodes) {
        if (
          px >= n.x - n.width / 2 &&
          px <= n.x + n.width / 2 &&
          py >= n.y - n.height / 2 &&
          py <= n.y + n.height / 2
        ) {
          hovered = n;
          break;
        }
      }

      stateRef.current.hoveredNodeId = hovered ? hovered.id : null;
      canvas.style.cursor = hovered ? "pointer" : "default";

      if (hovered) {
        setActiveLog(hovered.log);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const { nodes } = stateRef.current;
      for (const n of nodes) {
        if (
          px >= n.x - n.width / 2 &&
          px <= n.x + n.width / 2 &&
          py >= n.y - n.height / 2 &&
          py <= n.y + n.height / 2
        ) {
          stateRef.current.draggedNodeId = n.id;
          stateRef.current.dragStart = { x: px, y: py };
          canvas.setPointerCapture(e.pointerId);
          stateRef.current.lastInteraction = Date.now();
          break;
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const { draggedNodeId, dragStart, nodes } = stateRef.current;
      if (draggedNodeId) {
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const dist = Math.hypot(px - dragStart.x, py - dragStart.y);

        // If clicked with minimal movement, navigate agent to that node!
        if (dist < 6) {
          const targetNode = nodes.find((n) => n.id === draggedNodeId);
          if (targetNode) {
            const currentAgent = stateRef.current.agent.toNodeId;
            const path = getShortestPath(currentAgent, targetNode.id);
            stateRef.current.agent.pathQueue = path.slice(1);
            setActiveLog(
              `AGENT TRAVERSAL // shortest path: ${path.join(" ➔ ")}`
            );
          }
        }

        stateRef.current.draggedNodeId = null;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {}
      }
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    // Tab visibility handling
    const onVisibility = () => {
      running = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [initNodes, walkAgent]);

  return (
    <div className="hero-graph-card" ref={containerRef}>
      {/* Header bar */}
      <div className="hero-graph-header">
        <div className="hero-graph-header-left">
          <span className="hero-graph-pulse-dot" />
          <span className="hero-graph-header-title">
            OBSERVATORY // LIVE AGENT SURFACE
          </span>
        </div>
        <div className="hero-graph-header-actions">
          <button
            type="button"
            onClick={walkAgent}
            className="hero-graph-btn"
            title="Simulate an agent traversing the knowledge graph"
          >
            WALK GRAPH
          </button>
          <button
            type="button"
            onClick={resetLayout}
            className="hero-graph-btn"
            title="Reset node positions"
          >
            RESET
          </button>
        </div>
      </div>

      {/* Canvas container */}
      <div className="hero-graph-canvas-wrap">
        <canvas ref={canvasRef} className="hero-graph-canvas" />
      </div>

      {/* Terminal log ticker */}
      <div className="hero-graph-footer">
        <span className="hero-graph-prompt">$</span>
        <span className="hero-graph-log" title={activeLog}>
          {activeLog}
        </span>
        <span className="hero-graph-hops">
          {activeHopCount} HOPS
        </span>
      </div>
    </div>
  );
}
