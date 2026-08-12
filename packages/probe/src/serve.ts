/**
 * Serve a probed site's graph as a local agent surface.
 *
 * The trick that makes this work with zero changes to the runtime: the
 * probed graph is injected through `createGrapheway(config, { graph:
 * { builder } })`, so every existing endpoint — discovery, /graph/v1,
 * /agent, MCP, SSE — serves *this* graph. Pages are converted to markdown
 * on demand. Agents point at http://localhost:PORT and everything they
 * already know how to use just works.
 *
 * `createProbeAgent` is the graph-holding half: the agent runtime plus a
 * `refresh()` hook that re-crawls and pushes the structural diff through
 * `patchGraph` — so subscribers (SSE, MCP clients) see the site go live
 * without re-probing. `serveProbed` is `createProbeAgent` + an HTTP server;
 * the gateway CLI builds its own server on top of the same agent.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createGrapheway, htmlToMarkdown, toNodeHandler } from "@grapheway/web";
import { diffGraphs, type KnowledgeGraph } from "grapheway";
import { crawlSite, type CrawlOptions } from "./crawler.ts";
import { buildFromCrawl, type ProbeResult } from "./graph.ts";
import type { PageKnowledge } from "./html.ts";

export interface ProbeServeOptions extends CrawlOptions {
  /** Port to listen on (default 4321). */
  port?: number;
  /** Pre-crawled result — skips crawling when provided. */
  result?: ProbeResult;
}

export interface ProbeServer {
  origin: string;
  /** The port the local agent surface is listening on. */
  port: number;
  result: ProbeResult;
  close: () => Promise<void>;
}

/**
 * A graph-holding agent for one probed site. `agent` serves the full
 * runtime surface (discovery, /graph/v1, /agent, MCP, SSE); `refresh`
 * re-crawls and applies the structural diff to the live graph.
 */
export interface ProbeAgent {
  origin: string;
  agent: ReturnType<typeof createGrapheway>;
  result: ProbeResult;
  /**
   * Swap the live graph to a fresh crawl. Applies `diffGraphs` via
   * `patchGraph`, so SSE/MCP subscribers receive the changes as patches.
   * Returns the new graph version.
   */
  refresh: (next: ProbeResult) => number;
}

/** Best-effort page search over the probed graph (title/description). */
function makeSearch(pages: () => PageKnowledge[]) {
  return (q: string) => {
    const query = q.toLowerCase();
    const hits: Array<{ title: string; url: string; snippet: string }> = [];
    for (const p of pages()) {
      const hay = `${p.title} ${p.description ?? ""} ${p.headings.map((h) => h.text).join(" ")}`.toLowerCase();
      if (hay.includes(query)) {
        hits.push({
          title: p.title || new URL(p.url).pathname,
          url: p.url,
          snippet: (p.description ?? p.headings.map((h) => h.text).join(" · ")).slice(0, 140),
        });
      }
    }
    return hits.slice(0, 10);
  };
}

/**
 * Build the graph-holding agent for a probed site — no HTTP server.
 * Pages are converted to markdown live (cached crawl first, fetch fallback).
 */
export function createProbeAgent(origin: string, result: ProbeResult): ProbeAgent {
  const root = origin.replace(/\/+$/, "");
  // Mutable crawl state: refreshed in place so getPageMarkdown/search see
  // the newest crawl without rebuilding the agent.
  let current = result;
  const byPath = new Map(current.pages.map((p) => [new URL(p.url).pathname, p]));

  // Live page → markdown, using the cached crawl when we have it. `path` may
  // be absolute (agents often pass search-result URLs back to get_page), so
  // normalize it to a root-relative path first.
  const toPath = (path: string): string => {
    try {
      return new URL(path, root).pathname;
    } catch {
      return path.startsWith("/") ? path : `/${path}`;
    }
  };

  const agent = createGrapheway(current.config, {
    graph: { builder: () => current.graph },
    getPageMarkdown: async (path: string) => {
      const normalized = toPath(path);
      const cached = byPath.get(normalized);
      if (cached) return htmlToMarkdown(cached.html);
      // Live fetch for pages the probe didn't reach.
      const res = await fetch(`${root}${normalized}`, {
        headers: { "user-agent": "grapheway-probe/0.1" },
      });
      if (!res.ok) return null;
      return htmlToMarkdown(await res.text());
    },
    search: makeSearch(() => current.pages),
  });

  return {
    origin: root,
    agent,
    get result() {
      return current;
    },
    refresh(next: ProbeResult) {
      const patches = diffGraphs(agent.graph, next.graph);
      const version = agent.patchGraph(patches);
      current = next;
      byPath.clear();
      for (const p of next.pages) byPath.set(new URL(p.url).pathname, p);
      return version;
    },
  };
}

/**
 * Crawl (or reuse) a site, then serve its graph locally as a full agent
 * surface. Resolves once the server is listening.
 */
export async function serveProbed(
  url: string,
  options: ProbeServeOptions = {},
): Promise<ProbeServer> {
  const origin = url.replace(/\/+$/, "");
  const result =
    options.result ??
    (async () => {
      const crawl = await crawlSite(origin, options);
      return buildFromCrawl(origin, [...crawl.pages.values()], crawl.openApi, crawl.openApiUrl, crawl.stats);
    })();

  const probe = await result;
  const holder = createProbeAgent(origin, probe);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    await toNodeHandler(holder.agent.handler)(req, res);
  });

  const port = options.port ?? 4321;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolve());
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;

  return {
    origin,
    port: actualPort,
    result: holder.result,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
