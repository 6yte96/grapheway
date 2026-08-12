import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mcpConfigJson, parseGatewayFlags, runGateway } from "../src/gateway.ts";

// ── A fake legacy site for probe-mode ─────────────────────────────────────
const HOME = `<html><head><title>Probe Me | Example</title>
<meta name="description" content="A tiny legacy site."></head>
<body><nav><a href="/">Home</a><a href="/docs">Docs</a></nav>
<main><h1>Probe Me</h1><p>See <a href="/docs">the docs</a>.</p></main></body></html>`;
const DOCS = `<html><head><title>Docs | Example</title></head>
<body><nav><a href="/">Home</a><a href="/docs">Docs</a></nav>
<main><h1>Docs</h1><p>All the docs.</p></main></body></html>`;

let server: Server;
let base = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const html = url.pathname === "/" ? HOME : url.pathname === "/docs" ? DOCS : null;
    if (html) {
      res.setHeader("content-type", "text/html");
      res.end(html);
      return;
    }
    res.statusCode = 404;
    res.end("Not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (addr && typeof addr === "object") base = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => server?.close());

describe("parseGatewayFlags", () => {
  test("defaults: port 4321, localhost-only, positive ints", () => {
    const flags = parseGatewayFlags(["--probe", "https://x.example", "--refresh", "12", "--depth", "2", "--max-pages", "10"]);
    expect(flags.probeUrl).toBe("https://x.example");
    expect(flags.port).toBe(4321);
    expect(flags.host).toBe("127.0.0.1");
    expect(flags.refreshHours).toBe(12);
    expect(flags.depth).toBe(2);
    expect(flags.maxPages).toBe(10);
  });

  test("requires exactly one graph source", () => {
    expect(() => parseGatewayFlags([])).toThrow(/exactly one graph source/);
    expect(() => parseGatewayFlags(["--probe", "a", "--config", "b"])).toThrow(/exactly one graph source/);
    expect(() => parseGatewayFlags(["--graph", "g.json", "--port", "0"])).not.toThrow();
  });

  test("--refresh is only valid with --probe", () => {
    expect(() => parseGatewayFlags(["--config", "c.json", "--refresh", "12"])).toThrow(/--refresh/);
    expect(() => parseGatewayFlags(["--probe", "https://x.example", "--refresh", "12"])).not.toThrow();
  });
});

describe("mcpConfigJson", () => {
  test("prints the mcpServers snippet agents paste", () => {
    expect(mcpConfigJson("http://localhost:4321/mcp")).toBe(
      JSON.stringify({ mcpServers: { grapheway: { url: "http://localhost:4321/mcp" } } }, null, 2),
    );
  });
});

describe("runGateway", () => {
  test("probe mode: holds a crawled graph and speaks MCP over HTTP", async () => {
    const gw = await runGateway({ port: 0, host: "127.0.0.1", probeUrl: base, depth: 2, maxPages: 20 });
    const url = `http://127.0.0.1:${gw.port}`;
    try {
      // Discovery + graph.
      const discovery = await (await fetch(url + "/.well-known/agent")).json();
      expect(discovery.protocol).toBe("grapheway");
      const summary = await (await fetch(url + "/graph/v1")).json();
      expect(summary.nodes).toBeGreaterThan(0);

      // MCP endpoint (the flagship door).
      const mcp = await fetch(url + "/mcp");
      expect(mcp.status).toBe(200);
      expect(mcp.headers.get("content-type")).toContain("text/event-stream");

      // Agent manifest.
      const manifest = await (await fetch(url + "/agent")).json();
      expect(manifest.site.name).toContain("Probe Me");
    } finally {
      await gw.close();
    }
  });

  test("config mode: config-defined graph + compat files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gw-config-"));
    const cfg = join(dir, "grapheway.config.json");
    writeFileSync(
      cfg,
      JSON.stringify({
        name: "Gateway Config Site",
        url: "http://localhost",
        sections: [{ title: "Docs", items: [{ title: "Install", url: "/install" }] }],
      }),
    );
    try {
      const gw = await runGateway({ port: 0, host: "127.0.0.1", configPath: cfg });
      const url = `http://127.0.0.1:${gw.port}`;
      try {
        const manifest = await (await fetch(url + "/agent")).json();
        expect(manifest.site.name).toBe("Gateway Config Site");
        const llms = await fetch(url + "/llms.txt");
        expect(llms.status).toBe(200);
        expect(await llms.text()).toContain("# Gateway Config Site");
      } finally {
        await gw.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("graph mode: holds an exported graph.json", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gw-graph-"));
    const file = join(dir, "graph.json");
    writeFileSync(
      file,
      JSON.stringify({
        config: { name: "Exported Graph", url: "http://localhost", capabilities: ["graph"] },
        graph: {
          nodes: [
            { id: "urn:g:1", type: "entity", label: "Alpha" },
            { id: "urn:g:2", type: "entity", label: "Beta" },
          ],
          edges: [{ id: "e-g", source: "urn:g:1", target: "urn:g:2", type: "related" }],
        },
      }),
    );
    try {
      const gw = await runGateway({ port: 0, host: "127.0.0.1", graphPath: file });
      const url = `http://127.0.0.1:${gw.port}`;
      try {
        const summary = await (await fetch(url + "/graph/v1")).json();
        expect(summary.nodes).toBe(2);
        expect(summary.edges).toBe(1);
        // The MCP door is open on exported graphs too.
        expect((await fetch(url + "/mcp")).status).toBe(200);
      } finally {
        await gw.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
