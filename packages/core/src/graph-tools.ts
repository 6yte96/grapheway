/**
 * Shared MCP tool definitions for the site's knowledge graph.
 *
 * One source of truth used by both the server's MCP endpoint
 * (`@grapheway/web`) and the agent-side stdio MCP server
 * (`@grapheway/agent`) — no drift between the two surfaces.
 */

export interface GraphToolDef {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export const GRAPH_TOOLS: GraphToolDef[] = [
  {
    name: "graph_node",
    description: "Returns a node of the site's knowledge graph by id (a page or section URL).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Node id — an absolute URL like https://site/docs/install" } },
      required: ["id"],
    },
  },
  {
    name: "graph_neighbors",
    description: "Returns the edges and connected nodes of a node — how it links to the rest of the site.",
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
    description: "Finds the shortest path between two nodes of the site's knowledge graph.",
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
