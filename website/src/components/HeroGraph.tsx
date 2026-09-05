"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

export type NodeCategory =
  | "discovery"
  | "mcp"
  | "graph"
  | "actions"
  | "content"
  | "compat";

export interface GraphNode {
  id: string;
  uri: string;
  label: string;
  badge: string;
  glyph: string;
  category: NodeCategory;
  isHub: boolean;
  radius: number;
  nx: number; // 0..1 normalized base coordinate
  ny: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  module: string;
  protocol: string;
  description: string;
  log: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  type: "declares" | "exposes" | "streams" | "calls" | "contains" | "serves" | "references" | "method" | "links_to";
}

const RAW_NODES: Omit<GraphNode, "x" | "y" | "vx" | "vy" | "phase">[] = [
  // Cluster 1: Discovery & Entrypoint (Top-Center)
  {
    id: "root",
    uri: "/",
    label: "/",
    badge: "SITE ROOT",
    glyph: "◈",
    category: "discovery",
    isHub: true,
    radius: 15,
    nx: 0.28,
    ny: 0.20,
    module: "core/jsonld.ts",
    protocol: "HTTP/2 GET",
    description: "Root HTML page. Injects Schema.org JSON-LD & GEO graph metadata into <head>.",
    log: "DISCOVERY // GET / -> Injected 3 JSON-LD graph objects (Organization, WebSite, WebPage)",
  },
  {
    id: "agent_card",
    uri: "/.well-known/agent",
    label: "/.well-known/agent",
    badge: "A2A CARD",
    glyph: "⚲",
    category: "discovery",
    isHub: true,
    radius: 15,
    nx: 0.50,
    ny: 0.16,
    module: "core/manifest.ts",
    protocol: "A2A Standard",
    description: "Machine discovery card telling any AI agent what the site exposes and where.",
    log: "A2A DISCOVERY // GET /.well-known/agent -> 200 OK (capabilities: graph, mcp, search)",
  },
  {
    id: "manifest",
    uri: "/agent",
    label: "/agent",
    badge: "MANIFEST",
    glyph: "▤",
    category: "discovery",
    isHub: false,
    radius: 7,
    nx: 0.68,
    ny: 0.14,
    module: "web/handler.ts",
    protocol: "JSON API",
    description: "Full site manifest listing 14 routes, sections, and declared action schemas.",
    log: "MANIFEST // GET /agent -> 14 endpoints verified, 4 built-in actions declared",
  },
  {
    id: "agent_info",
    uri: "/agent/info",
    label: "/agent/info",
    badge: "METADATA",
    glyph: "ⓘ",
    category: "discovery",
    isHub: false,
    radius: 7,
    nx: 0.82,
    ny: 0.13,
    module: "web/handler.ts",
    protocol: "JSON API",
    description: "Site metadata: name, tagline, author handle, and version telemetry.",
    log: "AGENT API // GET /agent/info -> { name: 'grapheway', version: 'v0.2.2' }",
  },

  // Cluster 2: Knowledge Graph (Core Center)
  {
    id: "graph_hub",
    uri: "/graph/v1",
    label: "/graph/v1",
    badge: "GRAPH ENGINE",
    glyph: "⌬",
    category: "graph",
    isHub: true,
    radius: 17,
    nx: 0.50,
    ny: 0.46,
    module: "core/graph.ts",
    protocol: "Directed Graph",
    description: "In-memory typed directed graph engine with provenance tracking and diffing.",
    log: "GRAPH ENGINE // GET /graph/v1 -> summary: 25 pages, 521 headings, 1,927 edges",
  },
  {
    id: "graph_node",
    uri: "/graph/v1/node",
    label: "node:lookup",
    badge: "NODE",
    glyph: "•",
    category: "graph",
    isHub: false,
    radius: 7,
    nx: 0.36,
    ny: 0.38,
    module: "core/graph.ts",
    protocol: "GET /node",
    description: "Look up any node by URI/ID. Returns properties, labels, and provenance tags.",
    log: "GRAPH QUERY // GET /graph/v1/node?id=/docs/quickstart -> 200 OK (node_type: page)",
  },
  {
    id: "graph_edges",
    uri: "/graph/v1/edges",
    label: "graph:neighbors",
    badge: "NEIGHBORS",
    glyph: "•",
    category: "graph",
    isHub: false,
    radius: 7,
    nx: 0.35,
    ny: 0.56,
    module: "core/graph-query.ts",
    protocol: "GET /edges",
    description: "Traverse incoming and outgoing edges with auditable provenance metadata.",
    log: "GRAPH TRAVERSAL // GET /graph/v1/edges?id=root -> 12 outbound typed edges",
  },
  {
    id: "graph_search",
    uri: "/graph/v1/search",
    label: "graph:search",
    badge: "SEARCH",
    glyph: "•",
    category: "graph",
    isHub: false,
    radius: 7,
    nx: 0.45,
    ny: 0.62,
    module: "core/graph-query.ts",
    protocol: "GET /search",
    description: "Lexical & semantic search over node titles, descriptions, and page text.",
    log: "GRAPH SEARCH // GET /graph/v1/search?q=mcp -> 4 matching nodes found (0 scraping)",
  },
  {
    id: "graph_path",
    uri: "/graph/v1/path",
    label: "graph:path",
    badge: "SHORTEST PATH",
    glyph: "•",
    category: "graph",
    isHub: false,
    radius: 7,
    nx: 0.60,
    ny: 0.59,
    module: "core/graph-query.ts",
    protocol: "GET /path",
    description: "Computes the shortest auditable path between any two nodes across typed edges.",
    log: "GRAPH PATH // GET /graph/v1/path?from=/&to=check_status -> 3 hops (auditable)",
  },
  {
    id: "graph_dump",
    uri: "/graph/v1/dump",
    label: "graph:dump",
    badge: "EXPORT",
    glyph: "•",
    category: "graph",
    isHub: false,
    radius: 7,
    nx: 0.65,
    ny: 0.46,
    module: "core/graph.ts",
    protocol: "GET /dump",
    description: "Full JSON snapshot of nodes, edges, version timestamp, and checksums.",
    log: "GRAPH DUMP // GET /graph/v1/dump -> exported 1,927 edges in 12ms",
  },
  {
    id: "graph_events",
    uri: "/graph/v1/events",
    label: "SSE /events",
    badge: "STREAM",
    glyph: "≈",
    category: "graph",
    isHub: true,
    radius: 12,
    nx: 0.48,
    ny: 0.76,
    module: "web/handler.ts",
    protocol: "text/event-stream",
    description: "Live Server-Sent Events stream delivering graph mutations (add_node, add_edge).",
    log: "REALTIME SSE // GET /graph/v1/events -> connection active (subscribers: 1)",
  },

  // Cluster 3: Model Context Protocol (Right)
  {
    id: "mcp_hub",
    uri: "/mcp",
    label: "/mcp",
    badge: "MCP GATEWAY",
    glyph: "⚡",
    category: "mcp",
    isHub: true,
    radius: 16,
    nx: 0.76,
    ny: 0.34,
    module: "web/mcp.ts",
    protocol: "JSON-RPC 2.0",
    description: "Model Context Protocol endpoint for Claude Desktop, Cursor, and VS Code.",
    log: "MCP SERVER // POST /mcp initialize -> protocolVersion: '2024-11-05', tools: ready",
  },
  {
    id: "mcp_tools_list",
    uri: "/mcp#tools/list",
    label: "tools/list",
    badge: "TOOLS",
    glyph: "•",
    category: "mcp",
    isHub: false,
    radius: 7,
    nx: 0.90,
    ny: 0.28,
    module: "web/mcp.ts",
    protocol: "JSON-RPC",
    description: "Publishes all site actions and graph queries as native MCP tools.",
    log: "MCP DISCOVERY // POST /mcp tools/list -> graph_node, graph_search, check_status",
  },
  {
    id: "mcp_tools_call",
    uri: "/mcp#tools/call",
    label: "tools/call",
    badge: "EXECUTE",
    glyph: "•",
    category: "mcp",
    isHub: false,
    radius: 7,
    nx: 0.91,
    ny: 0.42,
    module: "web/mcp.ts",
    protocol: "JSON-RPC",
    description: "Executes tools with JSON schema validation. Bridges HTTP & MCP surfaces.",
    log: "MCP EXECUTE // POST /mcp tools/call { name: 'graph_node' } -> 200 OK",
  },
  {
    id: "mcp_resources",
    uri: "/mcp#resources/list",
    label: "res/list",
    badge: "RESOURCES",
    glyph: "•",
    category: "mcp",
    isHub: false,
    radius: 7,
    nx: 0.90,
    ny: 0.56,
    module: "web/mcp.ts",
    protocol: "JSON-RPC",
    description: "Registers site pages and markdown documentation as native MCP resources.",
    log: "MCP RESOURCES // POST /mcp resources/list -> 25 page resources available",
  },
  {
    id: "mcp_read",
    uri: "/mcp#resources/read",
    label: "res/read",
    badge: "STREAM",
    glyph: "•",
    category: "mcp",
    isHub: false,
    radius: 7,
    nx: 0.77,
    ny: 0.60,
    module: "web/mcp.ts",
    protocol: "JSON-RPC",
    description: "Fetches clean, markdown-converted content for any graph page node.",
    log: "MCP READ // POST /mcp resources/read grapheway://docs/quickstart -> 1.4KB md",
  },

  // Cluster 4: Actions & Endpoints (Bottom-Right)
  {
    id: "act_status",
    uri: "action:check_status",
    label: "check_status",
    badge: "TOOL ACTION",
    glyph: "⚙",
    category: "actions",
    isHub: true,
    radius: 14,
    nx: 0.82,
    ny: 0.76,
    module: "web/actions.ts",
    protocol: "Typed Action",
    description: "Executable site action: probes online status of hardware device by serial.",
    log: "ACTION CALL // check_status({ serial: 'DEV-884' }) -> { online: true, latency: 14ms }",
  },
  {
    id: "act_query",
    uri: "action:query_inventory",
    label: "query_inventory",
    badge: "ACTION TOOL",
    glyph: "•",
    category: "actions",
    isHub: false,
    radius: 7,
    nx: 0.68,
    ny: 0.82,
    module: "web/actions.ts",
    protocol: "Typed Action",
    description: "Executes structured query against inventory with price and category filters.",
    log: "ACTION CALL // query_inventory({ category: 'sensors' }) -> 8 items returned",
  },
  {
    id: "endpoint_api",
    uri: "/api/v1/devices",
    label: "/api/devices",
    badge: "REST API",
    glyph: "•",
    category: "actions",
    isHub: false,
    radius: 7,
    nx: 0.85,
    ny: 0.90,
    module: "probe/crawler.ts",
    protocol: "OpenAPI 3.1",
    description: "REST endpoint discovered automatically during probe crawler pass.",
    log: "OPENAPI // discovered endpoint GET /api/v1/devices from /openapi.json",
  },
  {
    id: "endpoint_spec",
    uri: "/openapi.json",
    label: "openapi.json",
    badge: "SPEC",
    glyph: "•",
    category: "actions",
    isHub: false,
    radius: 7,
    nx: 0.70,
    ny: 0.94,
    module: "probe/crawler.ts",
    protocol: "JSON Schema",
    description: "OpenAPI specification converted into typed endpoints and edge schemas.",
    log: "SCHEMA // parsed openapi.json: 12 endpoints, 6 schemas mapped to graph",
  },

  // Cluster 5: Pages & Content (Left / Bottom-Left)
  {
    id: "doc_quickstart",
    uri: "/docs/quickstart",
    label: "/quickstart",
    badge: "DOC NODE",
    glyph: "§",
    category: "content",
    isHub: true,
    radius: 13,
    nx: 0.17,
    ny: 0.44,
    module: "probe/html.ts",
    protocol: "Markdown Node",
    description: "Quickstart guide. Headings & code snippets parsed into typed section nodes.",
    log: "CONTENT // resolved /docs/quickstart (markdown: 1.4KB, headings: 6)",
  },
  {
    id: "doc_install",
    uri: "/docs/install",
    label: "/install",
    badge: "PAGE",
    glyph: "•",
    category: "content",
    isHub: false,
    radius: 7,
    nx: 0.13,
    ny: 0.60,
    module: "probe/html.ts",
    protocol: "Markdown Node",
    description: "Installation documentation: Bun, Node, Deno package manager instructions.",
    log: "CONTENT // node /docs/install has 3 edges (contains: install-bun, install-npm)",
  },
  {
    id: "doc_arch",
    uri: "/docs/architecture",
    label: "/architecture",
    badge: "PAGE",
    glyph: "•",
    category: "content",
    isHub: false,
    radius: 7,
    nx: 0.18,
    ny: 0.75,
    module: "probe/html.ts",
    protocol: "Markdown Node",
    description: "System architecture whitepaper detailing the 6 subpath modules.",
    log: "CONTENT // node /docs/architecture linked from 8 other documentation nodes",
  },
  {
    id: "doc_adapters",
    uri: "/docs/adapters",
    label: "/adapters",
    badge: "PAGE",
    glyph: "•",
    category: "content",
    isHub: false,
    radius: 7,
    nx: 0.32,
    ny: 0.74,
    module: "web/adapters.ts",
    protocol: "Markdown Node",
    description: "Guide on framework adapters for Node http, Express, and Hono.",
    log: "CONTENT // node /docs/adapters defines toExpressHandler & toHonoHandler",
  },

  // Cluster 6: Compat (Top-Left)
  {
    id: "compat_llms",
    uri: "/llms.txt",
    label: "llms.txt",
    badge: "LLMS.TXT",
    glyph: "☷",
    category: "compat",
    isHub: true,
    radius: 13,
    nx: 0.12,
    ny: 0.16,
    module: "compat/llms-txt.ts",
    protocol: "RFC Draft",
    description: "Curated markdown table of contents for LLM retrieval bots.",
    log: "COMPAT // GET /llms.txt -> 200 OK (25 curated documentation links)",
  },
  {
    id: "compat_full",
    uri: "/llms-full.txt",
    label: "llms-full.txt",
    badge: "FULL CONTEXT",
    glyph: "•",
    category: "compat",
    isHub: false,
    radius: 7,
    nx: 0.10,
    ny: 0.29,
    module: "compat/llms-txt.ts",
    protocol: "Text Bundle",
    description: "All site pages inlined into one continuous context text bundle.",
    log: "COMPAT // GET /llms-full.txt -> generated 48KB markdown context bundle",
  },
  {
    id: "compat_robots",
    uri: "/robots.txt",
    label: "robots.txt",
    badge: "ROBOTS",
    glyph: "•",
    category: "compat",
    isHub: false,
    radius: 7,
    nx: 0.22,
    ny: 0.08,
    module: "compat/robots.ts",
    protocol: "Robots Protocol",
    description: "Granular permissions: allows search & retrieval bots, blocks AI training scrapers.",
    log: "COMPAT // GET /robots.txt -> blocks GPTBot, allows Claude-Web & Google-Extended",
  },
  {
    id: "compat_sitemap",
    uri: "/sitemap.xml",
    label: "sitemap.xml",
    badge: "SITEMAP",
    glyph: "•",
    category: "compat",
    isHub: false,
    radius: 7,
    nx: 0.36,
    ny: 0.06,
    module: "compat/sitemap.ts",
    protocol: "XML Sitemap",
    description: "URL index generated at runtime from the live knowledge graph nodes.",
    log: "COMPAT // GET /sitemap.xml -> 25 URLs indexed with priority scores",
  },
];

const RAW_EDGES: GraphEdge[] = [
  // Discovery links
  { from: "root", to: "agent_card", label: "exposes", type: "exposes" },
  { from: "root", to: "doc_quickstart", label: "links_to", type: "links_to" },
  { from: "root", to: "compat_llms", label: "serves", type: "serves" },
  { from: "root", to: "compat_robots", label: "serves", type: "serves" },
  { from: "agent_card", to: "manifest", label: "resolves", type: "declares" },
  { from: "agent_card", to: "mcp_hub", label: "declares", type: "declares" },
  { from: "agent_card", to: "graph_hub", label: "declares", type: "declares" },
  { from: "manifest", to: "agent_info", label: "contains", type: "contains" },

  // Graph Core links
  { from: "graph_hub", to: "graph_node", label: "queries", type: "contains" },
  { from: "graph_hub", to: "graph_edges", label: "queries", type: "contains" },
  { from: "graph_hub", to: "graph_search", label: "queries", type: "contains" },
  { from: "graph_hub", to: "graph_path", label: "queries", type: "contains" },
  { from: "graph_hub", to: "graph_dump", label: "exports", type: "contains" },
  { from: "graph_hub", to: "graph_events", label: "streams", type: "streams" },
  { from: "graph_hub", to: "doc_quickstart", label: "indexes", type: "references" },
  { from: "graph_hub", to: "doc_install", label: "indexes", type: "references" },
  { from: "graph_hub", to: "doc_arch", label: "indexes", type: "references" },
  { from: "graph_hub", to: "doc_adapters", label: "indexes", type: "references" },

  // MCP links
  { from: "mcp_hub", to: "mcp_tools_list", label: "method", type: "method" },
  { from: "mcp_hub", to: "mcp_tools_call", label: "method", type: "method" },
  { from: "mcp_hub", to: "mcp_resources", label: "method", type: "method" },
  { from: "mcp_hub", to: "mcp_read", label: "method", type: "method" },
  { from: "mcp_tools_call", to: "act_status", label: "dispatches", type: "calls" },
  { from: "mcp_tools_call", to: "act_query", label: "dispatches", type: "calls" },
  { from: "mcp_tools_call", to: "graph_node", label: "bridges", type: "calls" },
  { from: "mcp_tools_call", to: "graph_path", label: "bridges", type: "calls" },
  { from: "mcp_resources", to: "doc_quickstart", label: "exposes", type: "references" },
  { from: "mcp_resources", to: "doc_install", label: "exposes", type: "references" },
  { from: "mcp_resources", to: "doc_arch", label: "exposes", type: "references" },
  { from: "mcp_read", to: "doc_quickstart", label: "resolves", type: "streams" },

  // Action & API links
  { from: "act_status", to: "endpoint_api", label: "executes", type: "calls" },
  { from: "endpoint_api", to: "endpoint_spec", label: "defines", type: "declares" },
  { from: "doc_quickstart", to: "act_status", label: "references", type: "references" },

  // Documentation links
  { from: "doc_quickstart", to: "doc_install", label: "links_to", type: "links_to" },
  { from: "doc_install", to: "doc_adapters", label: "links_to", type: "links_to" },
  { from: "doc_adapters", to: "doc_arch", label: "links_to", type: "links_to" },

  // Compat links
  { from: "compat_llms", to: "compat_full", label: "extends", type: "references" },
  { from: "compat_llms", to: "compat_sitemap", label: "references", type: "references" },
  { from: "compat_robots", to: "compat_sitemap", label: "references", type: "references" },
];

function findShortestPath(fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId];
  const adj = new Map<string, Set<string>>();
  RAW_EDGES.forEach((e) => {
    if (!adj.has(e.from)) adj.set(e.from, new Set());
    if (!adj.has(e.to)) adj.set(e.to, new Set());
    adj.get(e.from)!.add(e.to);
    adj.get(e.to)!.add(e.from);
  });

  const queue: string[][] = [[fromId]];
  const visited = new Set<string>([fromId]);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const curr = path[path.length - 1];
    if (curr === toId) return path;

    const neighbors = adj.get(curr) || new Set();
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push([...path, n]);
      }
    }
  }
  return [fromId, toId];
}

export function HeroGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeCategory, setActiveCategory] = useState<"all" | NodeCategory>("all");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activeLog, setActiveLog] = useState<string>(
    "OBSERVATORY // 28 typed nodes, 44 edges · full agent surface active"
  );
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mutable animation state
  const stateRef = useRef({
    nodes: [] as GraphNode[],
    width: 520,
    height: 460,
    dpr: 1,
    zoom: 1,
    pan: { x: 0, y: 0 },
    hoveredNodeId: null as string | null,
    draggedNodeId: null as string | null,
    dragStart: { x: 0, y: 0 },
    isPanning: false,
    panStart: { x: 0, y: 0 },
    isPaused: false,
    agent: {
      fromNodeId: "root",
      toNodeId: "agent_card",
      progress: 0,
      // Calm, stately speed: ~4-5 seconds per edge transition
      speed: 0.0034,
      pathQueue: [
        "agent_card",
        "mcp_hub",
        "mcp_tools_call",
        "act_status",
        "endpoint_api",
        "graph_hub",
        "graph_search",
        "doc_quickstart",
        "graph_events",
        "root",
      ],
      ring: 0,
      tailHistory: [] as { x: number; y: number }[],
    },
    time: 0,
    lastInteraction: Date.now(),
  });

  stateRef.current.zoom = zoom;
  stateRef.current.pan = pan;
  stateRef.current.isPaused = isPaused;

  const initNodes = useCallback((w: number, h: number) => {
    stateRef.current.nodes = RAW_NODES.map((rn, idx) => {
      const existing = stateRef.current.nodes.find((n) => n.id === rn.id);
      return {
        ...rn,
        x: existing ? existing.x : rn.nx * w,
        y: existing ? existing.y : rn.ny * h,
        vx: existing ? existing.vx : 0,
        vy: existing ? existing.vy : 0,
        phase: idx * 0.45,
      };
    });
  }, []);

  const dispatchAgentTo = useCallback((targetId: string) => {
    const current = stateRef.current.agent.toNodeId;
    const path = findShortestPath(current, targetId);
    stateRef.current.agent.pathQueue = path.slice(1);
    setActiveLog(`AGENT TRAVERSAL // routing: ${path.join(" ➔ ")}`);
    stateRef.current.lastInteraction = Date.now();
  }, []);

  const walkAgent = useCallback(() => {
    const patrol = [
      "agent_card",
      "mcp_hub",
      "mcp_tools_call",
      "act_status",
      "graph_hub",
      "graph_search",
      "doc_quickstart",
      "graph_events",
      "compat_llms",
      "root",
    ];
    const curr = stateRef.current.agent.toNodeId;
    const nextIdx = (patrol.indexOf(curr) + 1) % patrol.length;
    dispatchAgentTo(patrol[nextIdx] || "agent_card");
  }, [dispatchAgentTo]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    const { width, height } = stateRef.current;
    stateRef.current.nodes.forEach((n) => {
      n.x = n.nx * width;
      n.y = n.ny * height;
      n.vx = 0;
      n.vy = 0;
    });
    setSelectedNode(null);
    setActiveLog("OBSERVATORY RESET // canvas centered, equilibrium restored");
  }, []);

  // Main Canvas Render Loop
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
      const w = Math.max(300, Math.floor(rect.width));
      const h = Math.max(380, Math.min(520, Math.floor(w * 0.88)));

      stateRef.current.width = w;
      stateRef.current.height = h;
      stateRef.current.dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(w * stateRef.current.dpr);
      canvas.height = Math.round(h * stateRef.current.dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      initNodes(w, h);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // Color tokens
    function getPalette() {
      const isDark = document.documentElement.classList.contains("dark");
      return {
        isDark,
        bg: isDark ? "#1b1916" : "#F2F8FC",
        surface: isDark ? "#282420" : "#ffffff",
        rule: isDark ? "#F2F8FC" : "#000000",
        ruleSoft: isDark ? "rgba(242, 248, 252, 0.16)" : "rgba(0, 0, 0, 0.14)",
        gridLine: isDark ? "rgba(242, 248, 252, 0.035)" : "rgba(0, 0, 0, 0.038)",
        gridAccent: isDark ? "rgba(242, 248, 252, 0.07)" : "rgba(0, 0, 0, 0.07)",
        ink: isDark ? "#F2F8FC" : "#000000",
        inkMuted: isDark ? "rgba(242, 248, 252, 0.65)" : "rgba(0, 0, 0, 0.62)",
        highlightBg: isDark ? "#F2F8FC" : "#000000",
        highlightText: isDark ? "#24221f" : "#F2F8FC",
        amber: isDark ? "#f5b942" : "#b45309",
        amberRgb: isDark ? "245, 185, 66" : "0, 0, 0",
        cyan: isDark ? "#38bdf8" : "#0284c7",
        violet: isDark ? "#a78bfa" : "#7c3aed",
        emerald: isDark ? "#34d399" : "#059669",
      };
    }

    // Gentle organic floating drift (zero harsh vibration)
    function updatePhysics() {
      const { nodes, width, height, draggedNodeId, time } = stateRef.current;
      const k = 0.025;
      const damping = 0.88;

      for (const n of nodes) {
        if (n.id === draggedNodeId) continue;

        // Base target plus calm harmonic breathing
        const floatX = Math.cos(time * 0.0012 + n.phase) * 1.5;
        const floatY = Math.sin(time * 0.0014 + n.phase) * 1.5;

        const targetX = n.nx * width + floatX;
        const targetY = n.ny * height + floatY;

        let fx = (targetX - n.x) * k;
        let fy = (targetY - n.y) * k;

        n.vx = (n.vx + fx) * damping;
        n.vy = (n.vy + fy) * damping;
        n.x += n.vx;
        n.y += n.vy;

        // Clamping
        n.x = Math.max(n.radius + 6, Math.min(width - n.radius - 6, n.x));
        n.y = Math.max(n.radius + 6, Math.min(height - n.radius - 6, n.y));
      }
    }

    // Calm agent traversal
    function updateAgent() {
      const { agent, nodes } = stateRef.current;

      if (agent.pathQueue.length === 0) {
        // Idle patrol: wait 4.5 seconds before next stately hop
        if (Date.now() - stateRef.current.lastInteraction > 4500) {
          walkAgent();
        }
        return;
      }

      agent.progress += agent.speed;
      agent.ring = (agent.ring + 0.008) % 1;

      if (agent.progress >= 1) {
        agent.progress = 0;
        agent.fromNodeId = agent.toNodeId;
        const next = agent.pathQueue.shift();
        if (next) {
          agent.toNodeId = next;
          const n = nodes.find((node) => node.id === next);
          if (n) {
            setActiveLog(n.log);
          }
        }
      }
    }

    // Render Canvas
    function draw() {
      const { nodes, width, height, dpr, hoveredNodeId, agent, zoom: z, pan: pPos } = stateRef.current;
      const p = getPalette();

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, width, height);

      // Save for zoom/pan
      g.save();
      g.translate(width / 2 + pPos.x, height / 2 + pPos.y);
      g.scale(z, z);
      g.translate(-width / 2, -height / 2);

      // 1. Engineering grid paper
      const grid = 28;
      g.beginPath();
      for (let x = -width; x <= width * 2; x += grid) {
        g.strokeStyle = x % 112 === 0 ? p.gridAccent : p.gridLine;
        g.lineWidth = x % 112 === 0 ? 1 : 0.6;
        g.moveTo(x, -height);
        g.lineTo(x, height * 2);
      }
      for (let y = -height; y <= height * 2; y += grid) {
        g.strokeStyle = y % 112 === 0 ? p.gridAccent : p.gridLine;
        g.lineWidth = y % 112 === 0 ? 1 : 0.6;
        g.moveTo(-width, y);
        g.lineTo(width * 2, y);
      }
      g.stroke();

      const nodeMap = new Map<string, GraphNode>();
      nodes.forEach((n) => nodeMap.set(n.id, n));

      // 2. Draw Edges
      RAW_EDGES.forEach((edge) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) return;

        const isTraversing =
          (agent.fromNodeId === edge.from && agent.toNodeId === edge.to) ||
          (agent.fromNodeId === edge.to && agent.toNodeId === edge.from);

        const isDimmed =
          activeCategory !== "all" &&
          from.category !== activeCategory &&
          to.category !== activeCategory;

        const isHovered = hoveredNodeId === edge.from || hoveredNodeId === edge.to;

        // Vector calculations
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 0.1) return;

        const startX = from.x + (dx / dist) * from.radius;
        const startY = from.y + (dy / dist) * from.radius;
        const endX = to.x - (dx / dist) * to.radius;
        const endY = to.y - (dy / dist) * to.radius;

        g.beginPath();
        g.moveTo(startX, startY);
        g.lineTo(endX, endY);

        if (isTraversing) {
          g.strokeStyle = p.isDark ? "#f5b942" : "#000000";
          g.lineWidth = 2.2;
        } else if (isHovered) {
          g.strokeStyle = p.rule;
          g.lineWidth = 1.5;
        } else if (isDimmed) {
          g.strokeStyle = p.isDark ? "rgba(242, 248, 252, 0.04)" : "rgba(0, 0, 0, 0.04)";
          g.lineWidth = 0.6;
        } else {
          g.strokeStyle = p.ruleSoft;
          g.lineWidth = 0.9;
        }
        g.stroke();

        // Arrowhead
        if (!isDimmed) {
          const angle = Math.atan2(dy, dx);
          const arrowLen = 4;
          g.fillStyle = isTraversing ? (p.isDark ? "#f5b942" : "#000000") : isHovered ? p.rule : p.ruleSoft;
          g.beginPath();
          g.moveTo(endX, endY);
          g.lineTo(endX - arrowLen * Math.cos(angle - Math.PI / 6), endY - arrowLen * Math.sin(angle - Math.PI / 6));
          g.lineTo(endX - arrowLen * Math.cos(angle + Math.PI / 6), endY - arrowLen * Math.sin(angle + Math.PI / 6));
          g.closePath();
          g.fill();
        }
      });

      // 3. Draw Agent Traversal Comet (Gliding Luminous Trail)
      if (!reduced) {
        const from = nodeMap.get(agent.fromNodeId);
        const to = nodeMap.get(agent.toNodeId);
        if (from && to) {
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.hypot(dx, dy);

          const startX = from.x + (dx / dist) * from.radius;
          const startY = from.y + (dy / dist) * from.radius;
          const endX = to.x - (dx / dist) * to.radius;
          const endY = to.y - (dy / dist) * to.radius;

          // Luminous comet head position
          const curX = startX + (endX - startX) * agent.progress;
          const curY = startY + (endY - startY) * agent.progress;

          // Fading trailing comet tail
          for (let t = 1; t <= 6; t++) {
            const tailP = Math.max(0, agent.progress - t * 0.025);
            const tx = startX + (endX - startX) * tailP;
            const ty = startY + (endY - startY) * tailP;
            const alpha = (1 - t / 7) * 0.75;
            g.beginPath();
            g.arc(tx, ty, Math.max(1, 3.4 - t * 0.45), 0, Math.PI * 2);
            g.fillStyle = `rgba(${p.amberRgb}, ${alpha})`;
            g.fill();
          }

          // Gentle expanding sonar ping
          const ringR = 3 + 12 * agent.ring;
          g.beginPath();
          g.arc(curX, curY, ringR, 0, Math.PI * 2);
          g.strokeStyle = `rgba(${p.amberRgb}, ${1 - agent.ring})`;
          g.lineWidth = 1.1;
          g.stroke();

          // Main comet particle
          g.beginPath();
          g.arc(curX, curY, 3.8, 0, Math.PI * 2);
          g.fillStyle = p.isDark ? "#f5b942" : "#000000";
          g.fill();
          g.strokeStyle = p.isDark ? "#ffffff" : "#ffffff";
          g.lineWidth = 1;
          g.stroke();
        }
      }

      // 4. Draw Constellation Nodes (Spheres, Rings & Glyphs)
      nodes.forEach((n) => {
        const isHovered = hoveredNodeId === n.id;
        const isSelected = selectedNode?.id === n.id;
        const isAgentHere = agent.toNodeId === n.id;
        const isDimmed = activeCategory !== "all" && n.category !== activeCategory;

        g.save();
        if (isDimmed) g.globalAlpha = 0.14;

        // Ambient radial halo behind hubs
        if (n.isHub || isHovered || isSelected) {
          const haloR = n.radius + (isHovered || isSelected ? 14 : 9);
          const haloGrad = g.createRadialGradient(n.x, n.y, n.radius * 0.5, n.x, n.y, haloR);
          haloGrad.addColorStop(
            0,
            p.isDark ? "rgba(245, 185, 66, 0.22)" : "rgba(0, 0, 0, 0.12)"
          );
          haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          g.beginPath();
          g.arc(n.x, n.y, haloR, 0, Math.PI * 2);
          g.fillStyle = haloGrad;
          g.fill();
        }

        // Outer concentric ring for hubs
        if (n.isHub) {
          g.beginPath();
          g.arc(n.x, n.y, n.radius + 3, 0, Math.PI * 2);
          g.strokeStyle = isHovered || isSelected ? p.highlightBg : p.ruleSoft;
          g.lineWidth = 0.8;
          g.stroke();
        }

        // Node core circle
        g.beginPath();
        g.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        g.fillStyle = isHovered || isSelected ? p.highlightBg : p.surface;
        g.fill();
        g.strokeStyle = isHovered || isSelected ? p.highlightBg : isAgentHere ? (p.isDark ? "#f5b942" : "#000000") : p.rule;
        g.lineWidth = isAgentHere || isSelected ? 2 : 1.2;
        g.stroke();

        // Center glyph
        if (n.isHub) {
          g.font = `bold ${n.radius >= 15 ? 11 : 9}px 'Space Mono', monospace`;
          g.fillStyle = isHovered || isSelected ? p.highlightText : p.ink;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(n.glyph, n.x, n.y);
        } else {
          // Small inner pip for satellite nodes
          g.beginPath();
          g.arc(n.x, n.y, 2.2, 0, Math.PI * 2);
          g.fillStyle = isHovered || isSelected ? p.highlightText : p.ink;
          g.fill();
        }

        // Monospace label sitting beside the node
        const labelX = n.x + n.radius + 5;
        const labelY = n.y;

        g.font = `${n.isHub ? "bold 9px" : "8px"} 'Space Mono', monospace`;
        g.fillStyle = isHovered || isSelected ? p.ink : n.isHub ? p.ink : p.inkMuted;
        g.textAlign = "left";
        g.textBaseline = "middle";
        g.fillText(n.label, labelX, labelY);

        g.restore();
      });

      g.restore(); // restore zoom/pan transform
    }

    function frame(timestamp: number) {
      if (running) {
        stateRef.current.time = timestamp;
        if (!reduced && !stateRef.current.isPaused) {
          updatePhysics();
          updateAgent();
        }
        draw();
      }
      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    // Zoom/pan coordinate translation
    function toWorld(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const rawX = e.clientX - rect.left;
      const rawY = e.clientY - rect.top;
      const { width, height, zoom: z, pan: pPos } = stateRef.current;
      const worldX = (rawX - (width / 2 + pPos.x)) / z + width / 2;
      const worldY = (rawY - (height / 2 + pPos.y)) / z + height / 2;
      return { x: worldX, y: worldY, rawX, rawY };
    }

    const onPointerMove = (e: PointerEvent) => {
      const { x, y, rawX, rawY } = toWorld(e);
      const state = stateRef.current;

      if (state.isPanning) {
        setPan({
          x: state.pan.x + (rawX - state.panStart.x),
          y: state.pan.y + (rawY - state.panStart.y),
        });
        state.panStart = { x: rawX, y: rawY };
        return;
      }

      if (state.draggedNodeId) {
        const n = state.nodes.find((node) => node.id === state.draggedNodeId);
        if (n) {
          n.x = x;
          n.y = y;
          n.vx = 0;
          n.vy = 0;
        }
        return;
      }

      let hovered: GraphNode | null = null;
      for (const n of state.nodes) {
        if (Math.hypot(x - n.x, y - n.y) <= n.radius + 6) {
          hovered = n;
          break;
        }
      }

      state.hoveredNodeId = hovered ? hovered.id : null;
      canvas!.style.cursor = hovered ? "pointer" : "grab";
      if (hovered) {
        setActiveLog(hovered.log);
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      const { x, y, rawX, rawY } = toWorld(e);
      const state = stateRef.current;

      for (const n of state.nodes) {
        if (Math.hypot(x - n.x, y - n.y) <= n.radius + 6) {
          state.draggedNodeId = n.id;
          state.dragStart = { x: rawX, y: rawY };
          canvas!.setPointerCapture(e.pointerId);
          state.lastInteraction = Date.now();
          return;
        }
      }

      state.isPanning = true;
      state.panStart = { x: rawX, y: rawY };
      canvas!.style.cursor = "grabbing";
      canvas!.setPointerCapture(e.pointerId);
    };

    const onPointerUp = (e: PointerEvent) => {
      const state = stateRef.current;
      const { rawX, rawY } = toWorld(e);

      if (state.draggedNodeId) {
        const dist = Math.hypot(rawX - state.dragStart.x, rawY - state.dragStart.y);
        const node = state.nodes.find((n) => n.id === state.draggedNodeId);
        if (dist < 6 && node) {
          setSelectedNode(node);
          dispatchAgentTo(node.id);
        }
        state.draggedNodeId = null;
      }

      if (state.isPanning) {
        state.isPanning = false;
        canvas!.style.cursor = "grab";
      }

      try {
        canvas!.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom((z) => Math.max(0.75, Math.min(1.75, z * factor)));
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const onVis = () => {
      running = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [initNodes, dispatchAgentTo, activeCategory, selectedNode]);

  const selectedNodeEdges = useMemo(() => {
    if (!selectedNode) return [];
    return RAW_EDGES.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id);
  }, [selectedNode]);

  return (
    <div className="hero-graph-card" ref={containerRef}>
      {/* Top Observatory Header */}
      <div className="hero-graph-header">
        <div className="hero-graph-header-left">
          <span className="hero-graph-pulse-dot" />
          <span className="hero-graph-header-title">
            KNOWLEDGE GRAPH // LIVE OBSERVATORY
          </span>
        </div>
        <div className="hero-graph-header-actions">
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="hero-graph-btn secondary"
            title={isPaused ? "Resume agent patrol" : "Pause agent traversal"}
          >
            {isPaused ? "RESUME ▶" : "PAUSE ⏸"}
          </button>
          <button
            type="button"
            onClick={walkAgent}
            className="hero-graph-btn"
            title="Dispatch simulated AI agent along graph edges"
          >
            WALK GRAPH
          </button>
          <button
            type="button"
            onClick={resetView}
            className="hero-graph-btn secondary"
            title="Reset zoom, pan, and node positions"
          >
            RESET
          </button>
        </div>
      </div>

      {/* Layer Filter Pills Bar */}
      <div className="hero-graph-filter-bar">
        <span className="hero-graph-filter-label">LAYER:</span>
        {(
          [
            ["all", "ALL (28)"],
            ["mcp", "MCP"],
            ["graph", "GRAPH"],
            ["actions", "ACTIONS"],
            ["content", "CONTENT"],
            ["discovery", "DISCOVERY"],
            ["compat", "COMPAT"],
          ] as const
        ).map(([cat, label]) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`hero-graph-filter-btn ${activeCategory === cat ? "active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main Canvas Frame */}
      <div className="hero-graph-canvas-wrap">
        <canvas ref={canvasRef} className="hero-graph-canvas" />

        {/* Zoom Controls Overlay */}
        <div className="hero-graph-zoom-controls">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.75, z * 1.15))}
            className="hero-graph-zoom-btn"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, z * 0.85))}
            className="hero-graph-zoom-btn"
            title="Zoom out"
          >
            &minus;
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="hero-graph-zoom-btn"
            title="Fit to center"
          >
            ⛶
          </button>
        </div>

        {/* Node Detail Inspector Drawer */}
        {selectedNode && (
          <div className="hero-graph-inspector">
            <div className="hero-graph-inspector-header">
              <span className="postcard-tag boxed tilt-up" style={{ fontSize: "8.5px", padding: "1px 5px" }}>
                {selectedNode.badge}
              </span>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="hero-graph-inspector-close"
                aria-label="Close inspector"
              >
                &times;
              </button>
            </div>

            <div className="hero-graph-inspector-body">
              <h4 className="hero-graph-inspector-title">
                <span>{selectedNode.glyph}</span> {selectedNode.label}
              </h4>
              <div className="hero-graph-inspector-meta">
                <span>URI: <code>{selectedNode.uri}</code></span>
                <span>INTERFACE: <strong>{selectedNode.protocol}</strong></span>
                <span>MODULE: <code>{selectedNode.module}</code></span>
              </div>
              <p className="hero-graph-inspector-desc">{selectedNode.description}</p>

              <div className="hero-graph-inspector-edges">
                <span className="hero-graph-inspector-edge-heading">
                  CONNECTED EDGES ({selectedNodeEdges.length})
                </span>
                <div className="hero-graph-inspector-edge-list">
                  {selectedNodeEdges.map((e, idx) => (
                    <div key={idx} className="hero-graph-inspector-edge-item">
                      <span className="hero-graph-inspector-edge-tag">{e.label}</span>
                      <span>{e.from === selectedNode.id ? `➔ ${e.to}` : `⬅ from ${e.from}`}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => dispatchAgentTo(selectedNode.id)}
                className="btn-broadsheet-primary"
                style={{ width: "100%", marginTop: "0.65rem", padding: "0.45rem 0.8rem", fontSize: "9px" }}
              >
                DISPATCH AGENT HERE
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Terminal Telemetry Log Footer */}
      <div className="hero-graph-footer">
        <span className="hero-graph-prompt">$</span>
        <span className="hero-graph-log" title={activeLog}>
          {activeLog}
        </span>
        <span className="hero-graph-hops">
          28 NODES · 44 EDGES
        </span>
      </div>
    </div>
  );
}
