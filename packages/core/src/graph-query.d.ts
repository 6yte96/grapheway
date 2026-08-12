/**
 * Pure query operations over a `KnowledgeGraph`. Framework-agnostic and
 * dependency-free — shared by the `/graph/v1` HTTP API and the MCP tools.
 */
import type { GraphEdge, GraphEdgeType, GraphNode, KnowledgeGraph } from "./graph.ts";
/** Look up a node by exact id. */
export declare function findNode(graph: KnowledgeGraph, id: string): GraphNode | null;
export interface NeighborResult {
    edges: GraphEdge[];
    nodes: GraphNode[];
}
/** Edges touching a node (+ the connected nodes), filtered by direction/type. */
export declare function neighborsOf(graph: KnowledgeGraph, id: string, direction?: "out" | "in" | "both", type?: GraphEdgeType): NeighborResult;
/** Case-insensitive search over node labels + string props. */
export declare function searchNodes(graph: KnowledgeGraph, query: string, limit?: number): Array<{
    node: GraphNode;
    score: number;
}>;
/**
 * Shortest path between two nodes (undirected BFS, bounded depth).
 * Returns the ordered list of node ids, or null if unreachable.
 */
export declare function findPath(graph: KnowledgeGraph, from: string, to: string, maxDepth?: number): string[] | null;
//# sourceMappingURL=graph-query.d.ts.map