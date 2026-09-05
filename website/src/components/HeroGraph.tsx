"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

export type NodeCategory =
  | "discovery"
  | "mcp"
  | "graph"
  | "actions"
  | "content"
  | "compat";

export interface GlobeNodeDef {
  id: string;
  uri: string;
  label: string;
  badge: string;
  glyph: string;
  category: NodeCategory;
  isHub: boolean;
  radius: number;
  lat: number; // degrees -90 to +90 (north is positive)
  lng: number; // degrees -180 to +180
  module: string;
  protocol: string;
  description: string;
  log: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  type:
    | "declares"
    | "exposes"
    | "streams"
    | "calls"
    | "contains"
    | "serves"
    | "references"
    | "method"
    | "links_to";
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface ProjectedNode {
  def: GlobeNodeDef;
  unit: Vec3;
  rot: Vec3;
  sx: number;
  sy: number;
  zNorm: number; // [-1, 1], > 0 is front hemisphere
  drawRadius: number;
  alpha: number;
  scale: number;
}

// 31 typed nodes positioned across the 3D globe in 6 subsystem clusters
const RAW_NODES: GlobeNodeDef[] = [
  // Cluster 1: Discovery & Entry (Prime Meridian / Front-Center)
  {
    id: "root",
    uri: "/",
    label: "/",
    badge: "SITE ROOT",
    glyph: "◈",
    category: "discovery",
    isHub: true,
    radius: 15,
    lat: 14,
    lng: 0,
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
    radius: 14,
    lat: 30,
    lng: -18,
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
    isHub: true,
    radius: 12,
    lat: -4,
    lng: -24,
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
    lat: -20,
    lng: -38,
    module: "core/manifest.ts",
    protocol: "JSON API",
    description: "Machine-readable site summary: license, description, and subpath capabilities.",
    log: "METADATA // GET /agent/info -> license: MIT, runtimeDependencies: 0",
  },
  {
    id: "agent_sections",
    uri: "/agent/sections",
    label: "/agent/sections",
    badge: "SECTIONS",
    glyph: "§",
    category: "discovery",
    isHub: false,
    radius: 7,
    lat: -34,
    lng: -20,
    module: "core/graph.ts",
    protocol: "JSON API",
    description: "Top-level documentation and page hierarchy mapped to semantic section nodes.",
    log: "SECTIONS // GET /agent/sections -> 8 content sections indexed with provenance",
  },

  // Cluster 2: Knowledge Graph Core (Equatorial East)
  {
    id: "graph_hub",
    uri: "/graph/v1",
    label: "/graph/v1",
    badge: "GRAPH CORE",
    glyph: "⌬",
    category: "graph",
    isHub: true,
    radius: 16,
    lat: 10,
    lng: 42,
    module: "core/graph.ts",
    protocol: "REST / JSON",
    description: "Live knowledge graph router exposing summary, node lookup, edges, and search.",
    log: "GRAPH CORE // GET /graph/v1 -> summary: 28 nodes, 44 edges, version: 1725576000",
  },
  {
    id: "graph_node",
    uri: "/graph/v1/node",
    label: "graph:node",
    badge: "NODE LOOKUP",
    glyph: "•",
    category: "graph",
    isHub: false,
    radius: 7,
    lat: 32,
    lng: 50,
    module: "core/graph.ts",
    protocol: "GET /node",
    description: "Retrieves typed node metadata by URI or ID (e.g. /docs/quickstart).",
    log: "NODE LOOKUP // GET /graph/v1/node?id=doc_quickstart -> type: 'page', inDegree: 4",
  },
  {
    id: "graph_edges",
    uri: "/graph/v1/edges",
    label: "graph:edges",
    badge: "AUDITABLE EDGES",
    glyph: "•",
    category: "graph",
    isHub: false,
    radius: 7,
    lat: 24,
    lng: 70,
    module: "core/graph.ts",
    protocol: "GET /edges",
    description: "Auditable edges connecting pages, actions, schemas with verification tags.",
    log: "EDGES QUERY // GET /graph/v1/edges?node=graph_hub -> 8 outgoing directed links",
  },
  {
    id: "graph_search",
    uri: "/graph/v1/search",
    label: "graph:search",
    badge: "SEARCH",
    glyph: "⌕",
    category: "graph",
    isHub: false,
    radius: 8,
    lat: -8,
    lng: 65,
    module: "core/graph-query.ts",
    protocol: "GET /search",
    description: "Lexical & semantic search over node titles, descriptions, and page text.",
    log: "GRAPH SEARCH // GET /graph/v1/search?q=mcp -> 5 matching nodes found (0 scraping)",
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
    lat: -26,
    lng: 52,
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
    lat: 2,
    lng: 78,
    module: "core/graph.ts",
    protocol: "GET /dump",
    description: "Full JSON snapshot of nodes, edges, version timestamp, and checksums.",
    log: "GRAPH DUMP // GET /graph/v1/dump -> exported 1,927 edges in 11ms",
  },
  {
    id: "graph_events",
    uri: "/graph/v1/events",
    label: "SSE /events",
    badge: "STREAM",
    glyph: "≈",
    category: "graph",
    isHub: true,
    radius: 13,
    lat: -38,
    lng: 34,
    module: "web/handler.ts",
    protocol: "text/event-stream",
    description: "Live Server-Sent Events stream delivering graph mutations (add_node, add_edge).",
    log: "REALTIME SSE // GET /graph/v1/events -> connection active (subscribers: 1)",
  },

  // Cluster 3: Model Context Protocol (Far East Hemisphere)
  {
    id: "mcp_hub",
    uri: "/mcp",
    label: "/mcp",
    badge: "MCP GATEWAY",
    glyph: "⚡",
    category: "mcp",
    isHub: true,
    radius: 16,
    lat: 16,
    lng: 106,
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
    lat: 36,
    lng: 118,
    module: "web/mcp.ts",
    protocol: "JSON-RPC 2.0",
    description: "Lists all declared functions: search_content, check_status, graph_node, etc.",
    log: "MCP TOOLS // tools/list -> 6 registered tools exposed to Claude / Cursor",
  },
  {
    id: "mcp_tools_call",
    uri: "/mcp#tools/call",
    label: "tools/call",
    badge: "RPC CALL",
    glyph: "⚙",
    category: "mcp",
    isHub: false,
    radius: 8,
    lat: 20,
    lng: 136,
    module: "web/mcp.ts",
    protocol: "JSON-RPC 2.0",
    description: "Executes verified server tools directly without opening headless browsers.",
    log: "MCP CALL // tools/call graph_node -> returned structured schema in 3ms",
  },
  {
    id: "mcp_res_list",
    uri: "/mcp#resources/list",
    label: "resources/list",
    badge: "RESOURCES",
    glyph: "•",
    category: "mcp",
    isHub: false,
    radius: 7,
    lat: -6,
    lng: 114,
    module: "web/mcp.ts",
    protocol: "JSON-RPC 2.0",
    description: "Exposes graph nodes directly as MCP resources readable by reasoning models.",
    log: "MCP RESOURCES // resources/list -> 12 documentation resources mapped",
  },
  {
    id: "mcp_res_read",
    uri: "/mcp#resources/read",
    label: "resources/read",
    badge: "READ RESOURCE",
    glyph: "•",
    category: "mcp",
    isHub: false,
    radius: 7,
    lat: -22,
    lng: 128,
    module: "web/mcp.ts",
    protocol: "JSON-RPC 2.0",
    description: "Returns clean, navigation-stripped markdown for any graph URI.",
    log: "MCP READ // resources/read grapheway://quickstart -> 1.8KB markdown returned",
  },

  // Cluster 4: Callable Actions & OpenAPI (Back Hemisphere)
  {
    id: "action_hub",
    uri: "/agent/action",
    label: "/agent/action",
    badge: "ACTION BUS",
    glyph: "⚡",
    category: "actions",
    isHub: true,
    radius: 15,
    lat: -16,
    lng: 172,
    module: "web/handler.ts",
    protocol: "POST /agent/action",
    description: "RPC dispatch bus for declared actions (search_content, telemetry, status).",
    log: "ACTION BUS // POST /agent/action -> payload verified with strict JSON Schema",
  },
  {
    id: "act_status",
    uri: "/agent/action#check_status",
    label: "check_status",
    badge: "ACTION",
    glyph: "•",
    category: "actions",
    isHub: false,
    radius: 8,
    lat: -34,
    lng: 162,
    module: "examples/actions.ts",
    protocol: "JSON Schema RPC",
    description: "Health and readiness probe callable directly by autonomous agent systems.",
    log: "ACTION EXEC // run check_status -> 200 OK (uptime: 99.98%, load: 0.12)",
  },
  {
    id: "act_telemetry",
    uri: "/agent/action#query_telemetry",
    label: "query_telemetry",
    badge: "ACTION",
    glyph: "•",
    category: "actions",
    isHub: false,
    radius: 7,
    lat: -4,
    lng: -176,
    module: "examples/actions.ts",
    protocol: "JSON Schema RPC",
    description: "Query edge performance stats and crawl coverage without scraping pages.",
    log: "ACTION EXEC // run query_telemetry -> returned memory & throughput metrics",
  },
  {
    id: "endpoint_api",
    uri: "/api/v1/devices",
    label: "GET /devices",
    badge: "OPENAPI",
    glyph: "•",
    category: "actions",
    isHub: false,
    radius: 8,
    lat: 14,
    lng: -168,
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
    lat: -24,
    lng: -158,
    module: "probe/crawler.ts",
    protocol: "JSON Schema",
    description: "OpenAPI specification converted into typed endpoints and edge schemas.",
    log: "SCHEMA // parsed openapi.json: 12 endpoints, 6 schemas mapped to graph",
  },

  // Cluster 5: Content & Pages (North-West)
  {
    id: "doc_quickstart",
    uri: "/docs/quickstart",
    label: "/quickstart",
    badge: "DOC NODE",
    glyph: "§",
    category: "content",
    isHub: true,
    radius: 13,
    lat: 24,
    lng: -68,
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
    lat: 44,
    lng: -84,
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
    lat: 14,
    lng: -96,
    module: "probe/html.ts",
    protocol: "Markdown Node",
    description: "System architecture whitepaper detailing the 6 subpath modules.",
    log: "CONTENT // node /docs/architecture linked from 8 other documentation nodes",
  },
  {
    id: "doc_bench",
    uri: "/docs/benchmarks",
    label: "/benchmarks",
    badge: "PAGE",
    glyph: "•",
    category: "content",
    isHub: false,
    radius: 7,
    lat: -12,
    lng: -80,
    module: "probe/html.ts",
    protocol: "Markdown Node",
    description: "Performance metrics: 4.8ms cold-start, 0-dependency runtime footprint.",
    log: "CONTENT // node /docs/benchmarks parsed with latency comparison tables",
  },

  // Cluster 6: Compat & Legacy Fallbacks (North-West / Far West)
  {
    id: "compat_hub",
    uri: "/compat",
    label: "/compat",
    badge: "COMPAT HUB",
    glyph: "☷",
    category: "compat",
    isHub: true,
    radius: 14,
    lat: 26,
    lng: -128,
    module: "compat/handler.ts",
    protocol: "Static Files",
    description: "Backward-compatibility fallback engine generating llms.txt, robots.txt, sitemaps.",
    log: "COMPAT ENGINE // generated 5 legacy artifacts from master knowledge graph",
  },
  {
    id: "compat_llms",
    uri: "/llms.txt",
    label: "llms.txt",
    badge: "LLMS.TXT",
    glyph: "•",
    category: "compat",
    isHub: false,
    radius: 8,
    lat: 46,
    lng: -140,
    module: "compat/llms-txt.ts",
    protocol: "Text / Markdown",
    description: "Curated H1 summary and absolute link index for frontier LLM search scrapers.",
    log: "COMPAT // GET /llms.txt -> generated valid index with 8 canonical links",
  },
  {
    id: "compat_llms_full",
    uri: "/llms-full.txt",
    label: "llms-full.txt",
    badge: "FULL CONTEXT",
    glyph: "•",
    category: "compat",
    isHub: false,
    radius: 7,
    lat: 38,
    lng: -114,
    module: "compat/llms-txt.ts",
    protocol: "Full Text Stream",
    description: "Full site markdown concatenate for deep context window ingestion.",
    log: "COMPAT // GET /llms-full.txt -> compiled 48KB markdown package in 4ms",
  },
  {
    id: "compat_agents_txt",
    uri: "/agents.txt",
    label: "agents.txt",
    badge: "AGENTS.TXT",
    glyph: "•",
    category: "compat",
    isHub: false,
    radius: 7,
    lat: 10,
    lng: -134,
    module: "compat/agents-txt.ts",
    protocol: "A2A Standard",
    description: "Legacy text declaration of endpoints and parameters for earlier agent runtimes.",
    log: "COMPAT // GET /agents.txt -> declared 6 endpoints with type annotations",
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
    lat: 8,
    lng: -154,
    module: "compat/robots.ts",
    protocol: "Robots Protocol",
    description: "Selective crawler governance: welcomes search bots, guides training scrapers.",
    log: "COMPAT // GET /robots.txt -> verified sitemap line and crawler directives",
  },
];

// Directed typed edges connecting the knowledge graph
const RAW_EDGES: GraphEdge[] = [
  // Discovery links
  { from: "root", to: "agent_card", label: "declares", type: "declares" },
  { from: "root", to: "manifest", label: "exposes", type: "exposes" },
  { from: "agent_card", to: "manifest", label: "references", type: "references" },
  { from: "manifest", to: "agent_info", label: "contains", type: "contains" },
  { from: "manifest", to: "agent_sections", label: "contains", type: "contains" },

  // Graph Core Links
  { from: "root", to: "graph_hub", label: "serves", type: "serves" },
  { from: "graph_hub", to: "graph_node", label: "exposes", type: "exposes" },
  { from: "graph_hub", to: "graph_edges", label: "exposes", type: "exposes" },
  { from: "graph_hub", to: "graph_search", label: "exposes", type: "exposes" },
  { from: "graph_hub", to: "graph_path", label: "exposes", type: "exposes" },
  { from: "graph_hub", to: "graph_dump", label: "exposes", type: "exposes" },
  { from: "graph_hub", to: "graph_events", label: "streams", type: "streams" },

  // MCP Gateway Links
  { from: "root", to: "mcp_hub", label: "exposes", type: "exposes" },
  { from: "mcp_hub", to: "mcp_tools_list", label: "method", type: "method" },
  { from: "mcp_hub", to: "mcp_tools_call", label: "method", type: "method" },
  { from: "mcp_hub", to: "mcp_res_list", label: "method", type: "method" },
  { from: "mcp_hub", to: "mcp_res_read", label: "method", type: "method" },
  { from: "mcp_tools_call", to: "graph_hub", label: "calls", type: "calls" },
  { from: "mcp_tools_call", to: "action_hub", label: "calls", type: "calls" },
  { from: "mcp_res_read", to: "doc_quickstart", label: "serves", type: "serves" },

  // Actions & OpenAPI
  { from: "manifest", to: "action_hub", label: "declares", type: "declares" },
  { from: "action_hub", to: "act_status", label: "exposes", type: "exposes" },
  { from: "action_hub", to: "act_telemetry", label: "exposes", type: "exposes" },
  { from: "action_hub", to: "endpoint_api", label: "calls", type: "calls" },
  { from: "endpoint_api", to: "endpoint_spec", label: "declares", type: "declares" },
  { from: "graph_hub", to: "endpoint_api", label: "references", type: "references" },

  // Content Pages
  { from: "root", to: "doc_quickstart", label: "links_to", type: "links_to" },
  { from: "doc_quickstart", to: "doc_install", label: "links_to", type: "links_to" },
  { from: "doc_quickstart", to: "doc_arch", label: "links_to", type: "links_to" },
  { from: "doc_arch", to: "doc_bench", label: "links_to", type: "links_to" },
  { from: "graph_hub", to: "doc_quickstart", label: "contains", type: "contains" },
  { from: "graph_hub", to: "doc_install", label: "contains", type: "contains" },
  { from: "graph_hub", to: "doc_arch", label: "contains", type: "contains" },
  { from: "graph_hub", to: "doc_bench", label: "contains", type: "contains" },

  // Compat Protocols
  { from: "root", to: "compat_hub", label: "serves", type: "serves" },
  { from: "compat_hub", to: "compat_llms", label: "exposes", type: "exposes" },
  { from: "compat_hub", to: "compat_llms_full", label: "exposes", type: "exposes" },
  { from: "compat_hub", to: "compat_agents_txt", label: "exposes", type: "exposes" },
  { from: "compat_hub", to: "compat_robots", label: "exposes", type: "exposes" },
  { from: "compat_llms", to: "doc_quickstart", label: "references", type: "references" },
  { from: "compat_llms", to: "doc_install", label: "references", type: "references" },
  { from: "compat_llms", to: "doc_arch", label: "references", type: "references" },
  { from: "compat_agents_txt", to: "action_hub", label: "references", type: "references" },
  { from: "compat_robots", to: "compat_llms", label: "references", type: "references" },
];

// Spherical & 3D Vector Math Helpers
function toCartesian(latDeg: number, lngDeg: number): Vec3 {
  const lat = (latDeg * Math.PI) / 180;
  const lng = (lngDeg * Math.PI) / 180;
  return {
    x: Math.cos(lat) * Math.sin(lng),
    y: -Math.sin(lat), // Canvas +y is down, so positive latitude goes up
    z: Math.cos(lat) * Math.cos(lng),
  };
}

function rotatePoint(p: Vec3, rotX: number, rotY: number): Vec3 {
  // 1. Yaw around Y axis
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = p.x * cosY + p.z * sinY;
  const z1 = -p.x * sinY + p.z * cosY;

  // 2. Pitch around X axis
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = p.y * cosX - z1 * sinX;
  const z2 = p.y * sinX + z1 * cosX;

  return { x: x1, y: y2, z: z2 };
}

function project(
  p: Vec3,
  cx: number,
  cy: number,
  R: number,
  D = 650
): { sx: number; sy: number; zNorm: number; fov: number } {
  const px = p.x * R;
  const py = p.y * R;
  const pz = p.z * R;

  const fov = D / (D - pz);
  return {
    sx: cx + px * fov,
    sy: cy + py * fov,
    zNorm: p.z, // [-1, 1], > 0 is front hemisphere
    fov,
  };
}

// Spherical linear interpolation along shortest great-circle arc
function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  let dot = a.x * b.x + a.y * b.y + a.z * b.z;
  dot = Math.max(-1, Math.min(1, dot));
  const theta = Math.acos(dot);
  if (Math.abs(theta) < 0.001) {
    return { x: a.x, y: a.y, z: a.z };
  }
  const sinTheta = Math.sin(theta);
  const wA = Math.sin((1 - t) * theta) / sinTheta;
  const wB = Math.sin(t * theta) / sinTheta;
  return {
    x: a.x * wA + b.x * wB,
    y: a.y * wA + b.y * wB,
    z: a.z * wA + b.z * wB,
  };
}

// Graph BFS Shortest Path
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
  const [selectedNode, setSelectedNode] = useState<GlobeNodeDef | null>(null);
  const [activeLog, setActiveLog] = useState<string>(
    "KNOWLEDGE GLOBE // 31 typed nodes, 44 edges · drag with cursor to rotate"
  );
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1);

  // Precomputed unit Cartesian coordinates for all nodes
  const nodeUnitMap = useMemo(() => {
    const map = new Map<string, Vec3>();
    RAW_NODES.forEach((n) => {
      map.set(n.id, toCartesian(n.lat, n.lng));
    });
    return map;
  }, []);

  // Mutable animation and 3D globe state
  const stateRef = useRef({
    width: 520,
    height: 500,
    dpr: 1,
    zoom: 1,
    rotX: 0.16, // slight natural tilt down
    rotY: 0,    // yaw heading
    vRotX: 0,   // angular momentum
    vRotY: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    lastMoveX: 0,
    lastMoveY: 0,
    dragDist: 0,
    hoveredNodeId: null as string | null,
    isPaused: false,
    targetRotX: null as number | null,
    targetRotY: null as number | null,
    projectedNodes: [] as ProjectedNode[],
    agent: {
      fromNodeId: "root",
      toNodeId: "agent_card",
      progress: 0,
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
      tailHistory: [] as Vec3[],
    },
    time: 0,
  });

  stateRef.current.zoom = zoom;
  stateRef.current.isPaused = isPaused;

  const dispatchAgentTo = useCallback((targetId: string) => {
    const current = stateRef.current.agent.toNodeId;
    const path = findShortestPath(current, targetId);
    stateRef.current.agent.pathQueue = path.slice(1);
    setActiveLog(`AGENT NAVIGATION // routing 3D orbit: ${path.join(" ➔ ")}`);
  }, []);

  // Smoothly rotate the globe to center on a specific node
  const rotateToNode = useCallback((node: GlobeNodeDef) => {
    const targetY = -((node.lng * Math.PI) / 180);
    const targetX = (node.lat * Math.PI) / 180;
    stateRef.current.targetRotX = Math.max(-1.4, Math.min(1.4, targetX));
    stateRef.current.targetRotY = targetY;
  }, []);

  const walkAgent = useCallback(() => {
    const patrol = [
      "agent_card",
      "mcp_hub",
      "mcp_tools_call",
      "act_status",
      "endpoint_api",
      "graph_hub",
      "graph_search",
      "doc_quickstart",
      "graph_events",
      "compat_llms",
      "root",
    ];
    const curr = stateRef.current.agent.toNodeId;
    const nextIdx = (patrol.indexOf(curr) + 1) % patrol.length;
    const nextTarget = patrol[nextIdx] || "agent_card";
    dispatchAgentTo(nextTarget);

    const targetDef = RAW_NODES.find((n) => n.id === nextTarget);
    if (targetDef) {
      rotateToNode(targetDef);
    }
  }, [dispatchAgentTo, rotateToNode]);

  const resetView = useCallback(() => {
    setZoom(1);
    stateRef.current.targetRotX = 0.16;
    stateRef.current.targetRotY = 0;
    stateRef.current.vRotX = 0;
    stateRef.current.vRotY = 0;
    setSelectedNode(null);
    setActiveLog("KNOWLEDGE GLOBE // orientation reset to prime meridian");
  }, []);

  // Canvas Render Loop with 3D Globe Projection
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

    const wrap = canvas.parentElement || container;
    function resize() {
      if (!wrap || !canvas) return;
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(300, Math.floor(rect.width));
      const h = Math.max(360, Math.floor(rect.height || (w < 600 ? 380 : 500)));

      stateRef.current.width = w;
      stateRef.current.height = h;
      stateRef.current.dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(w * stateRef.current.dpr);
      canvas.height = Math.round(h * stateRef.current.dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    // Paper & Ink Broadsheet Color Palette
    function getPalette() {
      const isDark = document.documentElement.classList.contains("dark");
      return {
        isDark,
        rule: isDark ? "#F2F8FC" : "#000000",
        ruleSoft: isDark ? "rgba(242, 248, 252, 0.16)" : "rgba(0, 0, 0, 0.14)",
        ruleFaint: isDark ? "rgba(242, 248, 252, 0.06)" : "rgba(0, 0, 0, 0.05)",
        ink: isDark ? "#F2F8FC" : "#000000",
        inkMuted: isDark ? "rgba(242, 248, 252, 0.65)" : "rgba(0, 0, 0, 0.62)",
        highlightBg: isDark ? "#F2F8FC" : "#000000",
        highlightText: isDark ? "#24221f" : "#F2F8FC",
        surface: isDark ? "#282420" : "#ffffff",
        amber: isDark ? "#f5b942" : "#b45309",
        amberRgb: isDark ? "245, 185, 66" : "0, 0, 0",
        wireBack: isDark ? "rgba(245, 185, 66, 0.04)" : "rgba(0, 0, 0, 0.035)",
        wireFront: isDark ? "rgba(245, 185, 66, 0.12)" : "rgba(0, 0, 0, 0.11)",
        wireEquator: isDark ? "rgba(245, 185, 66, 0.24)" : "rgba(0, 0, 0, 0.22)",
      };
    }

    function updateAgent() {
      const { agent, isPaused } = stateRef.current;
      if (isPaused) return;

      agent.ring = (agent.ring + 0.015) % 1;
      agent.progress += agent.speed;

      // Track agent unit position for comet tail
      const fromUnit = nodeUnitMap.get(agent.fromNodeId);
      const toUnit = nodeUnitMap.get(agent.toNodeId);
      if (fromUnit && toUnit) {
        const curUnit = slerp(fromUnit, toUnit, Math.min(1, agent.progress));
        agent.tailHistory.unshift(curUnit);
        if (agent.tailHistory.length > 7) {
          agent.tailHistory.pop();
        }
      }

      if (agent.progress >= 1) {
        agent.progress = 0;
        agent.fromNodeId = agent.toNodeId;
        const next = agent.pathQueue.shift();
        if (next) {
          agent.toNodeId = next;
          const def = RAW_NODES.find((node) => node.id === next);
          if (def) {
            setActiveLog(def.log);
          }
        }
      }
    }

    function updatePhysics() {
      const state = stateRef.current;

      // Handle animated smooth rotation to target
      if (state.targetRotX !== null && state.targetRotY !== null) {
        const dy = state.targetRotY - state.rotY;
        const shortestDy = Math.atan2(Math.sin(dy), Math.cos(dy));
        state.rotY += shortestDy * 0.07;
        state.rotX += (state.targetRotX - state.rotX) * 0.07;

        if (
          Math.abs(shortestDy) < 0.003 &&
          Math.abs(state.targetRotX - state.rotX) < 0.003
        ) {
          state.targetRotX = null;
          state.targetRotY = null;
        }
      } else if (!state.isDragging) {
        // Inertia momentum
        state.rotY += state.vRotY;
        state.rotX += state.vRotX;
        state.vRotY *= 0.93;
        state.vRotX *= 0.93;

        // Serene auto-rotation when idle
        if (!state.isPaused && !reduced) {
          state.rotY += 0.0018;
        }
      }
    }

    // Main 3D Render
    function draw() {
      const {
        width,
        height,
        dpr,
        rotX,
        rotY,
        zoom: zScale,
        hoveredNodeId,
        agent,
      } = stateRef.current;
      const p = getPalette();

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const baseR = Math.min(width, height) * 0.36;
      const R = Math.max(120, baseR * zScale);
      const D = 650;

      // 1. Precalculate 3D Rotated & Projected Coordinates for all nodes
      const projectedNodes: ProjectedNode[] = RAW_NODES.map((def) => {
        const unit = nodeUnitMap.get(def.id) || { x: 0, y: 0, z: 1 };
        const rot = rotatePoint(unit, rotX, rotY);
        const { sx, sy, zNorm, fov } = project(rot, cx, cy, R, D);

        const isDimmed =
          activeCategory !== "all" && def.category !== activeCategory;
        const baseAlpha = zNorm >= 0 ? 0.82 + 0.18 * zNorm : 0.22 + 0.2 * (1 + zNorm);
        const alpha = isDimmed ? baseAlpha * 0.16 : baseAlpha;
        const scale = fov * (zNorm >= 0 ? 0.85 + 0.3 * zNorm : 0.65 + 0.25 * (1 + zNorm));
        const drawRadius = Math.max(4, def.radius * scale * 0.9);

        return {
          def,
          unit,
          rot,
          sx,
          sy,
          zNorm,
          drawRadius,
          alpha,
          scale,
        };
      });

      stateRef.current.projectedNodes = projectedNodes;

      const nodeProjMap = new Map<string, ProjectedNode>();
      projectedNodes.forEach((pn) => nodeProjMap.set(pn.def.id, pn));

      // Separate into back-facing and front-facing
      const backNodes = projectedNodes
        .filter((n) => n.zNorm < 0)
        .sort((a, b) => a.zNorm - b.zNorm);
      const frontNodes = projectedNodes
        .filter((n) => n.zNorm >= 0)
        .sort((a, b) => a.zNorm - b.zNorm);

      // 2. Spherical Ambient Shading & Silhouette
      g.save();
      g.beginPath();
      g.arc(cx, cy, R, 0, Math.PI * 2);
      const sphereGrad = g.createRadialGradient(
        cx - R * 0.25,
        cy - R * 0.25,
        R * 0.05,
        cx,
        cy,
        R
      );
      if (p.isDark) {
        sphereGrad.addColorStop(0, "rgba(245, 185, 66, 0.06)");
        sphereGrad.addColorStop(0.65, "rgba(255, 255, 255, 0.015)");
        sphereGrad.addColorStop(1, "rgba(245, 185, 66, 0.035)");
      } else {
        sphereGrad.addColorStop(0, "rgba(0, 0, 0, 0.03)");
        sphereGrad.addColorStop(0.65, "rgba(0, 0, 0, 0.01)");
        sphereGrad.addColorStop(1, "rgba(0, 0, 0, 0.045)");
      }
      g.fillStyle = sphereGrad;
      g.fill();
      g.strokeStyle = p.ruleSoft;
      g.lineWidth = 1;
      g.stroke();
      g.restore();

      // 3. Draw Back-face Armillary Parallels & Meridians
      g.save();
      const latitudes = [-60, -30, 0, 30, 60];
      latitudes.forEach((latDeg) => {
        g.beginPath();
        g.strokeStyle = p.wireBack;
        g.lineWidth = 0.7;
        g.setLineDash([2, 4]);

        let hasMoved = false;
        for (let lng = -180; lng <= 180; lng += 8) {
          const pt = toCartesian(latDeg, lng);
          const rot = rotatePoint(pt, rotX, rotY);
          if (rot.z < 0) {
            const { sx, sy } = project(rot, cx, cy, R, D);
            if (!hasMoved) {
              g.moveTo(sx, sy);
              hasMoved = true;
            } else {
              g.lineTo(sx, sy);
            }
          } else {
            hasMoved = false;
          }
        }
        g.stroke();
      });

      const longitudes = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180];
      longitudes.forEach((lngDeg) => {
        g.beginPath();
        g.strokeStyle = p.wireBack;
        g.lineWidth = 0.6;
        g.setLineDash([2, 4]);

        let hasMoved = false;
        for (let lat = -85; lat <= 85; lat += 7) {
          const pt = toCartesian(lat, lngDeg);
          const rot = rotatePoint(pt, rotX, rotY);
          if (rot.z < 0) {
            const { sx, sy } = project(rot, cx, cy, R, D);
            if (!hasMoved) {
              g.moveTo(sx, sy);
              hasMoved = true;
            } else {
              g.lineTo(sx, sy);
            }
          } else {
            hasMoved = false;
          }
        }
        g.stroke();
      });
      g.restore();

      // 4. Draw Back-face Great-Circle Edges (Faint dashed lines behind sphere)
      g.save();
      RAW_EDGES.forEach((edge) => {
        const fromPn = nodeProjMap.get(edge.from);
        const toPn = nodeProjMap.get(edge.to);
        if (!fromPn || !toPn) return;

        // If both endpoints are back-facing
        if (fromPn.zNorm < 0 && toPn.zNorm < 0) {
          g.beginPath();
          g.strokeStyle = p.wireBack;
          g.lineWidth = 0.8;
          g.setLineDash([1, 4]);
          const N = 10;
          for (let i = 0; i <= N; i++) {
            const pt = slerp(fromPn.unit, toPn.unit, i / N);
            const rot = rotatePoint(pt, rotX, rotY);
            const { sx, sy } = project(rot, cx, cy, R, D);
            if (i === 0) g.moveTo(sx, sy);
            else g.lineTo(sx, sy);
          }
          g.stroke();
        }
      });
      g.restore();

      // 5. Draw Back-face Nodes (Muted, smaller dots on far hemisphere)
      backNodes.forEach((pn) => {
        g.save();
        g.globalAlpha = pn.alpha;
        g.beginPath();
        g.arc(pn.sx, pn.sy, Math.max(2, pn.drawRadius * 0.65), 0, Math.PI * 2);
        g.fillStyle = p.isDark ? "rgba(242, 248, 252, 0.45)" : "rgba(0, 0, 0, 0.35)";
        g.fill();
        g.restore();
      });

      // 6. Draw Front-face Armillary Parallels & Meridians
      g.save();
      latitudes.forEach((latDeg) => {
        g.beginPath();
        const isEquator = latDeg === 0;
        g.strokeStyle = isEquator ? p.wireEquator : p.wireFront;
        g.lineWidth = isEquator ? 1.2 : 0.8;
        g.setLineDash([]);

        let hasMoved = false;
        for (let lng = -180; lng <= 180; lng += 6) {
          const pt = toCartesian(latDeg, lng);
          const rot = rotatePoint(pt, rotX, rotY);
          if (rot.z >= -0.05) {
            const { sx, sy } = project(rot, cx, cy, R, D);
            if (!hasMoved) {
              g.moveTo(sx, sy);
              hasMoved = true;
            } else {
              g.lineTo(sx, sy);
            }
          } else {
            hasMoved = false;
          }
        }
        g.stroke();
      });

      longitudes.forEach((lngDeg) => {
        g.beginPath();
        g.strokeStyle = p.wireFront;
        g.lineWidth = 0.75;
        g.setLineDash([]);

        let hasMoved = false;
        for (let lat = -85; lat <= 85; lat += 5) {
          const pt = toCartesian(lat, lngDeg);
          const rot = rotatePoint(pt, rotX, rotY);
          if (rot.z >= -0.05) {
            const { sx, sy } = project(rot, cx, cy, R, D);
            if (!hasMoved) {
              g.moveTo(sx, sy);
              hasMoved = true;
            } else {
              g.lineTo(sx, sy);
            }
          } else {
            hasMoved = false;
          }
        }
        g.stroke();
      });

      // 7. Celestial Astrolabe Outer Rim Graduation Ticks
      const rimR = R * 1.05;
      g.beginPath();
      g.strokeStyle = p.ruleSoft;
      g.lineWidth = 0.75;
      g.arc(cx, cy, rimR, 0, Math.PI * 2);
      g.stroke();

      for (let deg = 0; deg < 360; deg += 15) {
        const rad = (deg * Math.PI) / 180;
        const isMajor = deg % 45 === 0;
        const tickLen = isMajor ? 6 : 3;
        const xA = cx + Math.cos(rad) * rimR;
        const yA = cy + Math.sin(rad) * rimR;
        const xB = cx + Math.cos(rad) * (rimR + tickLen);
        const yB = cy + Math.sin(rad) * (rimR + tickLen);

        g.beginPath();
        g.strokeStyle = isMajor ? p.rule : p.ruleSoft;
        g.lineWidth = isMajor ? 1.1 : 0.6;
        g.moveTo(xA, yA);
        g.lineTo(xB, yB);
        g.stroke();
      }
      g.restore();

      // 8. Draw Front-face Great-Circle Edges
      RAW_EDGES.forEach((edge) => {
        const fromPn = nodeProjMap.get(edge.from);
        const toPn = nodeProjMap.get(edge.to);
        if (!fromPn || !toPn) return;

        // Skip if entirely back-facing
        if (fromPn.zNorm < 0 && toPn.zNorm < 0) return;

        const isTraversing =
          (agent.fromNodeId === edge.from && agent.toNodeId === edge.to) ||
          (agent.fromNodeId === edge.to && agent.toNodeId === edge.from);

        const isHovered =
          hoveredNodeId === edge.from || hoveredNodeId === edge.to;
        const isSelected =
          selectedNode?.id === edge.from || selectedNode?.id === edge.to;

        const isDimmed =
          activeCategory !== "all" &&
          fromPn.def.category !== activeCategory &&
          toPn.def.category !== activeCategory;

        const N = 14;
        const points: { sx: number; sy: number; zNorm: number }[] = [];
        for (let i = 0; i <= N; i++) {
          const pt = slerp(fromPn.unit, toPn.unit, i / N);
          const rot = rotatePoint(pt, rotX, rotY);
          points.push(project(rot, cx, cy, R, D));
        }

        g.save();
        if (isDimmed) g.globalAlpha = 0.12;

        g.beginPath();
        let active = false;
        points.forEach((pt) => {
          if (pt.zNorm >= -0.15) {
            if (!active) {
              g.moveTo(pt.sx, pt.sy);
              active = true;
            } else {
              g.lineTo(pt.sx, pt.sy);
            }
          } else {
            active = false;
          }
        });

        if (isTraversing) {
          g.strokeStyle = p.amber;
          g.lineWidth = 2.4;
        } else if (isHovered || isSelected) {
          g.strokeStyle = p.rule;
          g.lineWidth = 1.6;
        } else {
          g.strokeStyle = p.isDark ? "rgba(242, 248, 252, 0.45)" : "rgba(0, 0, 0, 0.4)";
          g.lineWidth = 0.9;
        }
        g.stroke();
        g.restore();
      });

      // 9. Draw Simulated Agent Orbiting along Great-Circle Edges
      const fromUnit = nodeUnitMap.get(agent.fromNodeId);
      const toUnit = nodeUnitMap.get(agent.toNodeId);
      if (fromUnit && toUnit) {
        const curUnit = slerp(fromUnit, toUnit, Math.min(1, agent.progress));
        // Altitude offset so the agent flies slightly above surface
        const curPos = {
          x: curUnit.x * 1.025,
          y: curUnit.y * 1.025,
          z: curUnit.z * 1.025,
        };
        const rotCur = rotatePoint(curPos, rotX, rotY);
        const { sx: curX, sy: curY, zNorm: agentZ } = project(rotCur, cx, cy, R, D);

        // Only draw prominent particle if near or in front
        if (agentZ >= -0.2) {
          g.save();

          // Luminous comet tail
          agent.tailHistory.forEach((histUnit, idx) => {
            const histPos = {
              x: histUnit.x * 1.02,
              y: histUnit.y * 1.02,
              z: histUnit.z * 1.02,
            };
            const rotHist = rotatePoint(histPos, rotX, rotY);
            if (rotHist.z >= -0.2) {
              const { sx: hx, sy: hy } = project(rotHist, cx, cy, R, D);
              const alpha = (1 - idx / agent.tailHistory.length) * 0.45;
              const rTail = 3.5 * (1 - idx / agent.tailHistory.length);
              g.beginPath();
              g.arc(hx, hy, Math.max(1, rTail), 0, Math.PI * 2);
              g.fillStyle = `rgba(${p.amberRgb}, ${alpha})`;
              g.fill();
            }
          });

          // Expanding sonar arrival ping
          const ringR = 4 + 14 * agent.ring;
          g.beginPath();
          g.arc(curX, curY, ringR, 0, Math.PI * 2);
          g.strokeStyle = `rgba(${p.amberRgb}, ${1 - agent.ring})`;
          g.lineWidth = 1.1;
          g.stroke();

          // Main agent satellite particle
          g.beginPath();
          g.arc(curX, curY, 4, 0, Math.PI * 2);
          g.fillStyle = p.amber;
          g.fill();
          g.strokeStyle = p.isDark ? "#ffffff" : "#000000";
          g.lineWidth = 1.2;
          g.stroke();

          g.restore();
        }
      }

      // 10. Draw Front-face Nodes (Concentric rings, radial halo, glyphs, and labels)
      frontNodes.forEach((pn) => {
        const isHovered = hoveredNodeId === pn.def.id;
        const isSelected = selectedNode?.id === pn.def.id;
        const isAgentHere = agent.toNodeId === pn.def.id;

        g.save();
        g.globalAlpha = pn.alpha;

        // Radial ambient glow behind hubs
        if (pn.def.isHub || isHovered || isSelected) {
          const haloR = pn.drawRadius + (isHovered || isSelected ? 12 : 7);
          const haloGrad = g.createRadialGradient(
            pn.sx,
            pn.sy,
            pn.drawRadius * 0.4,
            pn.sx,
            pn.sy,
            haloR
          );
          haloGrad.addColorStop(
            0,
            p.isDark ? "rgba(245, 185, 66, 0.25)" : "rgba(0, 0, 0, 0.15)"
          );
          haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
          g.beginPath();
          g.arc(pn.sx, pn.sy, haloR, 0, Math.PI * 2);
          g.fillStyle = haloGrad;
          g.fill();
        }

        // Concentric outer ring for hubs
        if (pn.def.isHub) {
          g.beginPath();
          g.arc(pn.sx, pn.sy, pn.drawRadius + 3, 0, Math.PI * 2);
          g.strokeStyle = isHovered || isSelected ? p.highlightBg : p.ruleSoft;
          g.lineWidth = 0.8;
          g.stroke();
        }

        // Primary node sphere
        g.beginPath();
        g.arc(pn.sx, pn.sy, pn.drawRadius, 0, Math.PI * 2);
        g.fillStyle =
          isHovered || isSelected
            ? p.highlightBg
            : isAgentHere
            ? p.amber
            : p.surface;
        g.fill();
        g.strokeStyle =
          isHovered || isSelected
            ? p.highlightBg
            : isAgentHere
            ? p.rule
            : p.rule;
        g.lineWidth = isAgentHere || isSelected ? 2 : 1.2;
        g.stroke();

        // Center glyph
        if (pn.def.isHub) {
          g.font = `bold ${pn.drawRadius >= 13 ? 11 : 9}px 'Space Mono', monospace`;
          g.fillStyle = isHovered || isSelected ? p.highlightText : p.ink;
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillText(pn.def.glyph, pn.sx, pn.sy);
        } else {
          // Small inner pip for satellite nodes
          g.beginPath();
          g.arc(pn.sx, pn.sy, 2.2, 0, Math.PI * 2);
          g.fillStyle = isHovered || isSelected ? p.highlightText : p.ink;
          g.fill();
        }

        // High-contrast monospace label
        if (pn.zNorm > -0.05) {
          const labelX = pn.sx + pn.drawRadius + 6;
          const labelY = pn.sy;

          g.font = `${pn.def.isHub ? "bold 9px" : "8px"} 'Space Mono', monospace`;
          g.fillStyle = isHovered || isSelected ? p.ink : pn.def.isHub ? p.ink : p.inkMuted;
          g.textAlign = "left";
          g.textBaseline = "middle";
          g.fillText(pn.def.label, labelX, labelY);
        }

        g.restore();
      });
    }

    function frame(timestamp: number) {
      if (running) {
        stateRef.current.time = timestamp;
        updatePhysics();
        updateAgent();
        draw();
        raf = requestAnimationFrame(frame);
      }
    }

    raf = requestAnimationFrame(frame);

    // Interactive Cursor & Touch Drag Handlers
    function getCanvasCoords(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    const onPointerDown = (e: PointerEvent) => {
      const state = stateRef.current;
      state.isDragging = true;
      state.dragStartX = e.clientX;
      state.dragStartY = e.clientY;
      state.lastMoveX = e.clientX;
      state.lastMoveY = e.clientY;
      state.dragDist = 0;
      state.vRotX = 0;
      state.vRotY = 0;
      state.targetRotX = null;
      state.targetRotY = null;

      canvas!.setPointerCapture(e.pointerId);
      canvas!.style.cursor = "grabbing";
    };

    const onPointerMove = (e: PointerEvent) => {
      const state = stateRef.current;
      const { x, y } = getCanvasCoords(e);

      if (state.isDragging) {
        const dx = e.clientX - state.lastMoveX;
        const dy = e.clientY - state.lastMoveY;
        state.dragDist += Math.hypot(dx, dy);

        // Natural trackball drag sensitivity
        state.rotY += dx * 0.0055;
        state.rotX += dy * 0.0055;

        // Clamp pitch so globe does not invert upside down
        const maxPitch = Math.PI / 2 - 0.1;
        state.rotX = Math.max(-maxPitch, Math.min(maxPitch, state.rotX));

        state.vRotY = dx * 0.0055;
        state.vRotX = dy * 0.0055;

        state.lastMoveX = e.clientX;
        state.lastMoveY = e.clientY;
        return;
      }

      // Hit testing front-facing nodes on hover
      let hovered: ProjectedNode | null = null;
      for (const pn of state.projectedNodes) {
        if (pn.zNorm >= -0.15) {
          const d = Math.hypot(x - pn.sx, y - pn.sy);
          if (d <= pn.drawRadius + 7) {
            hovered = pn;
            break;
          }
        }
      }

      state.hoveredNodeId = hovered ? hovered.def.id : null;
      canvas!.style.cursor = hovered ? "pointer" : "grab";
      if (hovered) {
        setActiveLog(hovered.def.log);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const state = stateRef.current;
      state.isDragging = false;
      canvas!.style.cursor = "grab";

      // If released after a clean click without significant drag
      if (state.dragDist < 6) {
        const { x, y } = getCanvasCoords(e);
        let clicked: ProjectedNode | null = null;
        for (const pn of state.projectedNodes) {
          if (pn.zNorm >= -0.15) {
            const d = Math.hypot(x - pn.sx, y - pn.sy);
            if (d <= pn.drawRadius + 8) {
              clicked = pn;
              break;
            }
          }
        }

        if (clicked) {
          setSelectedNode(clicked.def);
          dispatchAgentTo(clicked.def.id);
          rotateToNode(clicked.def);
        }
      }

      try {
        canvas!.releasePointerCapture(e.pointerId);
      } catch {}
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.max(0.75, Math.min(1.65, z - e.deltaY * 0.0012)));
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [nodeUnitMap, dispatchAgentTo, rotateToNode, activeCategory, selectedNode]);

  // Edges connected to selected node for inspector drawer
  const selectedNodeEdges = useMemo(() => {
    if (!selectedNode) return [];
    return RAW_EDGES.filter(
      (e) => e.from === selectedNode.id || e.to === selectedNode.id
    );
  }, [selectedNode]);

  return (
    <div className="hero-graph-direct" ref={containerRef}>
      {/* Top Floating Observatory Bar */}
      <div className="hero-graph-hud-top">
        <div className="hero-graph-status">
          <span className="hero-graph-pulse-dot" />
          <span className="hero-graph-title">
            KNOWLEDGE GLOBE // LIVE OBSERVATORY
          </span>
          <span className="hero-graph-count">
            31 NODES · 44 EDGES
          </span>
        </div>
        <div className="hero-graph-actions">
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="hero-graph-pill-btn"
            title={isPaused ? "Resume auto-rotation and agent" : "Pause auto-rotation and agent"}
          >
            {isPaused ? "RESUME ▶" : "PAUSE ⏸"}
          </button>
          <button
            type="button"
            onClick={walkAgent}
            className="hero-graph-pill-btn primary"
            title="Dispatch simulated AI agent along 3D orbits"
          >
            WALK
          </button>
          <button
            type="button"
            onClick={resetView}
            className="hero-graph-pill-btn"
            title="Reset rotation to prime meridian"
          >
            RESET ⊙
          </button>
          <div className="hero-graph-zoom-group">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.65, z * 1.15))}
              className="hero-graph-pill-btn"
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, z * 0.85))}
              className="hero-graph-pill-btn"
              title="Zoom out"
            >
              &minus;
            </button>
          </div>
        </div>
      </div>

      {/* Layer Filter Chips */}
      <div className="hero-graph-hud-filters">
        <span className="hero-graph-filter-label">LAYER:</span>
        {(
          [
            ["all", "ALL (31)"],
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
            className={`hero-graph-filter-chip ${activeCategory === cat ? "active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main 3D Globe Canvas Area */}
      <div className="hero-graph-direct-canvas-wrap">
        <canvas ref={canvasRef} className="hero-graph-canvas" />

        {/* Node Detail Inspector Floating Drawer */}
        {selectedNode && (
          <div className="hero-graph-inspector">
            <div className="hero-graph-inspector-header">
              <span
                className="postcard-tag boxed tilt-up"
                style={{ fontSize: "8.5px", padding: "1px 5px" }}
              >
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
                <span>
                  URI: <code>{selectedNode.uri}</code>
                </span>
                <span>
                  INTERFACE: <strong>{selectedNode.protocol}</strong>
                </span>
                <span>
                  MODULE: <code>{selectedNode.module}</code>
                </span>
                <span>
                  COORDINATES: <code>{selectedNode.lat}°N, {selectedNode.lng}°E</code>
                </span>
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
                      <span>
                        {e.from === selectedNode.id
                          ? `➔ ${e.to}`
                          : `⬅ from ${e.from}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => dispatchAgentTo(selectedNode.id)}
                className="btn-broadsheet-primary"
                style={{
                  width: "100%",
                  marginTop: "0.65rem",
                  padding: "0.45rem 0.8rem",
                  fontSize: "9px",
                }}
              >
                DISPATCH AGENT HERE
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Subtle Bottom Ticker */}
      <div className="hero-graph-hud-bottom">
        <span className="hero-graph-prompt">$</span>
        <span className="hero-graph-log" title={activeLog}>
          {activeLog}
        </span>
      </div>
    </div>
  );
}
