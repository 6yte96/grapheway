import { describe, expect, test } from "bun:test";
import { parseGraph, parseStoredGraph, serializeGraph } from "../../src/core/graph-io.ts";
import type { KnowledgeGraph } from "../../src/core/graph.ts";

const graph: KnowledgeGraph = {
  nodes: [{ id: "https://example.com/", type: "page", label: "Home" }],
  edges: [
    {
      id: "e1",
      source: "https://example.com/",
      target: "https://example.com/docs",
      type: "links_to",
    },
  ],
  meta: { sourceUrl: "https://example.com", capturedAt: "2026-11-26T00:00:00.000Z", snapshot: true },
};

describe("serializeGraph / parseGraph", () => {
  test("round trips a graph", () => {
    const parsed = parseGraph(serializeGraph(graph));
    expect(parsed).toEqual(graph);
  });

  test("rejects a missing nodes array", () => {
    expect(() => parseGraph('{"edges":[]}')).toThrow("`nodes` must be an array");
  });

  test("rejects a malformed node", () => {
    expect(() => parseGraph('{"nodes":[{"id":"x"}],"edges":[]}')).toThrow("needs a string type");
  });

  test("rejects a malformed edge", () => {
    expect(() =>
      parseGraph('{"nodes":[],"edges":[{"id":"e","source":"a","target":"b"}]}'),
    ).toThrow("needs a string type");
  });

  test("rejects invalid JSON with context", () => {
    expect(() => parseGraph("{")).toThrow("invalid JSON");
  });
});

describe("parseStoredGraph", () => {
  test("reads an exported { config, graph } file", () => {
    const stored = parseStoredGraph(JSON.stringify({ config: { name: "X" }, graph }));
    expect(stored.graph.nodes).toHaveLength(1);
    expect(stored.config).toEqual({ name: "X" });
  });

  test("rejects a file without a graph field", () => {
    expect(() => parseStoredGraph('{"config":{}}')).toThrow("expected an object with a `graph` field");
  });
});
