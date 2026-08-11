import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createServer, type Server } from "node:http";
import { compatHandler } from "../src/index.ts";
import type { GraphewayConfig } from "grapheway";

const config: GraphewayConfig = {
  name: "Acme Docs",
  url: "http://127.0.0.1:0",
  tagline: "The API for everything",
  summary: "Acme Docs is the reference for the Acme API.",
  sections: [
    {
      title: "Getting Started",
      items: [
        { title: "Installation", url: "/docs/install", notes: "Install the SDK" },
        { title: "Quickstart", url: "/docs/quickstart", notes: "First API call" },
      ],
    },
  ],
};

let server: Server;
let base = "";

beforeAll(async () => {
  const compat = compatHandler(config, {
    getPageMarkdown: (path) => (path === "/docs/install" ? "## Install\nRun `npm i`." : null),
  });
  server = createServer(async (req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const compatRes = await compat({ path });
    if (!compatRes) {
      res.statusCode = 404;
      res.end("not compat");
      return;
    }
    res.statusCode = compatRes.status;
    for (const [k, v] of Object.entries(compatRes.headers)) res.setHeader(k, v);
    res.setHeader("content-type", compatRes.contentType);
    res.end(compatRes.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (addr && typeof addr === "object") base = `http://127.0.0.1:${addr.port}`;
});

afterAll(() => server?.close());

async function get(path: string): Promise<{ status: number; text: string }> {
  const res = await fetch(base + path);
  return { status: res.status, text: await res.text() };
}

describe("compatHandler", () => {
  test("serves llms.txt", async () => {
    const { status, text } = await get("/llms.txt");
    expect(status).toBe(200);
    expect(text).toContain("# Acme Docs");
    expect(text).toContain("## Getting Started");
  });

  test("serves llms-full.txt with inline markdown", async () => {
    const { status, text } = await get("/llms-full.txt");
    expect(status).toBe(200);
    expect(text).toContain("## Install");
  });

  test("serves agents.txt, agents.json, robots.txt and sitemap.xml", async () => {
    const txt = await get("/agents.txt");
    expect(txt.status).toBe(200);
    expect(txt.text).toContain("## API");
    const js = await get("/agents.json");
    expect(js.status).toBe(200);
    expect(js.text).toContain('"site"');
    const robots = await get("/robots.txt");
    expect(robots.status).toBe(200);
    expect(robots.text).toContain("User-agent: GPTBot");
    const sitemap = await get("/sitemap.xml");
    expect(sitemap.status).toBe(200);
    expect(sitemap.text).toContain("<urlset");
  });

  test("returns null for unknown paths (caller falls through)", async () => {
    const compat = compatHandler(config);
    expect(await compat({ path: "/agent" })).toBeNull();
  });

  test("answers OPTIONS preflight with 204 and falls through for non-GET", async () => {
    const compat = compatHandler(config);
    const preflight = await compat({ path: "/llms.txt", method: "OPTIONS" });
    expect(preflight?.status).toBe(204);
    expect(preflight?.headers["access-control-allow-origin"]).toBe("*");
    expect(await compat({ path: "/llms.txt", method: "POST" })).toBeNull();
  });
});
