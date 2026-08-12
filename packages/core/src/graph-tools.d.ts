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
export declare const GRAPH_TOOLS: GraphToolDef[];
//# sourceMappingURL=graph-tools.d.ts.map