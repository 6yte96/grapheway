/**
 * @grapheway/probe — convert any legacy website into an agent-native graph.
 *
 * The "for agents" half of grapheway. Point it at any URL (docs sites,
 * legacy HTML, APIs) and it extracts the site's *knowledge* — title, nav,
 * headings, links, OpenAPI endpoints — into a tagged KnowledgeGraph, with
 * zero site involvement. Serve it locally (agents point their existing
 * MCP/client tooling at localhost) or export it as JSON.
 *
 *   import { probeSite, serveProbed, exportProbed } from "@grapheway/probe";
 *
 *   const result = await probeSite("https://legacy-docs.example");
 *   console.log(result.graph.nodes.length, "nodes");
 *
 *   const server = await serveProbed("https://legacy-docs.example");
 *   // agents connect to http://localhost:4321 — discovery, /graph/v1,
 *   // /agent, MCP, SSE all serve the probed graph.
 *
 *   await exportProbed(result, { outDir: "./graph" });
 */

import { buildFromCrawl, type ProbeResult } from "./graph.ts";
import { crawlSite, type CrawlOptions } from "./crawler.ts";

export { crawlSite, parseRobots, type CrawlOptions, type CrawlResult, type CrawlStats } from "./crawler.ts";
export { buildFromCrawl, summarizeProbe, type ProbeResult, type ProbeStats } from "./graph.ts";
export {
  extractPage,
  extractTitle,
  extractDescription,
  extractHeadings,
  extractLinks,
  markNavLinks,
  htmlToMarkdown,
  slugify,
  type HeadingKnowledge,
  type LinkKnowledge,
  type PageKnowledge,
} from "./html.ts";
export { serveProbed, type ProbeServeOptions, type ProbeServer } from "./serve.ts";
export { exportProbed, type ExportOptions } from "./export.ts";

/**
 * One-shot: crawl a URL and build its graph + config.
 * Returns everything `serveProbed`/`exportProbed` need.
 */
export async function probeSite(url: string, options: CrawlOptions = {}): Promise<ProbeResult> {
  const origin = url.replace(/\/+$/, "");
  const crawl = await crawlSite(origin, options);
  return buildFromCrawl(origin, [...crawl.pages.values()], crawl.openApi, crawl.openApiUrl);
}
