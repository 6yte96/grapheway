/**
 * Graph persistence: a stable JSON form for `graph.json` files, CI caches
 * and offline gateways. Validation is intentionally structural, not
 * exhaustive: enough to reject a wrong file early with a clear message.
 */

import type { GraphEdge, GraphNode, KnowledgeGraph } from "./graph.ts";

export interface StoredGraph {
  config?: unknown;
  graph: KnowledgeGraph;
}

/** Pretty JSON with a trailing newline, ready to write to disk. */
export function serializeGraph(graph: KnowledgeGraph): string {
  return `${JSON.stringify(graph, null, 2)}\n`;
}

/** Parse and validate a graph from JSON text or an already-parsed value. */
export function parseGraph(input: unknown): KnowledgeGraph {
  let data: unknown = input;
  if (typeof input === "string") {
    try {
      data = JSON.parse(input);
    } catch (err) {
      throw new Error(`graph: invalid JSON (${err instanceof Error ? err.message : String(err)})`);
    }
  }
  if (!data || typeof data !== "object") {
    throw new Error("graph: expected an object with `nodes` and `edges`");
  }
  const record = data as Record<string, unknown>;
  const { nodes, edges, meta } = record;
  if (!Array.isArray(nodes)) throw new Error("graph: `nodes` must be an array");
  if (!Array.isArray(edges)) throw new Error("graph: `edges` must be an array");

  nodes.forEach((node, index) => {
    if (!node || typeof node !== "object") {
      throw new Error(`graph: node ${index} must be an object`);
    }
    const n = node as Record<string, unknown>;
    if (typeof n.id !== "string" || !n.id) {
      throw new Error(`graph: node ${index} needs a non-empty string id`);
    }
    if (typeof n.type !== "string" || !n.type) {
      throw new Error(`graph: node ${index} needs a string type`);
    }
    if (typeof n.label !== "string") {
      throw new Error(`graph: node ${index} needs a string label`);
    }
  });

  edges.forEach((edge, index) => {
    if (!edge || typeof edge !== "object") {
      throw new Error(`graph: edge ${index} must be an object`);
    }
    const e = edge as Record<string, unknown>;
    if (typeof e.id !== "string" || !e.id) {
      throw new Error(`graph: edge ${index} needs a non-empty string id`);
    }
    if (typeof e.source !== "string" || typeof e.target !== "string") {
      throw new Error(`graph: edge ${index} needs string source and target`);
    }
    if (typeof e.type !== "string" || !e.type) {
      throw new Error(`graph: edge ${index} needs a string type`);
    }
  });

  return {
    nodes: nodes as GraphNode[],
    edges: edges as GraphEdge[],
    ...(meta && typeof meta === "object" ? { meta: meta as KnowledgeGraph["meta"] } : {}),
  };
}

/** Parse an exported `{ config, graph }` file and return the graph. */
export function parseStoredGraph(input: unknown): StoredGraph {
  const data = typeof input === "string" ? JSON.parse(input) : input;
  if (!data || typeof data !== "object" || !("graph" in data)) {
    throw new Error("graph file: expected an object with a `graph` field");
  }
  return { config: (data as Record<string, unknown>).config, graph: parseGraph((data as Record<string, unknown>).graph) };
}
