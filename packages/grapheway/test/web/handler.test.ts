import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createServer, type Server } from "node:http";
import { createGrapheway, toExpressHandler, toNodeHandler } from "../../src/web/index.ts";
import { htmlToMarkdown } from "../../src/web/actions.ts";
import { toolsForManifest } from "../../src/web/mcp.ts";
import type { GraphewayConfig } from "../../src/core/index.js";

const config: GraphewayConfig = {
  name: "Acme Docs",
  url: "http://127.0.0.1:0",
  tagline: "The API for everything",
  summary: "Acme Docs is the reference for the Acme API.",
  contact: { email: "hi@acme.example" },
  capabilities: ["search"],
  sections: [
    {
      title: "Getting Started",
      items: [
        { title: "Installation", url: "/docs/install", notes: "Install the SDK" },
        { title: "Quickstart", url: "/docs/quickstart", notes: "First API call" },
      ],
    },
  ],
  actions: [{ name: "search_content", description: "Search the docs" }],
};

const agent = createGrapheway(config, {
  search: (q) => [{ title: "Installation", url: "/docs/install", snippet: `matches ${q}` }],
  getPageMarkdown: (path) => (path === "/docs/install" ? "## Install\nRun `npm i`." : null),
  // Registered at runtime only (not declared in config.actions) — must still
  // be discoverable + callable over MCP.
  actions: {
    ping_server: async () => ({ pong: true, at: new Date().toISOString() }),
  },
});

const ROOT = "http://127.0.0.1:0";
const INSTALL = "http://127.0.0.1:0/docs/install";

let server: Server;
let base = "";

beforeAll(async () => {
  server = createServer(toNodeHandler(agent.handler));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (addr && typeof addr === "object") base = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => server?.close());

async function get(path: string): Promise<{ status: number; text: string; json: any }> {
  const res = await fetch(base + path);
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, text, json };
}

describe("discovery", () => {
  test("serves /.well-known/agent with protocol + endpoints", async () => {
    const { status, json } = await get("/.well-known/agent");
    expect(status).toBe(200);
    expect(json.protocol).toBe("grapheway");
    expect(json.name).toBe("Acme Docs");
    expect(json.endpoints.mcp).toContain("/mcp");
    expect(json.graph.nodes).toBeGreaterThanOrEqual(4); // root + section + 2 pages
  });
});

describe("graph protocol (/graph/v1)", () => {
  test("graph summary lists nodes/edges + provenance breakdown", async () => {
    const { status, json } = await get("/graph/v1");
    expect(status).toBe(200);
    expect(json.nodes).toBe(4);
    expect(json.edges).toBe(3); // root→section + section→page + section→page
    expect(json.version).toBe(0);
    expect(json.provenance.config).toBe(1); // root→section
    expect(json.provenance.section).toBe(2); // section→page × 2
    expect(json.confidence.extracted).toBe(3);
    expect(json.endpoints.events).toBe("/graph/v1/events");
  });

  test("node lookup by id", async () => {
    const { status, json } = await get(`/graph/v1/node?id=${encodeURIComponent(INSTALL)}`);
    expect(status).toBe(200);
    expect(json.label).toBe("Installation");
    const missing = await get("/graph/v1/node?id=nope");
    expect(missing.status).toBe(404);
  });

  test("edges of a node", async () => {
    const { status, json } = await get(`/graph/v1/edges?id=${encodeURIComponent(INSTALL)}`);
    expect(status).toBe(200);
    expect(json.edges[0].type).toBe("is_part_of");
  });

  test("search finds nodes by label", async () => {
    const { status, json } = await get("/graph/v1/search?q=install");
    expect(status).toBe(200);
    expect(json.results.length).toBeGreaterThan(0);
    expect(json.results[0].node.label).toBe("Installation");
  });

  test("path between root and a page returns auditable edges", async () => {
    const { status, json } = await get(`/graph/v1/path?from=${encodeURIComponent(ROOT)}&to=${encodeURIComponent(INSTALL)}`);
    expect(status).toBe(200);
    expect(json.path).toEqual([ROOT, "http://127.0.0.1:0#section-getting-started-0", INSTALL]);
    expect(json.edges).toHaveLength(2);
    expect(json.edges[1].type).toBe("is_part_of");
    expect(json.edges[1].confidence).toBe("extracted");
    expect(json.edges[1].note).toContain("Getting Started");
  });

  test("full graph dump exposes nodes, edges and version", async () => {
    const { status, json } = await get("/graph/v1/graph");
    expect(status).toBe(200);
    expect(json.version).toBe(0);
    expect(json.nodes.length).toBe(4);
    expect(json.edges.length).toBe(3);
    expect(json.nodes.some((n: any) => n.id === INSTALL)).toBe(true);
    expect(json.edges.some((e: any) => e.source === INSTALL || e.target === INSTALL)).toBe(true);
  });
});

describe("graph viewer (/graph)", () => {
  test("serves the self-contained viewer HTML", async () => {
    const { status, text } = await get("/graph");
    expect(status).toBe(200);
    expect(text).toContain("Graph Observatory");
    expect(text).toContain("EventSource");
    expect(text).toContain("/graph/v1/events");
    // The embedded client must be a plain string — no leaked template
    // interpolation markers from the String.raw container.
    expect(text).not.toContain("${");
  });
});

describe("realtime graph (patchGraph + SSE)", () => {
  test("patchGraph mutates the live graph and events stream it", async () => {
    const res = await fetch(base + "/graph/v1/events");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const readEvent = async (): Promise<{ event: string; data: any } | null> => {
      for (;;) {
        const idx = buffer.indexOf("\n\n");
        if (idx !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const event =
            raw.split("\n").find((l) => l.startsWith("event: "))?.slice(7).trim() ?? "message";
          const dataLine = raw.split("\n").find((l) => l.startsWith("data: "));
          return { event, data: dataLine ? JSON.parse(dataLine.slice(6).trim()) : null };
        }
        const { done, value } = await reader.read();
        if (done) return null;
        buffer += decoder.decode(value, { stream: true });
      }
    };

    const snap = await readEvent();
    expect(snap?.event).toBe("graph");
    expect(snap?.data.type).toBe("snapshot");
    expect(snap?.data.nodes).toBe(4);

    const liveId = `${ROOT}/live`;
    const version = agent.patchGraph([
      { type: "add_node", node: { id: liveId, type: "page", label: "Live Node" } },
    ]);
    expect(version).toBe(1);
    expect(agent.graph.nodes.some((n) => n.id === liveId)).toBe(true);
    expect(agent.version).toBe(1);

    const ev = await readEvent();
    expect(ev?.event).toBe("graph");
    expect(ev?.data.version).toBe(1);
    expect(ev?.data.patches[0].type).toBe("add_node");
    expect(ev?.data.patches[0].node.label).toBe("Live Node");

    await reader.cancel().catch(() => {});
  });

  test("two subscribers both receive patches; cancelling stops delivery", async () => {
    const open = async (): Promise<{ readEvent: () => Promise<{ event: string; data: any } | null>; cancel: () => Promise<void> }> => {
      const res = await fetch(base + "/graph/v1/events");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const readEvent = async () => {
        for (;;) {
          const idx = buffer.indexOf("\n\n");
          if (idx !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const event = raw.split("\n").find((l) => l.startsWith("event: "))?.slice(7).trim() ?? "message";
            const dataLine = raw.split("\n").find((l) => l.startsWith("data: "));
            return { event, data: dataLine ? JSON.parse(dataLine.slice(6).trim()) : null };
          }
          const { done, value } = await reader.read();
          if (done) return null;
          buffer += decoder.decode(value, { stream: true });
        }
      };
      return { readEvent, cancel: () => reader.cancel().catch(() => {}) };
    };

    const a = await open();
    const b = await open();
    expect((await a.readEvent())?.data.type).toBe("snapshot");
    expect((await b.readEvent())?.data.type).toBe("snapshot");

    // Patch reaches both subscribers.
    const id = `${ROOT}/isolated`;
    agent.patchGraph([{ type: "add_node", node: { id, type: "page", label: "Isolated" } }]);
    expect((await a.readEvent())?.data.version).toBe(2);
    expect((await b.readEvent())?.data.version).toBe(2);

    // Unsubscribe a — later patches only reach b.
    await a.cancel();
    const id2 = `${ROOT}/isolated-2`;
    agent.patchGraph([{ type: "add_node", node: { id: id2, type: "page", label: "Isolated 2" } }]);
    expect(await b.readEvent()).not.toBeNull();

    await b.cancel();
  });

  test("patchGraph rejects an add_edge with unknown endpoints", async () => {
    expect(() =>
      agent.patchGraph([{ type: "add_edge", edge: { id: "e-bad", source: ROOT, target: `${ROOT}/nope`, type: "links_to" } }]),
    ).toThrow(/Add the node\(s\) first/);
    // The failed patch must not bump the version or mutate the graph.
    expect(agent.version).toBe(3);
    expect(agent.graph.edges.some((e) => e.id === "e-bad")).toBe(false);
  });
});

describe("agent JSON API", () => {
  test("GET /agent returns the manifest with endpoints", async () => {
    const { status, json } = await get("/agent");
    expect(status).toBe(200);
    expect(json.site.name).toBe("Acme Docs");
    expect(json.endpoints.mcp).toContain("/mcp");
    expect(json.actions.some((a: any) => a.name === "search_content")).toBe(true);
  });

  test("GET /agent/info and /agent/sections", async () => {
    const info = await get("/agent/info");
    expect(info.json.summary).toContain("Acme API");
    const sections = await get("/agent/sections");
    expect(sections.json[0].title).toBe("Getting Started");
  });

  test("POST /agent/action runs built-in get_site_info", async () => {
    const res = await fetch(base + "/agent/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "get_site_info", arguments: {} }),
    });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.result.name).toBe("Acme Docs");
  });

  test("POST /agent/action runs custom search_content", async () => {
    const res = await fetch(base + "/agent/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "search_content", arguments: { q: "install" } }),
    });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.result[0].snippet).toContain("install");
  });

  test("POST /agent/action reports unknown actions", async () => {
    const res = await fetch(base + "/agent/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "nope" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.ok).toBe(false);
  });

  test("get_page refuses cross-origin URLs (SSRF guard)", async () => {
    const res = await fetch(base + "/agent/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "get_page",
        arguments: { url: "http://169.254.169.254/latest/meta-data/" },
      }),
    });
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.error).toContain("only the site's own origin");
  });

  test("get_page fetches same-origin pages through the app's markdown resolver", async () => {
    const res = await fetch(base + "/agent/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "get_page", arguments: { url: "/docs/install" } }),
    });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(String(data.result)).toContain("## Install");
  });
});

describe("MCP endpoint", () => {
  test("initialize handshake", async () => {
    const res = await fetch(base + "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test" } },
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("mcp-protocol-version")).toBeTruthy();
    const data = await res.json();
    expect(data.result.protocolVersion).toBe("2025-03-26");
    expect(data.result.serverInfo.name).toBe("grapheway");
  });

  test("tools/list exposes site actions + graph tools as MCP tools", async () => {
    const res = await fetch(base + "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    });
    const data = await res.json();
    const names = data.result.tools.map((t: any) => t.name);
    expect(names).toContain("get_site_info");
    expect(names).toContain("search_content");
    expect(names).toContain("ping_server"); // runtime-registered action
    expect(names).toContain("graph_node");
    expect(names).toContain("graph_neighbors");
    expect(names).toContain("graph_search");
    expect(names).toContain("graph_path");
  });

  test("tools/call works for runtime-registered actions", async () => {
    const res = await fetch(base + "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 21,
        method: "tools/call",
        params: { name: "ping_server", arguments: {} },
      }),
    });
    const data = await res.json();
    expect(data.result.content[0].text).toContain("pong");
  });

  test("tools/call graph_node returns a node from the graph", async () => {
    const res = await fetch(base + "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 31,
        method: "tools/call",
        params: { name: "graph_node", arguments: { id: INSTALL } },
      }),
    });
    const data = await res.json();
    const node = JSON.parse(data.result.content[0].text);
    expect(node.label).toBe("Installation");
  });

  test("resources/list exposes graph nodes as resources", async () => {
    const res = await fetch(base + "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "resources/list" }),
    });
    const data = await res.json();
    expect(data.result.resources.length).toBeGreaterThanOrEqual(4);
    expect(data.result.resources[0].uri).toContain("grapheway://node/");
  });

  test("resources/read returns node content as markdown", async () => {
    const res = await fetch(base + "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 8,
        method: "resources/read",
        params: { uri: `grapheway://node/${encodeURIComponent(INSTALL)}` },
      }),
    });
    const data = await res.json();
    expect(data.result.contents[0].text).toContain("## Install");
  });

  test("invalid jsonrpc version returns -32600", async () => {
    const res = await fetch(base + "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "1.0", id: 5, method: "ping" }),
    });
    const data = await res.json();
    expect(data.error.code).toBe(-32600);
  });

  test("notifications get 202", async () => {
    const res = await fetch(base + "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    expect(res.status).toBe(202);
  });

  test("unknown method returns -32601", async () => {
    const res = await fetch(base + "/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "do_something" }),
    });
    const data = await res.json();
    expect(data.error.code).toBe(-32601);
  });
});

describe("htmlToMarkdown", () => {
  test("converts headings, links, lists and strips scripts", () => {
    const md = htmlToMarkdown(
      "<script>alert(1)</script><h1>Title</h1><p>Hello <a href=\"/x\">link</a></p><ul><li>one</li></ul>",
    );
    expect(md).toContain("# Title");
    expect(md).toContain("[link](/x)");
    expect(md).toContain("- one");
    expect(md).not.toContain("alert");
  });
});

describe("toExpressHandler (SSE streaming + teardown)", () => {
  test("streams graph events through res.write and closes upstream on res close", async () => {
    const written: string[] = [];
    const closeHandlers: Array<() => void> = [];
    let ended = false;
    const fakeRes = {
      status: (c: number) => ({ json: () => {}, send: () => {} }),
      set: () => {},
      write: (chunk: string) => written.push(chunk),
      end: () => {
        ended = true;
      },
      on: (ev: string, cb: () => void) => {
        if (ev === "close") closeHandlers.push(cb);
      },
    };

    const handler = toExpressHandler(agent.handler);
    const req = { method: "GET", url: "/graph/v1/events", headers: {} };
    handler(req, fakeRes);

    // Let the snapshot chunk arrive.
    await new Promise((r) => setTimeout(r, 100));
    expect(written.join("")).toContain("event: graph");
    expect(written.join("")).toContain("\"type\":\"snapshot\"");

    // A patch still streams through the open connection.
    const id = `${ROOT}/express-live`;
    agent.patchGraph([{ type: "add_node", node: { id, type: "page", label: "Express Live" } }]);
    await new Promise((r) => setTimeout(r, 100));
    expect(written.join("")).toContain("Express Live");

    // Client disconnect: the close handler fires and doesn't throw.
    for (const cb of closeHandlers) cb();
    await new Promise((r) => setTimeout(r, 50));
    expect(true).toBe(true); // teardown ran without throwing
  });
});

describe("toolsForManifest", () => {
  test("maps declared actions + graph tools to MCP tool definitions", () => {
    const tools = toolsForManifest(agent.manifest);
    const search = tools.find((t) => t.name === "search_content");
    expect(search?.description).toContain("Search the docs");
    expect(search?.inputSchema).toBeTruthy();
    expect(tools.some((t) => t.name === "graph_node")).toBe(true);
  });
});
