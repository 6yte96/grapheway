/**
 * Turn crawl results into a tagged KnowledgeGraph + a GraphewayConfig —
 * the "convert legacy web into graphs" step.
 *
 * Provenance/confidence follow the auditable-edge model:
 *   - nav links   → provenance `link`,  confidence `extracted` (the site
 *                   declares its own structure)
 *   - content links → provenance `link`, confidence `inferred` (best-effort
 *                   relevance, weaker than navigation)
 *   - headings    → provenance `derived`, confidence `inferred`
 *   - OpenAPI endpoints → provenance `derived`, confidence `extracted`
 *                   (read directly from the spec)
 */

import { trimTrailingSlashes, type GraphewayConfig, type GraphEdge, type GraphNode, type KnowledgeGraph } from "../core/index.js";
import type { PageKnowledge } from "./html.ts";

export interface ProbeStats {
  pages: number;
  headings: number;
  edges: number;
  endpoints?: number;
  skippedByRobots: number;
  failed: number;
}

export interface ProbeResult {
  config: GraphewayConfig;
  graph: KnowledgeGraph;
  pages: PageKnowledge[];
  openApiUrl?: string;
  stats: ProbeStats;
}

/** URL of a heading's node: page URL + anchor. */
function headingId(pageUrl: string, heading: { id: string }): string {
  return `${pageUrl}#${heading.id}`;
}

const TITLE_SEPARATORS = new Set(["|", "-", "\u2013", "\u2014", ":", "\u00b7", "\u2022"]);

/** Strip a trailing separator plus a common site-name suffix ("Install | Acme Docs"). */
function cleanTitle(title: string, siteName: string): string {
  const trimmed = title.trim();
  const name = siteName.trim();
  if (name && trimmed.toLowerCase().endsWith(name.toLowerCase())) {
    const prefix = trimmed.slice(0, trimmed.length - name.length).trimEnd();
    if (prefix && TITLE_SEPARATORS.has(prefix.slice(-1))) {
      const cut = prefix.slice(0, -1).trimEnd();
      if (cut) return cut;
    }
  }
  let end = trimmed.length;
  while (end > 0 && TITLE_SEPARATORS.has(trimmed[end - 1]!)) end--;
  const stripped = trimmed.slice(0, end).trimEnd();
  return stripped || title;
}

/** First title segment, for deriving a site name from "Install | Acme Docs". */
function firstTitleSegment(title: string): string {
  for (let i = 0; i < title.length; i++) {
    if (TITLE_SEPARATORS.has(title[i]!)) return title.slice(0, i).trim();
  }
  return title.trim();
}

/** Describe an OpenAPI operation in one line. */
function describeEndpoint(path: string, method: string, op: Record<string, any>): string {
  const summary = op.summary ?? op.description ?? "";
  const tag = Array.isArray(op.tags) && op.tags.length > 0 ? ` [${op.tags.join(", ")}]` : "";
  return `${method.toUpperCase()} ${path}${summary ? ` — ${String(summary).split("\n")[0]}` : ""}${tag}`;
}

/**
 * Build the knowledge graph + generated config from crawled pages.
 * A custom `builder`-style projection: pages → nodes, links/headings/API →
 * edges, all tagged. `config` is derived from the site's own content, so
 * the whole runtime surface (discovery, /agent, compat files, MCP) works
 * against it with no site involvement.
 */
export function buildFromCrawl(
  origin: string,
  pages: PageKnowledge[],
  openApi?: unknown,
  openApiUrl?: string,
  crawlStats?: { skippedByRobots?: number; failed?: number },
): ProbeResult {
  const root = trimTrailingSlashes(origin);
  const siteName = pages[0]?.title
    ? firstTitleSegment(pages[0].title)
    : new URL(root).hostname;
  const rootPage = pages.find((p) => new URL(p.url).pathname === "/") ?? pages[0];

  // ---- Config (derived from the site's own knowledge) ----
  const config: GraphewayConfig = {
    name: siteName,
    url: root,
    tagline: rootPage?.title && rootPage.title !== siteName ? cleanTitle(rootPage.title, siteName) : undefined,
    summary:
      rootPage?.description ||
      (rootPage ? `A knowledge graph of ${siteName}, probed from ${root}. ${pages.length} pages discovered.` : undefined),
    capabilities: ["graph", "search"],
  };

  // Sections from URL structure: group internal pages by first path segment
  // (docs, guides, reference, …) — content organization, not tech stack.
  const groups = new Map<string, PageKnowledge[]>();
  for (const p of pages) {
    const path = new URL(p.url).pathname;
    if (path === "/") continue;
    const group = path.split("/").filter(Boolean)[0]?.toLowerCase();
    if (!group) continue;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(p);
  }
  if (groups.size > 0) {
    config.sections = [...groups.entries()].map(([group, items]) => ({
      title: group.charAt(0).toUpperCase() + group.slice(1),
      description: `Pages under /${group}`,
      items: items.slice(0, 50).map((p) => {
        const path = new URL(p.url).pathname;
        return {
          title: cleanTitle(p.title, siteName) || path,
          url: path === "/" ? "/" : path,
          notes: p.description ? p.description.slice(0, 120) : undefined,
        };
      }),
    }));
  }

  // ---- Graph ----
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const fetchedPageUrls = new Set(pages.map((p) => p.url));

  const addNode = (node: GraphNode) => {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  };
  const addEdge = (edge: GraphEdge) => {
    if (edgeIds.has(edge.id)) return;
    edgeIds.add(edge.id);
    edges.push(edge);
  };

  // Root + pages.
  addNode({ id: root, type: "page", label: siteName, props: { url: root } });
  for (const p of pages) {
    addNode({
      id: p.url,
      type: "page",
      label: cleanTitle(p.title, siteName) || new URL(p.url).pathname,
      props: { url: p.url, description: p.description },
    });
  }

  // Links: navigation = extracted, content = inferred.
  for (const p of pages) {
    const from = p.url;
    for (const link of p.links) {
      if (!link.internal) continue;
      if (!fetchedPageUrls.has(link.url)) {
        // Link to a page we didn't fetch: still worth recording as a node
        // so agents know it exists (marked ambiguous — it may not be
        // reachable, and its title is only the link text).
        addNode({
          id: link.url,
          type: "page",
          label: link.text || new URL(link.url).pathname,
          props: { url: link.url, unvisited: true },
        });
      }
      addEdge({
        id: `edge:${from}->${link.url}`,
        source: from,
        target: link.url,
        type: "links_to",
        label: link.text,
        provenance: "link",
        confidence: link.inNav ? "extracted" : "inferred",
        note: link.inNav ? `Navigation link on ${new URL(from).pathname}` : `Content link on ${new URL(from).pathname}`,
      });
    }
  }

  // Headings → section nodes (is_part_of).
  for (const p of pages) {
    for (const h of p.headings) {
      const id = headingId(p.url, h);
      addNode({
        id,
        type: "section",
        label: h.text,
        props: { level: h.level, page: p.url },
      });
      addEdge({
        id: `edge:${p.url}#h->${id}`,
        source: p.url,
        target: id,
        type: "is_part_of",
        label: h.text,
        provenance: "derived",
        confidence: "inferred",
        note: `Heading "${h.text}" on ${new URL(p.url).pathname}`,
      });
    }
  }

  // OpenAPI endpoints → api nodes (extracted from the spec).
  let endpoints = 0;
  if (openApi && typeof openApi === "object") {
    const spec = openApi as Record<string, any>;
    const paths = (spec.paths ?? {}) as Record<string, any>;
    for (const [path, methods] of Object.entries(paths)) {
      if (!methods || typeof methods !== "object") continue;
      const methodMap = methods as Record<string, any>;
      for (const [method, rawOp] of Object.entries(methodMap)) {
        if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
        if (!rawOp || typeof rawOp !== "object") continue;
        const op = rawOp as Record<string, any>;
        const id = `${root}#api:${method}:${path}`;
        addNode({
          id,
          type: "api",
          label: describeEndpoint(path, method, op),
          props: {
            method,
            path,
            summary: op.summary,
            description: op.description,
            tags: op.tags,
            operationId: op.operationId,
            openApi: openApiUrl,
          },
        });
        addEdge({
          id: `edge:${root}->${id}`,
          source: root,
          target: id,
          type: "exposes",
          label: `${method.toUpperCase()} ${path}`,
          provenance: "derived",
          confidence: "extracted",
          note: `Endpoint declared in OpenAPI spec${openApiUrl ? ` at ${openApiUrl}` : ""}`,
        });
        endpoints++;
      }
    }
  }

  return {
    config,
    graph: {
      nodes,
      edges,
      meta: {
        sourceUrl: root,
        capturedAt: new Date().toISOString(),
        snapshot: true,
      },
    },
    pages,
    openApiUrl,
    stats: {
      pages: pages.length,
      headings: pages.reduce((s, p) => s + p.headings.length, 0),
      edges: edges.length,
      endpoints: endpoints > 0 ? endpoints : undefined,
      skippedByRobots: crawlStats?.skippedByRobots ?? 0,
      failed: crawlStats?.failed ?? 0,
    },
  };
}

/** The graph summary used by the probe report. */
export function summarizeProbe(result: ProbeResult): string {
  const { config, graph, stats, openApiUrl } = result;
  const lines = [
    `Probed ${config.name} (${config.url})`,
    `  pages:    ${stats.pages}`,
    `  headings: ${stats.headings}`,
    `  edges:    ${stats.edges}  (${graph.edges.filter((e) => e.confidence === "extracted").length} extracted, ${graph.edges.filter((e) => e.confidence === "inferred").length} inferred)`,
  ];
  if (stats.endpoints) lines.push(`  api:      ${stats.endpoints} endpoints${openApiUrl ? ` (${openApiUrl})` : ""}`);
  if (stats.skippedByRobots) lines.push(`  robots:   skipped ${stats.skippedByRobots} urls`);
  if (stats.failed) lines.push(`  failed:   ${stats.failed} urls`);
  return lines.join("\n");
}
