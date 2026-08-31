/**
 * Knowledge extraction from raw HTML — the "get knowledge, not the tech
 * stack" principle: we read *content* (title, description, navigation,
 * headings, links) out of any page, whatever framework served it.
 *
 * Regex-based and dependency-free, matching the style of `htmlToMarkdown`
 * in @grapheway/web. Good enough for docs sites (Docusaurus, GitBook,
 * ReadTheDocs, Mintlify, …) and most legacy HTML.
 */

import { htmlToMarkdown as webHtmlToMarkdown } from "../web/index.js";

export interface HeadingKnowledge {
  level: 1 | 2 | 3;
  text: string;
  /** Anchor id if present (e.g. `#installation`), else slugified. */
  id: string;
}

export interface LinkKnowledge {
  /** Absolute URL. */
  url: string;
  text: string;
  /** True when the link lives inside a navigation-ish container. */
  inNav: boolean;
  /** True when the link points at the same origin. */
  internal: boolean;
}

export interface PageKnowledge {
  url: string;
  title: string;
  description?: string;
  headings: HeadingKnowledge[];
  links: LinkKnowledge[];
  html: string;
}

/** Lowercase text content of a tag — strips nested tags. */
function innerText(tag: string): string {
  return tag
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Slugify heading text into a stable anchor id. */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "section"
  );
}

/** Extract the page title: <title> first, then the first <h1>. */
export function extractTitle(html: string): string {
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (t?.[1]?.trim()) return innerText(t[1]);
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (h1?.[1]?.trim()) return innerText(h1[1]);
  return "";
}

/** Extract the meta description. */
export function extractDescription(html: string): string {
  const re =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i;
  const re2 =
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i;
  const m = re.exec(html) ?? re2.exec(html);
  return m?.[1]?.trim() ?? "";
}

/** Is this URL one we should fetch (not an asset, mailto, fragment, …)? */
export function isFetchableUrl(u: URL, origin: string): boolean {
  if (u.origin !== origin) return false;
  if (!/^https?:$/.test(u.protocol)) return false;
  const path = u.pathname.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|svg|ico|css|js|mjs|woff2?|ttf|eot|mp4|webm|mp3|zip|gz|pdf|docx?|xlsx?|pptx?)$/.test(path)) {
    return false;
  }
  // Skip obvious API/file paths that are not HTML.
  if (/\/(api\/|\.json$|\.xml$|\.rss$)/.test(path)) return false;
  return true;
}

/** Parse every <a href> into link knowledge. */
export function extractLinks(html: string, base: URL): LinkKnowledge[] {
  const links: LinkKnowledge[] = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1]!.trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (url.hash) url.hash = "";
    const text = innerText(m[2] ?? "");
    if (!text) continue;
    links.push({
      url: url.href,
      text,
      inNav: false,
      internal: url.origin === base.origin,
    });
  }
  return links;
}

/** Mark links that live inside navigation-ish containers. */
export function markNavLinks(html: string, links: LinkKnowledge[]): LinkKnowledge[] {
  // Collect nav link hrefs: inside <nav>/<aside>/<header> or containers whose
  // class/id smells like navigation (sidebar, menu, toc, docs-nav, …).
  const navHrefs = new Set<string>();
  const containers = [
    ...(html.match(/<nav[\s\S]*?<\/nav>/gi) ?? []),
    ...(html.match(/<aside[\s\S]*?<\/aside>/gi) ?? []),
    ...(html.match(/<header[\s\S]*?<\/header>/gi) ?? []),
    ...(html.match(/<(?:ul|div|section)[^>]+(?:class|id)=["'][^"']*(?:nav|menu|sidebar|toc|docs)[^"']*["'][^>]*>[\s\S]*?<\/(?:ul|div|section)>/gi) ?? []),
  ];
  const normalize = (pathname: string): string => {
    // The crawler normalizes URLs (trailing slash trimmed), so compare nav
    // hrefs the same way or "/docs/" vs "/docs" would misclassify.
    return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  };
  for (const container of containers) {
    const re = /href=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(container)) !== null) {
      const href = m[1]!;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;
      try {
        const u = new URL(href, "http://placeholder.local");
        navHrefs.add(normalize(u.pathname) + u.search);
      } catch {
        // ignore
      }
    }
  }
  return links.map((l) => {
    if (!l.internal) return l;
    try {
      const u = new URL(l.url);
      if (navHrefs.has(normalize(u.pathname) + u.search)) return { ...l, inNav: true };
    } catch {
      // ignore
    }
    return l;
  });
}

/** Extract headings (h1–h3) with anchor ids, deduped within the page. */
export function extractHeadings(html: string): HeadingKnowledge[] {
  const headings: HeadingKnowledge[] = [];
  const usedIds = new Set<string>();
  const re = /<h([123])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const level = Number(m[1]) as 1 | 2 | 3;
    const raw = m[2] ?? "";
    const text = innerText(raw);
    if (!text) continue;
    const idMatch = /<h[123]\b[^>]*id=["']([^"']+)["']/i.exec(m[0]);
    let id = idMatch?.[1] ?? slugify(text);
    // Two headings with the same text (or same explicit id) would collide
    // on the same node id — disambiguate with a counter.
    if (usedIds.has(id)) {
      let n = 2;
      while (usedIds.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    usedIds.add(id);
    headings.push({ level, text, id });
  }
  return headings;
}

/** Point-in-time snapshot of one fetched page. */
export function extractPage(html: string, url: URL): PageKnowledge {
  return {
    url: url.href,
    title: extractTitle(html),
    description: extractDescription(html),
    headings: extractHeadings(html),
    links: markNavLinks(html, extractLinks(html, url)),
    html,
  };
}

/**
 * Cheap text → markdown for probed pages: strips navigation/footer chrome
 * first (agents read content, not menus), then delegates to the shared
 * converter in @grapheway/web so the two never drift.
 */
export function htmlToMarkdown(html: string): string {
  const stripped = html
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");
  return webHtmlToMarkdown(stripped);
}
