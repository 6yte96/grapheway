/**
 * Shared MCP tool definitions for the site's knowledge graph.
 *
 * One source of truth used by both the server's MCP endpoint
 * (`@grapheway/web`) and the agent-side stdio MCP server
 * (`@grapheway/agent`) — no drift between the two surfaces.
 */

import type { ToolAnnotations } from "./types.ts";

export interface GraphToolDef {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: ToolAnnotations;
}

/** Conservative default for user actions we know nothing about. */
export const CUSTOM_ACTION_ANNOTATIONS: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: true,
};

const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const GRAPH_TOOLS: GraphToolDef[] = [
  {
    name: "graph_node",
    annotations: READ_ONLY,
    description: "Returns a node of the site's knowledge graph by id (a page or section URL).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Node id — an absolute URL like https://site/docs/install" } },
      required: ["id"],
    },
  },
  {
    name: "graph_neighbors",
    annotations: READ_ONLY,
    description: "Returns the edges and connected nodes of a node — how it links to the rest of the site. Every edge carries provenance (config/section/link/builder/extra/derived) and confidence (extracted/inferred/ambiguous).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Node id (absolute URL)." },
        direction: { type: "string", enum: ["out", "in", "both"], description: "Edge direction (default both)." },
        type: { type: "string", description: "Filter by edge type: links_to, is_part_of, related, mentions." },
      },
      required: ["id"],
    },
  },
  {
    name: "graph_search",
    annotations: READ_ONLY,
    description: "Searches the site's knowledge graph by node label/metadata and returns ranked nodes.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "The search query." },
        limit: { type: "number", description: "Max results (default 10)." },
      },
      required: ["q"],
    },
  },
  {
    name: "graph_path",
    annotations: READ_ONLY,
    description: "Finds the shortest path between two nodes of the site's knowledge graph and returns the auditable path: the ordered node ids plus the edge behind each hop (type, label, provenance, confidence).",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Starting node id (absolute URL)." },
        to: { type: "string", description: "Target node id (absolute URL)." },
      },
      required: ["from", "to"],
    },
  },
];
