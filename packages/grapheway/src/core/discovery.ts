/**
 * Discovery — how agents *find* a site's agent surface before touching
 * anything else. Served at `/.well-known/agent` (the "digital business
 * card" pattern from A2A-style agent cards).
 */

import { GRAPHEWAY_VERSION, type GraphewayConfig } from "./types.ts";
import { buildManifest } from "./manifest.ts";
import type { KnowledgeGraph } from "./graph.ts";

export interface DiscoveryDoc {
  /** Protocol name — agents match on this. */
  protocol: "grapheway";
  /** Protocol/package version. */
  version: string;
  name: string;
  url: string;
  tagline?: string;
  summary?: string;
  contact?: unknown;
  /** Machine-actionable capabilities declared by the site. */
  capabilities: string[];
  /** Summary of the exposed graph. */
  graph: {
    nodes: number;
    edges: number;
    nodeTypes: string[];
    edgeTypes: string[];
  };
  /** The runtime endpoints an agent should talk to. */
  endpoints: {
    manifest: string;
    graph: string;
    mcp: string;
    actions: string;
  };
  /** "open" for now — per-tool key gates arrive with auth support. */
  auth: string;
}

/** Build the discovery document for a site + its graph. */
export function buildDiscovery(config: GraphewayConfig, graph: KnowledgeGraph): DiscoveryDoc {
  const m = buildManifest(config);
  const base = config.url.replace(/\/+$/, "");
  return {
    protocol: "grapheway",
    version: GRAPHEWAY_VERSION,
    name: config.name,
    url: config.url,
    tagline: config.tagline,
    summary: config.summary,
    contact: config.contact,
    capabilities: config.capabilities ?? [],
    graph: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      nodeTypes: [...new Set(graph.nodes.map((n) => n.type))].sort(),
      edgeTypes: [...new Set(graph.edges.map((e) => e.type))].sort(),
    },
    endpoints: {
      manifest: m.endpoints.manifest,
      graph: `${base}/graph/v1`,
      mcp: m.endpoints.mcp,
      actions: m.endpoints.action,
    },
    auth: "open",
  };
}
