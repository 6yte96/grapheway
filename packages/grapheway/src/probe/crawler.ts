/**
 * The crawler: walks a site's pages (BFS, same-origin, robots-lite),
 * extracts knowledge from each, and looks for an OpenAPI spec.
 */

import { extractPage, isFetchableUrl, type PageKnowledge } from "./html.ts";

export interface CrawlOptions {
  /** Max pages to fetch (default 50). */
  maxPages?: number;
  /** Max link depth from the root (default 3). */
  maxDepth?: number;
  /** Concurrent fetches (default 4). */
  concurrency?: number;
  /** Extra fetch headers (e.g. auth for private docs). */
  headers?: Record<string, string>;
  /** Set to false to ignore robots.txt. */
  respectRobots?: boolean;
  /** Abort signal. */
  signal?: AbortSignal;
}

export interface CrawlStats {
  fetched: number;
  skippedByRobots: number;
  skippedByDepth: number;
  skippedByLimit: number;
  failed: number;
}

export interface CrawlResult {
  /** Fetched pages keyed by normalized URL. */
  pages: Map<string, PageKnowledge>;
  /** OpenAPI spec if one was found (parsed object). */
  openApi?: unknown;
  /** URL the OpenAPI spec was found at. */
  openApiUrl?: string;
  stats: CrawlStats;
}

// Most common first: probing these before the crawl starts is cheap, and
// covers the vast majority of documented APIs. The rest are only tried if
// the common ones all 404, so sites without a spec don't pay for 11 probes.
const OPENAPI_PATHS_COMMON = ["/openapi.json", "/swagger.json", "/api/openapi.json"];
const OPENAPI_PATHS_EXTRA = [
  "/openapi.yaml",
  "/openapi.yml",
  "/swagger.yaml",
  "/swagger.yml",
  "/api/swagger.json",
  "/docs/openapi.json",
  "/v3/api-docs",
  "/api-docs",
];

/** Fetch one URL and remember whether it was blocked by robots. */
async function fetchWithStatus(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<{ status: number; text: string; ok: boolean }> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "grapheway-probe/0.1 (+https://github.com/6yte96/grapheway)", ...headers },
      redirect: "follow",
      signal,
    });
    return { status: res.status, text: await res.text(), ok: res.ok };
  } catch {
    return { status: 0, text: "", ok: false };
  }
}

/** Minimal robots.txt parser: the rules for `*` and `grapheway`/GPTBot. */
export function parseRobots(text: string): string[] {
  const disallowed: string[] = [];
  let currentGroup: string | null = null;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    const k = key?.trim().toLowerCase() ?? "";
    const v = value.toLowerCase();
    if (k === "user-agent") {
      currentGroup = v === "*" || v.includes("grapheway") || v.includes("gptbot") || v.includes("claudebot") ? v : null;
    } else if (k === "disallow" && currentGroup !== null && value.startsWith("/")) {
      disallowed.push(value);
    }
  }
  return disallowed;
}

/** Does this path match any robots Disallow rule (prefix match)? */
function blockedByRobots(path: string, rules: string[]): boolean {
  if (rules.length === 0) return false;
  const normalized = path.split("#")[0] ?? path;
  return rules.some((r) => normalized.startsWith(r));
}

/**
 * Crawl a site. Returns every fetched page + any discovered OpenAPI spec.
 * Pages are keyed by their normalized URL (trailing slash trimmed, hash
 * stripped) so the graph can refer to them canonically.
 */
/** Parse + verify one fetched OpenAPI candidate; returns null when not a spec. */
function tryParseSpec(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && (parsed.openapi || parsed.swagger)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function crawlSite(origin: string, options: CrawlOptions = {}): Promise<CrawlResult> {
  const maxPages = Number.isFinite(options.maxPages) ? Math.max(1, Math.floor(options.maxPages!)) : 50;
  const maxDepth = Number.isFinite(options.maxDepth) ? Math.max(1, Math.floor(options.maxDepth!)) : 3;
  const concurrency = Number.isFinite(options.concurrency) ? Math.max(1, Math.floor(options.concurrency!)) : 4;
  const { headers = {}, respectRobots = true, signal } = options;

  const root = origin.replace(/\/+$/, "");
  const base = new URL(root);

  // Robots rules (applied to all paths under the origin).
  let robotsRules: string[] = [];
  if (respectRobots) {
    const robots = await fetchWithStatus(`${root}/robots.txt`, headers, signal);
    if (robots.ok) robotsRules = parseRobots(robots.text);
  }

  // OpenAPI detection: probe the common paths first; only probe the rest if
  // none of them hit, so sites without a spec don't pay for 11 requests.
  let openApi: unknown;
  let openApiUrl: string | undefined;
  const probeBatch = async (paths: string[]): Promise<boolean> => {
    const results = await Promise.all(
      paths.map(async (p) => ({ p, res: await fetchWithStatus(`${root}${p}`, headers, signal) })),
    );
    for (const { p, res } of results) {
      if (!res.ok) continue;
      const spec = tryParseSpec(res.text);
      if (spec) {
        openApi = spec;
        openApiUrl = `${root}${p}`;
        return true;
      }
    }
    return false;
  };
  const found = await probeBatch(OPENAPI_PATHS_COMMON);
  if (!found) await probeBatch(OPENAPI_PATHS_EXTRA);

  const pages = new Map<string, PageKnowledge>();
  const stats: CrawlStats = { fetched: 0, skippedByRobots: 0, skippedByDepth: 0, skippedByLimit: 0, failed: 0 };

  const normalize = (u: URL): string => {
    u.hash = "";
    let href = u.href;
    if (u.pathname !== "/" && href.endsWith("/")) href = href.slice(0, -1);
    return href;
  };

  const queue: Array<{ url: string; depth: number }> = [{ url: root, depth: 0 }];
  const queued = new Set<string>([root]);

  // Workers pull from the queue; the crawl ends when it's empty and all
  // in-flight fetches have resolved.
  let active = 0;
  let resolveDone: (() => void) | undefined;
  let done = new Promise<void>((r) => (resolveDone = r));

  const maybeFinish = () => {
    if (queue.length === 0 && active === 0) resolveDone?.();
  };

  const worker = async () => {
    for (;;) {
      const next = queue.shift();
      if (!next) {
        maybeFinish();
        return;
      }
      const u = new URL(next.url);
      const path = u.pathname + u.search;

      if (blockedByRobots(path, robotsRules)) {
        stats.skippedByRobots++;
        continue;
      }
      if (next.depth > maxDepth) {
        stats.skippedByDepth++;
        continue;
      }
      if (pages.size >= maxPages) {
        stats.skippedByLimit++;
        continue;
      }

      active++;
      const res = await fetchWithStatus(next.url, headers, signal);
      active--;
      if (res.ok && res.status === 200) {
        const page = extractPage(res.text, u);
        pages.set(normalize(new URL(next.url)), page);
        stats.fetched++;

        // Enqueue internal links (BFS), stopping at the page budget.
        if (next.depth < maxDepth && pages.size < maxPages) {
          for (const link of page.links) {
            if (!link.internal) continue;
            const target = new URL(link.url);
            if (!isFetchableUrl(target, base.origin)) continue;
            const norm = normalize(target);
            if (queued.has(norm)) continue;
            queued.add(norm);
            queue.push({ url: norm, depth: next.depth + 1 });
          }
        }
      } else if (res.status !== 0) {
        stats.failed++;
      }
      maybeFinish();
    }
  };

  const workers = Array.from({ length: Math.max(1, concurrency) }, worker);
  await done;
  await Promise.all(workers);

  return { pages, openApi, openApiUrl, stats };
}
