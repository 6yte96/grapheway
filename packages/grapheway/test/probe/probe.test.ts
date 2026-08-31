import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { createServer, type Server } from "node:http";
import {
  buildFromCrawl,
  createProbeAgent,
  crawlSite,
  extractPage,
  htmlToMarkdown,
  probeSite,
  serveProbed,
  summarizeProbe,
} from "../../src/probe/index.ts";

// ── A fake legacy docs site: plain HTML, no framework, no grapheway ─────
const SITE = `
<html><head><title>Widget Docs | WidgetCo</title>
<meta name="description" content="Official documentation for the Widget API.">
</head>
<body>
<nav>
  <a href="/">Home</a>
  <a href="/getting-started">Getting Started</a>
  <a href="/api-reference">API Reference</a>
  <a href="/guides/install">Install Guide</a>
</nav>
<main>
<h1>Welcome to Widget Docs</h1>
<p>Everything you need to build with widgets. See <a href="/getting-started">the quickstart</a>.</p>
<h2>Popular topics</h2>
<ul>
  <li><a href="/api-reference">API Reference</a></li>
</ul>
</main>
</body></html>`;

const GETTING_STARTED = `
<html><head><title>Getting Started | WidgetCo</title></head>
<body>
<nav><a href="/">Home</a><a href="/getting-started">Getting Started</a><a href="/api-reference">API Reference</a></nav>
<main>
<h1>Getting Started</h1>
<p>Follow the <a href="/guides/install">install guide</a> first.</p>
<h2 id="quickstart">Quickstart</h2>
<p>Create your first widget in 5 minutes.</p>
</main>
</body></html>`;

const API_REFERENCE = `
<html><head><title>API Reference | WidgetCo</title></head>
<body>
<nav><a href="/">Home</a><a href="/getting-started">Getting Started</a><a href="/api-reference">API Reference</a></nav>
<main>
<h1>API Reference</h1>
<p>All endpoints. See <a href="/getting-started">getting started</a>.</p>
<h2 id="widgets">Widgets</h2>
<p>Manage widgets.</p>
</main>
</body></html>`;

const OPENAPI = {
  openapi: "3.0.0",
  info: { title: "Widget API", version: "1.0.0" },
  paths: {
    "/widgets": {
      get: { summary: "List widgets", tags: ["widgets"], operationId: "listWidgets" },
      post: { summary: "Create a widget", tags: ["widgets"], operationId: "createWidget" },
    },
    "/widgets/{id}": {
      get: { summary: "Get a widget", tags: ["widgets"] },
    },
  },
};

const PAGES: Record<string, string> = {
  "/": SITE,
  "/getting-started": GETTING_STARTED,
  "/api-reference": API_REFERENCE,
};

let server: Server;
let base = "";

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/openapi.json") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(OPENAPI));
      return;
    }
    const html = PAGES[url.pathname];
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

describe("html knowledge extraction", () => {
  test("extracts title, description, nav links, headings", () => {
    const page = extractPage(SITE, new URL(base + "/"));
    expect(page.title).toContain("Widget Docs");
    expect(page.description).toContain("Widget API");
    const navLinks = page.links.filter((l) => l.inNav);
    expect(navLinks.length).toBeGreaterThanOrEqual(4);
    expect(navLinks[1]?.text).toBe("Getting Started");
    const headings = page.headings;
    expect(headings[0]?.text).toBe("Welcome to Widget Docs");
    expect(headings[0]?.level).toBe(1);
  });

  test("htmlToMarkdown strips nav and keeps headings + links", () => {
    const md = htmlToMarkdown(SITE);
    expect(md).toContain("# Welcome to Widget Docs");
    expect(md).toContain("[the quickstart](/getting-started)");
    expect(md).not.toContain("<nav>");
  });

  test("slugify produces stable anchors", () => {
    const page = extractPage(GETTING_STARTED, new URL(base + "/getting-started"));
    expect(page.headings.some((h) => h.id === "quickstart")).toBe(true);
  });
});

describe("crawlSite", () => {
  test("crawls same-origin pages, respects depth, finds OpenAPI", async () => {
    const crawl = await crawlSite(base, { maxDepth: 2, maxPages: 20 });
    expect(crawl.pages.size).toBeGreaterThanOrEqual(3);
    expect(crawl.pages.has(base + "/")).toBe(true);
    expect(crawl.pages.has(base + "/getting-started")).toBe(true);
    expect(crawl.openApi).toBeTruthy();
    expect(crawl.openApiUrl).toBe(base + "/openapi.json");
  });

  test("does not crawl external origins or assets", async () => {
    const crawl = await crawlSite(base, { maxPages: 50 });
    for (const url of crawl.pages.keys()) {
      expect(url.startsWith(base)).toBe(true);
    }
  });
});

describe("buildFromCrawl (knowledge → graph)", () => {
  test("builds a tagged graph: pages, headings, links, endpoints", async () => {
    const crawl = await crawlSite(base, { maxDepth: 2, maxPages: 20 });
    const result = buildFromCrawl(base, [...crawl.pages.values()], crawl.openApi, crawl.openApiUrl);

    const { graph, config } = result;

    // Pages → nodes.
    const pageNodes = graph.nodes.filter((n) => n.type === "page");
    expect(pageNodes.length).toBeGreaterThanOrEqual(3);

    // Headings → section nodes.
    const sectionNodes = graph.nodes.filter((n) => n.type === "section");
    expect(sectionNodes.length).toBeGreaterThanOrEqual(3); // h1/h2 across pages

    // OpenAPI → api nodes.
    const apiNodes = graph.nodes.filter((n) => n.type === "api");
    expect(apiNodes.length).toBe(3); // list, create, get
    const listWidgets = apiNodes.find((n) => String(n.props?.path) === "/widgets");
    expect(listWidgets?.props?.method).toBe("get");

    // Edges carry provenance + confidence.
    const navEdges = graph.edges.filter((e) => e.confidence === "extracted" && e.provenance === "link");
    expect(navEdges.length).toBeGreaterThan(0);
    const headingEdges = graph.edges.filter((e) => e.type === "is_part_of");
    expect(headingEdges.length).toBeGreaterThan(0);
    expect(headingEdges[0]?.confidence).toBe("inferred");

    // Config derived from content.
    expect(config.name).toBe("Widget Docs");
    expect(config.url).toBe(base);
    expect(config.summary).toContain("Widget API");
    expect(config.sections?.length).toBeGreaterThan(0);

    // Report renders.
    const report = summarizeProbe(result);
    expect(report).toContain("pages:");
    expect(report).toContain("endpoints");
  });
});

describe("serveProbed (agents point at localhost)", () => {
  test("serves the full agent surface for a probed legacy site", async () => {
    const served = await serveProbed(base, { port: 0, maxDepth: 2, maxPages: 20 });
    const port = (served as any).port as number;
    const url = `http://127.0.0.1:${port}`;

    // Discovery.
    const discovery = await (await fetch(url + "/.well-known/agent")).json();
    expect(discovery.protocol).toBe("grapheway");
    expect(discovery.graph.nodes).toBeGreaterThan(0);

    // Graph summary with provenance.
    const summary = await (await fetch(url + "/graph/v1")).json();
    expect(summary.nodes).toBeGreaterThan(0);
    expect(summary.provenance?.link).toBeGreaterThan(0);

    // get_page → live markdown conversion.
    const pageRes = await fetch(url + "/agent/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "get_page", arguments: { url: "/getting-started" } }),
    });
    const pageData = await pageRes.json();
    expect(pageData.ok).toBe(true);
    expect(String(pageData.result)).toContain("# Getting Started");

    // search_content over probed content.
    const searchRes = await fetch(url + "/agent/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "search_content", arguments: { q: "widget" } }),
    });
    const searchData = await searchRes.json();
    expect(searchData.ok).toBe(true);
    expect((searchData.result as any[]).length).toBeGreaterThan(0);

    await served.close();
  });
});

describe("probeSite + export", () => {
  test("one-shot probe builds a graph", async () => {
    const result = await probeSite(base, { maxDepth: 2, maxPages: 20 });
    expect(result.graph.nodes.length).toBeGreaterThan(0);
    expect(result.config.url).toBe(base);
  });
});

describe("createProbeAgent (graph-holding agent + refresh)", () => {
  test("refresh re-crawls and patches the live graph (SSE subscribers see it)", async () => {
    const initial = await probeSite(base, { maxDepth: 2, maxPages: 20 });
    const holder = createProbeAgent(base, initial);
    const v0 = holder.agent.version;
    const before = holder.agent.graph.nodes.length;
    expect(holder.result).toBe(initial);

    // The site gains a page reachable from the root nav.
    const OLD_SITE = PAGES["/"] ?? SITE;
    const NEW_PAGE = `<html><head><title>Fresh Page | WidgetCo</title></head>
<body><nav><a href="/">Home</a></nav><main>
<h1>Fresh Page</h1><p>Just published.</p>
</main></body></html>`;
    (PAGES as Record<string, string>)["/"] = SITE.replace("</nav>", `<a href="/fresh-page">Fresh Page</a></nav>`);
    (PAGES as Record<string, string>)["/fresh-page"] = NEW_PAGE;
    try {
      const next = await probeSite(base, { maxDepth: 2, maxPages: 20 });
      const version = holder.refresh(next);
      expect(version).toBe(v0 + 1);
      expect(holder.agent.graph.nodes.some((n) => n.id === base + "/fresh-page")).toBe(true);
      expect(holder.agent.graph.nodes.length).toBeGreaterThan(before);
      // getPageMarkdown now serves the newly discovered page from the crawl.
      const md = await holder.agent.handler({
        url: "/agent/action",
        method: "POST",
        headers: {},
        body: { name: "get_page", arguments: { url: "/fresh-page" } },
      });
      expect(String((JSON.parse(md.body ?? "{}") as any).result)).toContain("# Fresh Page");
    } finally {
      (PAGES as Record<string, string>)["/"] = OLD_SITE;
      delete (PAGES as Record<string, string>)["/fresh-page"];
    }
  });
});
