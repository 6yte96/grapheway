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
  if (from === to) return [from];
  const adjacency = new Map<string, Set<string>>();
  for (const e of graph.edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
    if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
    adjacency.get(e.source)!.add(e.target);
    adjacency.get(e.target)!.add(e.source);
  }
  const queue: Array<{ id: string; path: string[] }> = [{ id: from, path: [from] }];
  const visited = new Set<string>([from]);
  let head = 0;
  while (head < queue.length) {
    const { id, path } = queue[head++]!;
    if (path.length >= maxDepth) continue;
    for (const next of adjacency.get(id) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      const newPath = [...path, next];
      if (next === to) return newPath;
      queue.push({ id: next, path: newPath });
    }
  }
  return null;
}
