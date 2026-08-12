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
  | { type: "remove_edge"; id: string };

/** Apply a single patch. No-ops when it would duplicate/remove nothing. */
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
    case "add_edge":
      if (graph.edges.some((e) => e.id === patch.edge.id)) return graph;
      return { ...graph, edges: [...graph.edges, patch.edge] };
    case "remove_edge":
      return { ...graph, edges: graph.edges.filter((e) => e.id !== patch.id) };
  }
}

/** Apply many patches in order. */
export function applyPatches(graph: KnowledgeGraph, patches: GraphPatch[]): KnowledgeGraph {
  let g = graph;
  for (const patch of patches) g = applyPatch(g, patch);
  return g;
}
