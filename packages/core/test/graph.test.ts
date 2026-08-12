import { describe, expect, test } from "bun:test";
import {
  applyPatch,
  applyPatches,
  buildGraph,
  findPathWithEdges,
  projectGraph,
  type GraphewayConfig,
  type GraphEdge,
  type GraphNode,
} from "../src/index.ts";

const config: GraphewayConfig = {
  name: "Provenance Site",
  url: "https://provenance.example",
  sections: [{ title: "Docs", items: [{ title: "Install", url: "/install" }] }],
  links: [{ title: "Changelog", url: "/changelog" }],
};

const ROOT = "https://provenance.example";
const SECTION = `${ROOT}#section-docs-0`;
const INSTALL = `${ROOT}/install`;

describe("graph provenance (auditable edges)", () => {
  test("projectGraph tags config/section/link edges as extracted with notes", () => {
    const g = projectGraph(config);
    const byKey = new Map(g.edges.map((e) => [`${e.source}->${e.target}`, e]));

    const sectionEdge = byKey.get(`${ROOT}->${SECTION}`);
    expect(sectionEdge?.provenance).toBe("config");
    expect(sectionEdge?.confidence).toBe("extracted");
    expect(sectionEdge?.note).toContain("Docs");

    const itemEdge = byKey.get(`${SECTION}->${INSTALL}`);
    expect(itemEdge?.provenance).toBe("section");
    expect(itemEdge?.confidence).toBe("extracted");

    const linkEdge = byKey.get(`${ROOT}->${ROOT}/changelog`);
    expect(linkEdge?.provenance).toBe("link");
    expect(linkEdge?.confidence).toBe("extracted");
  });

  test("buildGraph tags builder + extra edges, author's own tags win", () => {
    const built = buildGraph(config, {
      builder: () => ({
        nodes: [{ id: ROOT, type: "page", label: "Root" }],
        edges: [{ id: "b1", source: ROOT, target: INSTALL, type: "related" }],
      }),
      extra: {
        nodes: [],
        edges: [
          {
            id: "x1",
            source: ROOT,
            target: INSTALL,
            type: "mentions",
            provenance: "derived",
            confidence: "inferred",
            note: "Mentioned on the homepage",
          },
        ],
      },
    });
    const b1 = built.edges.find((e) => e.id === "b1")!;
    expect(b1.provenance).toBe("builder");
    expect(b1.confidence).toBe("extracted");
    const x1 = built.edges.find((e) => e.id === "x1")!;
    expect(x1.provenance).toBe("derived"); // author-set wins over the extra default
    expect(x1.confidence).toBe("inferred");
  });

  test("findPathWithEdges returns the auditable path", () => {
    const g = projectGraph(config);
    const result = findPathWithEdges(g, ROOT, INSTALL);
    expect(result?.path).toEqual([ROOT, SECTION, INSTALL]);
    expect(result?.edges).toHaveLength(2);
    expect(result!.edges[0]!.type).toBe("links_to");
    expect(result!.edges[1]!.type).toBe("is_part_of");
    expect(result!.edges[1]!.confidence).toBe("extracted");
    expect(findPathWithEdges(g, ROOT, `${ROOT}/does-not-exist`)).toBeNull();
  });
});

describe("graph patches (realtime updates)", () => {
  test("applyPatch adds/removes nodes and edges with no-ops", () => {
    const nodeA: GraphNode = { id: "urn:x:1", type: "entity", label: "X" };
    const nodeB: GraphNode = { id: "urn:x:2", type: "entity", label: "Y" };
    const edge: GraphEdge = { id: "e1", source: "urn:x:1", target: "urn:x:2", type: "related" };
    const base = { nodes: [], edges: [] };

    const g1 = applyPatch(base, { type: "add_node", node: nodeA });
    expect(g1.nodes).toHaveLength(1);
    // Duplicate add is a no-op.
    expect(applyPatch(g1, { type: "add_node", node: nodeA }).nodes).toHaveLength(1);

    const g2 = applyPatch(g1, { type: "add_node", node: nodeB });
    const g3 = applyPatch(g2, { type: "add_edge", edge });
    expect(g3.edges).toHaveLength(1);
    // Removing the node cascades to its edges.
    const g4 = applyPatch(g3, { type: "remove_node", id: "urn:x:1" });
    expect(g4.nodes).toHaveLength(1);
    expect(g4.edges).toHaveLength(0);

    const g5 = applyPatch(g3, { type: "remove_edge", id: "e1" });
    expect(g5.edges).toHaveLength(0);
  });

  test("applyPatches applies a batch in order", () => {
    const nodeA: GraphNode = { id: "urn:x:1", type: "entity", label: "X" };
    const nodeB: GraphNode = { id: "urn:x:2", type: "entity", label: "Y" };
    const edge: GraphEdge = { id: "e1", source: "urn:x:1", target: "urn:x:2", type: "related" };
    const g = applyPatches({ nodes: [], edges: [] }, [
      { type: "add_node", node: nodeA },
      { type: "add_node", node: nodeB },
      { type: "add_edge", edge },
    ]);
    expect(g.nodes).toHaveLength(2);
    expect(g.edges).toHaveLength(1);
  });

  test("add_edge to an unknown node throws (no dangling edges)", () => {
    const nodeA: GraphNode = { id: "urn:x:1", type: "entity", label: "X" };
    const nodeB: GraphNode = { id: "urn:x:2", type: "entity", label: "Y" };
    const edge: GraphEdge = { id: "e1", source: "urn:x:1", target: "urn:x:2", type: "related" };
    // Both endpoints present → allowed.
    const ok = applyPatch({ nodes: [nodeA, nodeB], edges: [] }, { type: "add_edge", edge });
    expect(ok.edges).toHaveLength(1);
    // Missing endpoint → throws, naming the unknown node.
    expect(() => applyPatch({ nodes: [nodeA], edges: [] }, { type: "add_edge", edge })).toThrow(/urn:x:2/);
    expect(() => applyPatch({ nodes: [], edges: [] }, { type: "add_edge", edge })).toThrow(/urn:x:1/);
  });

  test("set_node_meta merges props; unknown node is a no-op", () => {
    const node: GraphNode = { id: "urn:x:1", type: "entity", label: "X", props: { a: 1 } };
    const g1 = applyPatch({ nodes: [node], edges: [] }, {
      type: "set_node_meta",
      id: "urn:x:1",
      meta: { b: 2 },
    });
    expect(g1.nodes[0]!.props).toEqual({ a: 1, b: 2 });
    const g2 = applyPatch({ nodes: [node], edges: [] }, {
      type: "set_node_meta",
      id: "urn:missing",
      meta: { b: 2 },
    });
    expect(g2.nodes).toHaveLength(1);
    expect(g2.nodes[0]!.props).toEqual({ a: 1 });
  });
});
