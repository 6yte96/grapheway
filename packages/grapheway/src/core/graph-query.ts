/**
 * Pure query operations over a `KnowledgeGraph`. Framework-agnostic and
 * dependency-free — shared by the `/graph/v1` HTTP API and the MCP tools.
 */

import type { GraphEdge, GraphEdgeType, GraphNode, KnowledgeGraph } from "./graph.ts";

/** Look up a node by exact id. */
export function findNode(graph: KnowledgeGraph, id: string): GraphNode | null {
  return graph.nodes.find((n) => n.id === id) ?? null;
}

export interface NeighborResult {
  edges: GraphEdge[];
  nodes: GraphNode[];
}

/** Edges touching a node (+ the connected nodes), filtered by direction/type. */
export function neighborsOf(
  graph: KnowledgeGraph,
  id: string,
  direction: "out" | "in" | "both" = "both",
  type?: GraphEdgeType,
): NeighborResult {
  const edges = graph.edges.filter((e) => {
    if (type && e.type !== type) return false;
    if (direction === "out") return e.source === id;
    if (direction === "in") return e.target === id;
    return e.source === id || e.target === id;
  });
  const neighborIds = new Set<string>();
  for (const e of edges) {
    if (e.source !== id) neighborIds.add(e.source);
    if (e.target !== id) neighborIds.add(e.target);
  }
  const nodes = graph.nodes.filter((n) => neighborIds.has(n.id));
  return { edges, nodes };
}

/** Case-insensitive search over node labels + string props. */
export function searchNodes(
  graph: KnowledgeGraph,
  query: string,
  limit = 10,
): Array<{ node: GraphNode; score: number }> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: Array<{ node: GraphNode; score: number }> = [];
  for (const node of graph.nodes) {
    let score = 0;
    const label = node.label.toLowerCase();
    if (label === q) score += 10;
    else if (label.startsWith(q)) score += 6;
    else if (label.includes(q)) score += 4;
    for (const value of Object.values(node.props ?? {})) {
      if (typeof value === "string" && value.toLowerCase().includes(q)) {
        score += 1;
        break;
      }
    }
    if (score > 0) scored.push({ node, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Shortest path between two nodes (undirected BFS, bounded depth).
 * Returns the ordered list of node ids, or null if unreachable.
 */
export function findPath(
  graph: KnowledgeGraph,
  from: string,
  to: string,
  maxDepth = 6,
): string[] | null {
  return findPathWithEdges(graph, from, to, maxDepth)?.path ?? null;
}

/**
 * Shortest path *with its edges* — the auditable version of `findPath`.
 * Returns the ordered node ids plus the edge that connects each consecutive
 * pair, so an agent can show *why* it walked the path (edge type, label,
 * provenance, confidence). Null when the nodes are unreachable.
 */
export function findPathWithEdges(
  graph: KnowledgeGraph,
  from: string,
  to: string,
  maxDepth = 6,
): { path: string[]; edges: GraphEdge[] } | null {
  if (from === to) return { path: [from], edges: [] };
  const adjacency = new Map<string, Map<string, GraphEdge>>();
  for (const e of graph.edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, new Map());
    if (!adjacency.has(e.target)) adjacency.set(e.target, new Map());
    adjacency.get(e.source)!.set(e.target, e);
    adjacency.get(e.target)!.set(e.source, e);
  }
  // BFS with a parent-edge map: walk back from `to` to rebuild the path + edges.
  const prev = new Map<string, { node: string; edge: GraphEdge }>();
  const queue: Array<{ id: string; depth: number }> = [{ id: from, depth: 0 }];
  const visited = new Set<string>([from]);
  let head = 0;
  while (head < queue.length) {
    const { id, depth } = queue[head++]!;
    if (depth >= maxDepth) continue;
    for (const [next, edge] of adjacency.get(id) ?? new Map()) {
      if (visited.has(next)) continue;
      visited.add(next);
      prev.set(next, { node: id, edge });
      if (next === to) {
        // Rebuild the path from `to` back to `from`.
        const path: string[] = [];
        const edges: GraphEdge[] = [];
        let cur: string | undefined = to;
        while (cur !== undefined) {
          path.unshift(cur);
          const p = prev.get(cur);
          if (!p) break;
          edges.unshift(p.edge);
          cur = p.node;
        }
        return { path, edges };
      }
      queue.push({ id: next, depth: depth + 1 });
    }
  }
  return null;
}
