import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createServer, type Server } from "node:http";
import { compatHandler } from "../../src/compat/index.js";
import { createGrapheway, toNodeHandler } from "../../src/web/index.js";
import { GraphewayClient, probeSite } from "../../src/agent/index.ts";
import type { GraphewayConfig } from "../../src/core/index.js";

const config: GraphewayConfig = {
  name: "Acme Store",
  url: "http://127.0.0.1:0",
  tagline: "Everything APIs",
  summary: "Acme Store sells API-powered gadgets.",
  contact: { email: "store@acme.example" },
  capabilities: ["search", "checkout"],
  sections: [
    {
      title: "Catalog",
      items: [
        { title: "Gadgets", url: "/catalog/gadgets", notes: "All gadgets" },
        { title: "Pricing", url: "/pricing", notes: "Plans and prices" },
      ],
    },
  ],
  actions: [
    {
      name: "check_price",
      description: "Check the price of a product",
      inputSchema: {
        type: "object",
        properties: { sku: { type: "string" } },
        required: ["sku"],
      },
    },
  ],
};

const agent = createGrapheway(config, {
  search: (q) => [{ title: "Gadgets", url: "/catalog/gadgets", snippet: `result for ${q}` }],
  actions: {
    check_price: async (args) => ({ sku: args.sku, price: 42 }),
  },
  getPageMarkdown: (path) => (path === "/pricing" ? "# Pricing\n- Free: $0\n- Pro: $20" : null),
});

let server: Server;
let base = "";

beforeAll(async () => {
  const compat = compatHandler(config, { getPageMarkdown: (path) => (path === "/pricing" ? "# Pricing\n- Free: $0\n- Pro: $20" : null) });
  const agentNodeHandler = toNodeHandler(agent.handler);
  server = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const compatRes = await compat({ path });
    if (compatRes) {
      res.statusCode = compatRes.status;
      for (const [k, v] of Object.entries(compatRes.headers)) res.setHeader(k, v);
      res.setHeader("content-type", compatRes.contentType);
      res.end(compatRes.body);
      return;
    }
    await agentNodeHandler(req, res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (addr && typeof addr === "object") base = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => server?.close());

describe("GraphewayClient", () => {
  test("getManifest returns site info and endpoints", async () => {
    const client = new GraphewayClient(base);
    const manifest = await client.getManifest();
    expect(manifest.site.name).toBe("Acme Store");
    expect(manifest.endpoints.mcp).toContain("/mcp");
  });

  test("getSections / getActions", async () => {
    const client = new GraphewayClient(base);
    const sections = await client.getSections();
    expect(sections[0]?.title).toBe("Catalog");
    const actions = await client.getActions();
    expect(actions.some((a) => a.name === "check_price")).toBe(true);
  });

  test("getLlmsTxt returns the markdown index", async () => {
    const client = new GraphewayClient(base);
    const llms = await client.getLlmsTxt();
    expect(llms).toContain("# Acme Store");
  });

  test("callAction invokes a custom action with args", async () => {
    const client = new GraphewayClient(base);
    const result = await client.callAction("check_price", { sku: "G-1" });
    expect(result).toEqual({ sku: "G-1", price: 42 });
  });

  test("getPage convenience resolves a section title", async () => {
    const client = new GraphewayClient(base);
    const md = await client.getPage("Pricing");
    expect(md).toContain("# Pricing");
  });

  test("search convenience", async () => {
    const client = new GraphewayClient(base);
    const result = await client.search("gadget");
    expect((result as any[])[0].snippet).toContain("gadget");
  });

  test("isAgentReady is true", async () => {
    const client = new GraphewayClient(base);
    expect(await client.isAgentReady()).toBe(true);
  });
});

describe("graph traversal (native access)", () => {
  test("getDiscovery returns the agent card", async () => {
    const client = new GraphewayClient(base);
    const d = await client.getDiscovery();
    expect(d.protocol).toBe("grapheway");
    expect(d.graph.nodes).toBeGreaterThanOrEqual(4);
    expect(d.endpoints.graph).toContain("/graph/v1");
  });

  test("graphSummary / graphSearch / graphNode", async () => {
    const client = new GraphewayClient(base);
    const summary = await client.graphSummary();
    expect(summary.nodes).toBe(4); // root + section + gadgets + pricing
    expect(summary.version).toBe(0);
    expect(summary.provenance?.["config"]).toBeGreaterThan(0);
    expect(summary.confidence?.extracted).toBeGreaterThan(0);
    const hits = await client.graphSearch("gadgets");
    expect(hits.results.length).toBeGreaterThan(0);
    expect(hits.results[0]!.node.label).toBe("Gadgets");
    const node = await client.graphNode(hits.results[0]!.node.id);
    expect(node?.label).toBe("Gadgets");
    expect(await client.graphNode("nope")).toBeNull();
  });

  test("getGraph returns the full live graph in one call", async () => {
    const client = new GraphewayClient(base);
    const full = await client.getGraph();
    expect(full.nodes.length).toBe(4);
    expect(full.edges.length).toBe(3);
    expect(full.version).toBe(0);
    expect(full.nodes.some((n) => n.type === "section")).toBe(true);
  });

  test("graphEdges and graphPath (auditable path with edges)", async () => {
    const client = new GraphewayClient(base);
    const gadgets = (await client.graphSearch("gadgets")).results[0]!.node.id;
    const root = (await client.graphSearch("Acme Store")).results[0]!.node.id;
    const neighbors = await client.graphEdges(gadgets, "in");
    expect(neighbors.edges.length).toBeGreaterThan(0);
    expect(neighbors.edges[0]!.provenance).toBeTruthy();
    const path = await client.graphPath(root, gadgets);
    expect(path?.path.length).toBe(3); // root → section → page
    expect(path?.edges).toHaveLength(2);
    expect(path?.edges[0]!.confidence).toBe("extracted");
    expect(await client.graphPath(root, `${root}/nope`)).toBeNull();
  });

  test("traverse walks the graph instead of crawling", async () => {
    const client = new GraphewayClient(base);
    const start = (await client.graphSearch("gadgets")).results[0]!.node.id;
    const walked = await client.traverse(start, 2);
    expect(walked.nodes.length).toBeGreaterThanOrEqual(4);
    expect(walked.edges.length).toBeGreaterThan(0);
  });

  test("subscribeGraph receives snapshot + runtime patches (realtime)", async () => {
    const client = new GraphewayClient(base);
    const events: Array<{ event: string; data: any }> = [];
    const unsub = await client.subscribeGraph((ev) => events.push(ev as any));
    await new Promise((r) => setTimeout(r, 100)); // let the snapshot arrive

    const liveId = `${base}/live-gadget`;
    agent.patchGraph([
      { type: "add_node", node: { id: liveId, type: "page", label: "Live Gadget" } },
    ]);
    await new Promise((r) => setTimeout(r, 200));
    unsub();

    const snap = events.find((e) => (e.data as any)?.type === "snapshot");
    expect(snap).toBeTruthy();
    expect((snap!.data as any).version).toBe(0);

    const patch = events.find((e) =>
      (e.data as any)?.patches?.some((p: any) => p.type === "add_node"),
    );
    expect(patch).toBeTruthy();
    expect((patch!.data as any).patches[0].node.label).toBe("Live Gadget");
  });
});

describe("probeSite", () => {
  test("reports agent endpoints and llms.txt", async () => {
    const report = await probeSite(base);
    expect((report["agent"] as any).site).toBe("Acme Store");
    expect((report["llms.txt"] as string)).toContain("# Acme Store");
  });

  test("gracefully reports a non-enabled site", async () => {
    const report = await probeSite("http://127.0.0.1:1");
    expect((report["agent"] as any).error).toBeTruthy();
  });
});
