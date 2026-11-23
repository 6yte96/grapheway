/**
 * Grapheway Hosted MCP — a zero-install remote MCP endpoint.
 *
 *   POST https://<worker>/mcp?url=https://docs.example.com
 *
 * The Worker probes the target site (same-origin, robots-aware, 12 pages),
 * builds the knowledge graph, and serves the full grapheway MCP surface —
 * graph tools, site actions and markdown resources — for that URL.
 *
 * One endpoint, any website, no install, no account. This is a free demo
 * and a distribution surface for the protocol. It is not a general-purpose
 * open proxy: private/internal hosts are rejected, pages are capped, and
 * results are cached for ten minutes.
 */

import { crawlSite } from "../../../packages/grapheway/src/probe/crawler.ts";
import { buildFromCrawl } from "../../../packages/grapheway/src/probe/graph.ts";
import { htmlToMarkdown } from "../../../packages/grapheway/src/probe/html.ts";
import type { KnowledgeGraph } from "../../../packages/grapheway/src/core/index.ts";
import { createGrapheway } from "../../../packages/grapheway/src/web/handler.ts";
import { handleMcpMessage, type McpDeps } from "../../../packages/grapheway/src/web/mcp.ts";

const VERSION = "0.2.6";
const MAX_PAGES = 12;
const TTL_MS = 10 * 60 * 1000;
const MAX_CACHE = 40;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;

type Agent = ReturnType<typeof createGrapheway>;

interface ProbeEntry {
  agent: Agent;
  graph: KnowledgeGraph;
  expires: number;
}

const probeCache = new Map<string, ProbeEntry>();
const rate = new Map<string, { count: number; reset: number }>();

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, mcp-session-id, x-grapheway-url",
  "access-control-expose-headers": "mcp-session-id, x-grapheway-target",
};

function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...CORS, "content-type": "application/json; charset=utf-8", ...extra },
  });
}

function text(body: string, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: { ...CORS, "content-type": "text/plain; charset=utf-8", ...extra },
  });
}

/** Reject localhost, private ranges and metadata hosts (basic SSRF guard). */
function isSafeUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h === "0.0.0.0" ||
    h === "::1" ||
    h === "[::1]" ||
    h.endsWith(".internal") ||
    h === "metadata.google.internal" ||
    h.endsWith(".local")
  ) {
    return false;
  }
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return false;
  const m = h.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return false;
  return true;
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rate.get(ip);
  if (!entry || entry.reset < now) {
    rate.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

async function buildAgent(target: string): Promise<ProbeEntry> {
  const key = target.replace(/\/+$/, "");
  const hit = probeCache.get(key);
  if (hit && hit.expires > Date.now()) return hit;

  const crawl = await crawlSite(key, {
    maxPages: MAX_PAGES,
    maxDepth: 2,
    concurrency: 3,
    headers: { "user-agent": `grapheway-hosted/${VERSION} (+https://github.com/6yte96/grapheway)` },
  });
  const result = buildFromCrawl(
    key,
    [...crawl.pages.values()],
    crawl.openApi,
    crawl.openApiUrl,
    crawl.stats,
  );

  const pages = new Map(result.pages.map((p) => [new URL(p.url).pathname, p.html]));
  const agent = createGrapheway(result.config, {
    graph: { builder: () => result.graph },
    getPageMarkdown: async (path: string) => {
      let normalized: string;
      try {
        normalized = new URL(path, key).pathname;
      } catch {
        normalized = path.startsWith("/") ? path : `/${path}`;
      }
      const cached = pages.get(normalized);
      if (cached) return htmlToMarkdown(cached);
      try {
        const res = await fetch(`${key}${normalized}`, {
          headers: { "user-agent": `grapheway-hosted/${VERSION}` },
        });
        if (!res.ok) return null;
        return htmlToMarkdown(await res.text());
      } catch {
        return null;
      }
    },
  });

  const entry: ProbeEntry = { agent, graph: result.graph, expires: Date.now() + TTL_MS };
  if (probeCache.size >= MAX_CACHE) probeCache.clear();
  probeCache.set(key, entry);
  return entry;
}

async function callAction(agent: Agent, name: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await agent.handler({
    method: "POST",
    url: "/agent/action",
    headers: { "content-type": "application/json" },
    body: { name, arguments: args },
  });
  const data = JSON.parse(res.body) as { ok?: boolean; result?: unknown; error?: string };
  if (!data.ok) throw new Error(data.error ?? `Action ${name} failed`);
  return data.result;
}

function depsFor(entry: ProbeEntry): McpDeps {
  return {
    manifest: entry.agent.manifest,
    graph: entry.graph,
    runAction: (name, args) => callAction(entry.agent, name, args),
    readNode: async (id) => {
      try {
        const page = await callAction(entry.agent, "get_page", { url: id });
        if (typeof page === "string") return page;
      } catch {
        // fall through
      }
      const res = await entry.agent.handler({
        method: "GET",
        url: `/graph/v1/node?id=${encodeURIComponent(id)}`,
        headers: {},
      });
      return res.body;
    },
  };
}

const discovery = {
  protocol: "grapheway",
  version: VERSION,
  name: "Grapheway Hosted MCP",
  url: "https://grapheway-mcp.workers.dev",
  tagline: "Any website as a live graph — zero install.",
  summary:
    "A hosted grapheway MCP endpoint. Pass ?url=<site> to probe any public website into a live knowledge graph and use it as an MCP server. Same-origin crawl, robots.txt respected, 12-page budget, 10-minute cache. No account, no tracking.",
  capabilities: ["probe", "graph", "mcp", "markdown", "search"],
  graph: { nodes: 0, edges: 0, nodeTypes: [], edgeTypes: [] },
  endpoints: {
    manifest: "/",
    graph: "/graph/v1?url=<site>",
    mcp: "/mcp?url=<site>",
    actions: "/mcp?url=<site>",
  },
  auth: "open",
  poweredBy: { name: "grapheway", url: "https://github.com/6yte96/grapheway", install: "npx grapheway init" },
};

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "grapheway-hosted-mcp",
        version: VERSION,
        usage: "POST /mcp?url=https://docs.example.com",
        discovery: "/.well-known/agent",
        install: "npx grapheway init",
        repo: "https://github.com/6yte96/grapheway",
      });
    }

    if (url.pathname === "/.well-known/agent") {
      return json({ ...discovery, url: url.origin });
    }

    if (url.pathname === "/graph/v1") {
      const target = url.searchParams.get("url") ?? "";
      if (!isSafeUrl(target)) return json({ error: "Pass ?url=https://public-site.com" }, 400);
      const entry = await buildAgent(target);
      return json({
        version: 0,
        nodes: entry.graph.nodes.length,
        edges: entry.graph.edges.length,
        nodeTypes: [...new Set(entry.graph.nodes.map((n) => n.type))],
        edgeTypes: [...new Set(entry.graph.edges.map((e) => e.type))],
        node: `/graph/v1/node?url=${encodeURIComponent(target)}&id=<node-id>`,
        mcp: `/mcp?url=${encodeURIComponent(target)}`,
      });
    }

    if (url.pathname === "/mcp") {
      const target = url.searchParams.get("url") ?? request.headers.get("x-grapheway-url") ?? "";
      if (!target) {
        return json(
          {
            error: "Missing target URL",
            usage: "POST /mcp?url=https://docs.example.com",
            note: "The URL is the site to probe; the MCP surface is built for that site.",
          },
          400,
        );
      }
      if (!isSafeUrl(target)) return json({ error: "Only public http(s) URLs are supported" }, 400);

      const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
      if (rateLimited(ip)) return json({ error: "Rate limit exceeded — try again in a minute" }, 429);

      if (request.method === "GET") {
        return new Response("event: endpoint\ndata: " + JSON.stringify({ url: `${url.origin}/mcp?url=${encodeURIComponent(target)}` }) + "\n\n", {
          headers: { ...CORS, "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" },
        });
      }
      if (request.method !== "POST") return text("Method Not Allowed", 405);

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
      }

      try {
        const entry = await buildAgent(target);
        const response = await handleMcpMessage(body, depsFor(entry));
        if (response === null) return new Response(null, { status: 202, headers: CORS });
        return json(response, 200, {
          "mcp-session-id": crypto.randomUUID(),
          "mcp-protocol-version": "2025-03-26",
          "x-grapheway-target": target,
        });
      } catch (err) {
        return json(
          {
            jsonrpc: "2.0",
            id: (body as { id?: unknown } | null)?.id ?? null,
            error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
          },
          500,
          { "x-grapheway-target": target },
        );
      }
    }

    return json(
      {
        error: "Not found",
        routes: ["/", "/health", "/.well-known/agent", "/graph/v1?url=<site>", "/mcp?url=<site>"],
        install: "npx grapheway init",
      },
      404,
    );
  },
};
