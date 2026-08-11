import { describe, expect, test } from "bun:test";
import { buildDiscovery } from "../src/discovery.ts";
import { buildGraph, projectGraph } from "../src/graph.ts";
import { findNode, findPath, neighborsOf, searchNodes } from "../src/graph-query.ts";
import type { GraphewayConfig } from "../src/types.ts";

const config: GraphewayConfig = {
  name: "Acme",
  url: "https://acme.example",
  tagline: "API for everything",
  summary: "Acme is an API platform.",
  sections: [
    {
      title: "Docs",
      url: "/docs",
      items: [
        { title: "Install", url: "/docs/install", notes: "npm i" },
        { title: "Quickstart", url: "https://acme.example/docs/quickstart" },
        { title: "External", url: "https://other.example/x" }, // cross-origin → skipped
      ],
    },
    {
      title: "Support",
      items: [{ title: "Contact", url: "/contact" }],
    },
  ],
  links: [
    { title: "GitHub", url: "https://github.com/acme" }, // cross-origin → skipped
    { title: "Status", url: "https://acme.example/status" },
  ],
};

describe("projectGraph", () => {
  test("projects root, sections and pages with is_part_of edges", () => {
    const g = projectGraph(config);
    const labels = g.nodes.map((n) => n.label);
    expect(labels).toContain("Acme"); // root page
    expect(labels).toContain("Docs"); // section
    expect(labels).toContain("Install");
    expect(labels).toContain("Contact");
    expect(labels).not.toContain("External"); // cross-origin item skipped
    expect(g.nodes.filter((n) => n.type === "page")).toHaveLength(5); // root + install + quickstart + contact + status
    expect(g.nodes.filter((n) => n.type === "section")).toHaveLength(2);
    expect(g.edges.filter((e) => e.type === "is_part_of")).toHaveLength(3);
  });

  test("every section is reachable from the root, plus same-origin links", () => {
    const g = projectGraph(config);
    const root = "https://acme.example";
    expect(g.edges.some((e) => e.source === root && e.target === "https://acme.example/docs" && e.type === "links_to")).toBe(true);
    expect(g.edges.some((e) => e.source === root && e.target === "https://acme.example#section-support-1" && e.type === "links_to")).toBe(true);
    expect(g.edges.some((e) => e.source === root && e.target === "https://acme.example/status" && e.type === "links_to")).toBe(true);
    expect(g.edges.some((e) => e.target === "https://github.com/acme")).toBe(false);
  });

  test("sections without a URL get deterministic ids", () => {
    const g = projectGraph(config);
    const support = g.nodes.find((n) => n.label === "Support");
    expect(support?.id).toBe("https://acme.example#section-support-1");
  });
});

describe("buildGraph", () => {
  test("custom builder wins over the config projection", () => {
    const g = buildGraph(config, {
      builder: () => ({ nodes: [{ id: "urn:custom", type: "concept", label: "Custom" }], edges: [] }),
    });
    expect(g.nodes).toHaveLength(1);
    expect(g.nodes[0]?.label).toBe("Custom");
  });

  test("extra nodes/edges merge without duplicate ids", () => {
    const g = buildGraph(config, {
      extra: {
        nodes: [
          { id: "https://acme.example", type: "page", label: "Duplicate root" },
          { id: "urn:entity:weather", type: "entity", label: "Weather" },
        ],
        edges: [],
      },
    });
    expect(g.nodes.filter((n) => n.id === "https://acme.example")).toHaveLength(1);
    expect(g.nodes.some((n) => n.id === "urn:entity:weather")).toBe(true);
  });
});

describe("graph queries", () => {
  const g = projectGraph(config);

  test("findNode by id", () => {
    expect(findNode(g, "https://acme.example/docs/install")?.label).toBe("Install");
    expect(findNode(g, "nope")).toBeNull();
  });

  test("neighborsOf returns connected nodes + edges", () => {
    const res = neighborsOf(g, "https://acme.example/docs/install", "both");
    expect(res.nodes.some((n) => n.label === "Docs")).toBe(true);
    expect(res.edges.every((e) => e.type === "is_part_of")).toBe(true);
    expect(neighborsOf(g, "https://acme.example/docs/install", "in").edges.length).toBe(1);
  });

  test("searchNodes ranks label matches", () => {
    const hits = searchNodes(g, "install");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.node.label.toLowerCase()).toContain("install");
    expect(searchNodes(g, "  ")).toEqual([]);
  });

  test("findPath connects root to a page", () => {
    const path = findPath(g, "https://acme.example", "https://acme.example/docs/install");
    expect(path).not.toBeNull();
    expect(path![0]).toBe("https://acme.example");
    expect(path![path!.length - 1]).toBe("https://acme.example/docs/install");
    expect(findPath(g, "https://acme.example", "nope")).toBeNull();
  });
});

describe("buildDiscovery", () => {
  test("advertises protocol, graph summary and endpoints", () => {
    const g = projectGraph(config);
    const d = buildDiscovery(config, g);
    expect(d.protocol).toBe("grapheway");
    expect(d.graph.nodes).toBe(g.nodes.length);
    expect(d.graph.edges).toBe(g.edges.length);
    expect(d.graph.nodeTypes).toContain("page");
    expect(d.graph.edgeTypes).toContain("is_part_of");
    expect(d.endpoints.graph).toBe("https://acme.example/graph/v1");
    expect(d.endpoints.mcp).toBe("https://acme.example/mcp");
    expect(d.auth).toBe("open");
  });
});
