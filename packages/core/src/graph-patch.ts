/**
 * Realtime graph updates — pure functions so they work everywhere.
 *
 * A site's graph can change at runtime (new product pages, status flips,
 * discovered relations). Instead of rebuilding the whole graph, apps push
 * small `GraphPatch`es; subscribers (SSE, MCP clients, agent SDKs) receive
 * the same patches and stay in sync without re-probing.
 */

import type { GraphEdge, GraphNode, KnowledgeGraph } from "./graph.ts";

export type GraphPatch =
  | { type: "add_node"; node: GraphNode }
  | { type: "remove_node"; id: string }
  | { type: "add_edge"; edge: GraphEdge }
  | { type: "remove_edge"; id: string }
  | { type: "set_node_meta"; id: string; meta: Record<string, unknown> };

/**
 * Apply a single patch.
 * - Duplicates (`add_*` with an existing id) are no-ops.
 * - `add_edge` endpoints must already exist — otherwise the patch throws
 *   (a dangling edge would corrupt the graph). Apply `add_node` first.
 * - `remove_node` also removes every edge touching the node (no orphans).
 * - `set_node_meta` on an unknown node is a no-op.
 */
export function applyPatch(graph: KnowledgeGraph, patch: GraphPatch): KnowledgeGraph {
  switch (patch.type) {
    case "add_node":
      if (graph.nodes.some((n) => n.id === patch.node.id)) return graph;
      return { ...graph, nodes: [...graph.nodes, patch.node] };
    case "remove_node": {
      const id = patch.id;
      return {
        nodes: graph.nodes.filter((n) => n.id !== id),
        edges: graph.edges.filter((e) => e.source !== id && e.target !== id),
      };
    }
    case "add_edge": {
      const { edge } = patch;
      if (graph.edges.some((e) => e.id === edge.id)) return graph;
      const known = new Set(graph.nodes.map((n) => n.id));
      if (!known.has(edge.source) || !known.has(edge.target)) {
        throw new Error(
          `add_edge "${edge.id}" references unknown node(s) ` +
            `(${[edge.source, edge.target]
              .filter((id) => !known.has(id))
              .join(", ")}). Add the node(s) first.`,
        );
      }
      return { ...graph, edges: [...graph.edges, edge] };
    }
    case "remove_edge":
      return { ...graph, edges: graph.edges.filter((e) => e.id !== patch.id) };
    case "set_node_meta": {
      const idx = graph.nodes.findIndex((n) => n.id === patch.id);
      if (idx === -1) return graph;
      const nodes = [...graph.nodes];
      nodes[idx] = { ...nodes[idx]!, props: { ...nodes[idx]!.props, ...patch.meta } };
      return { ...graph, nodes };
    }
  }
}

/** Apply many patches in order. */
export function applyPatches(graph: KnowledgeGraph, patches: GraphPatch[]): KnowledgeGraph {
  let g = graph;
  for (const patch of patches) g = applyPatch(g, patch);
  return g;
}

/**
 * Structural diff between two graphs, as patches that take `prev` to `next`.
 *
 * Ordering respects `applyPatch`'s validation: `add_node` precedes
 * `add_edge` (endpoints must exist first); `remove_edge` only fires for
 * edges whose endpoints both survive (a removed node cleans its own edges);
 * `remove_node` comes last. Metadata-only changes are not tracked.
 */
export function diffGraphs(prev: KnowledgeGraph, next: KnowledgeGraph): GraphPatch[] {
  const prevNodes = new Set(prev.nodes.map((n) => n.id));
  const nextNodes = new Set(next.nodes.map((n) => n.id));
  const prevEdges = new Set(prev.edges.map((e) => e.id));
  const nextEdges = new Set(next.edges.map((e) => e.id));

  const patches: GraphPatch[] = [];
  for (const node of next.nodes) {
    if (!prevNodes.has(node.id)) patches.push({ type: "add_node", node });
  }
  for (const edge of next.edges) {
    if (!prevEdges.has(edge.id)) patches.push({ type: "add_edge", edge });
  }
  for (const edge of prev.edges) {
    if (!nextEdges.has(edge.id) && nextNodes.has(edge.source) && nextNodes.has(edge.target)) {
      patches.push({ type: "remove_edge", id: edge.id });
    }
  }
  for (const node of prev.nodes) {
    if (!nextNodes.has(node.id)) patches.push({ type: "remove_node", id: node.id });
  }
  return patches;
}
