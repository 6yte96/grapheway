/**
 * Serve a probed site's graph as a local agent surface.
 *
 * The trick that makes this work with zero changes to the runtime: the
 * probed graph is injected through `createGrapheway(config, { graph:
 * { builder } })`, so every existing endpoint — discovery, /graph/v1,
 * /agent, MCP, SSE — serves *this* graph. Pages are converted to markdown
 * on demand. Agents point at http://localhost:PORT and everything they
 * already know how to use just works.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createGrapheway, htmlToMarkdown, toNodeHandler } from "@grapheway/web";
import type { KnowledgeGraph } from "grapheway";
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

/** Best-effort page search over the probed graph (title/description). */
function makeSearch(graph: KnowledgeGraph, pages: PageKnowledge[]) {
  return (q: string) => {
    const query = q.toLowerCase();
    const hits: Array<{ title: string; url: string; snippet: string }> = [];
    for (const p of pages) {
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
      return buildFromCrawl(origin, [...crawl.pages.values()], crawl.openApi, crawl.openApiUrl);
    })();

  const probe = await result;

  // Live page → markdown, using the cached crawl when we have it.
  const byPath = new Map(
    probe.pages.map((p) => [new URL(p.url).pathname, p]),
  );

  const agent = createGrapheway(probe.config, {
    graph: { builder: () => probe.graph },
    getPageMarkdown: async (path: string) => {
      const cached = byPath.get(path.startsWith("/") ? path : `/${path}`);
      if (cached) return htmlToMarkdown(cached.html);
      // Live fetch for pages the probe didn't reach.
      const res = await fetch(`${origin}${path.startsWith("/") ? path : `/${path}`}`, {
        headers: { "user-agent": "grapheway-probe/0.1" },
      });
      if (!res.ok) return null;
      return htmlToMarkdown(await res.text());
    },
    search: makeSearch(probe.graph, probe.pages),
  });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    await toNodeHandler(agent.handler)(req, res);
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
    result: probe,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}
