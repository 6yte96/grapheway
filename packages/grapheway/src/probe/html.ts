/**
 * Knowledge extraction from raw HTML — the "get knowledge, not the tech
 * stack" principle: we read *content* (title, description, navigation,
 * headings, links) out of any page, whatever framework served it.
 *
 * Dependency-free and linear: tags come from the token based parser in
 * `@grapheway/web`, so hostile pages cannot trigger regex backtracking.
 * Good enough for docs sites (Docusaurus, GitBook, ReadTheDocs, Mintlify, …)
 * and most legacy HTML.
 */

import {
  decodeHtmlEntities,
  getHtmlAttribute,
  htmlToMarkdown as runtimeHtmlToMarkdown,
  stripHtmlBlocks,
  stripHtmlTags,
  tokenizeHtml,
  type HtmlTag,
  type HtmlToken,
} from "../web/html.js";

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

/** Text content of a tag — strips nested tags and decodes entities. */
function innerText(raw: string): string {
  return decodeHtmlEntities(stripHtmlTags(raw)).replace(/\s+/g, " ").trim();
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

/**
 * Inner text of the first element with this name, or "" when absent.
 * Nested same-name elements are balanced by depth.
 */
function firstElementText(tokens: HtmlToken[], name: string): string {
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind !== "tag" || token.tag.closing || token.tag.name !== name) continue;
    return innerText(elementInnerHtml(tokens, i, name));
  }
  return "";
}

function elementInnerHtml(tokens: HtmlToken[], start: number, name: string): string {
  const parts: string[] = [];
  let depth = 1;
  for (let i = start + 1; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind === "text") {
      parts.push(token.text);
      continue;
    }
    if (token.tag.name !== name) continue;
    if (token.tag.closing) {
      depth--;
      if (depth === 0) break;
    } else if (!token.tag.selfClosing) {
      depth++;
    }
  }
  return parts.join("");
}

/** Extract the page title: <title> first, then the first <h1>. */
export function extractTitle(html: string): string {
  const tokens = tokenizeHtml(html);
  return firstElementText(tokens, "title") || firstElementText(tokens, "h1");
}

/** Extract the meta description. */
export function extractDescription(html: string): string {
  for (const token of tokenizeHtml(html)) {
    if (token.kind !== "tag" || token.tag.closing || token.tag.name !== "meta") continue;
    const name = getHtmlAttribute(token.tag.attrs, "name");
    if (name?.toLowerCase() !== "description") continue;
    const content = getHtmlAttribute(token.tag.attrs, "content");
    if (content) return decodeHtmlEntities(content).trim();
  }
  return "";
}

const ASSET_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".css",
  ".js", ".mjs", ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".webm",
  ".mp3", ".zip", ".gz", ".pdf", ".doc", ".docx", ".xls", ".xlsx",
  ".ppt", ".pptx",
];

/** Is this URL one we should fetch (not an asset, mailto, fragment, …)? */
export function isFetchableUrl(u: URL, origin: string): boolean {
  if (u.origin !== origin) return false;
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const path = u.pathname.toLowerCase();
  if (ASSET_EXTENSIONS.some((ext) => path.endsWith(ext))) return false;
  // Skip obvious API/file paths that are not HTML.
  if (path.includes("/api/") || path.endsWith(".json") || path.endsWith(".xml") || path.endsWith(".rss")) {
    return false;
  }
  return true;
}

/** Resolve a link href, or null when it is not an http(s) URL. */
function resolveHttpUrl(href: string, base: URL): URL | null {
  if (!href || href.startsWith("#")) return null;
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.hash) url.hash = "";
  return url;
}

/** Parse every <a href> into link knowledge. */
export function extractLinks(html: string, base: URL): LinkKnowledge[] {
  const tokens = tokenizeHtml(html);
  const links: LinkKnowledge[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind !== "tag" || token.tag.closing || token.tag.name !== "a") continue;
    const href = getHtmlAttribute(token.tag.attrs, "href");
    if (!href) continue;
    const url = resolveHttpUrl(href, base);
    if (!url) continue;
    const text = innerText(elementInnerHtml(tokens, i, "a"));
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

const NAV_TAGS = new Set(["nav", "aside", "header"]);
const NAV_CONTAINER_TAGS = new Set(["ul", "div", "section"]);
const NAV_HINTS = ["nav", "menu", "sidebar", "toc", "docs"];

function isNavContainer(tag: HtmlTag): boolean {
  if (!NAV_CONTAINER_TAGS.has(tag.name)) return false;
  const cls = (getHtmlAttribute(tag.attrs, "class") ?? "").toLowerCase();
  const id = (getHtmlAttribute(tag.attrs, "id") ?? "").toLowerCase();
  const haystack = `${cls} ${id}`;
  return NAV_HINTS.some((hint) => haystack.includes(hint));
}

/** Collect anchor hrefs inside one container element. */
function collectContainerHrefs(
  tokens: HtmlToken[],
  start: number,
  name: string,
  out: Set<string>,
): void {
  let depth = 1;
  for (let i = start + 1; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind !== "tag") continue;
    if (token.tag.name === name) {
      if (token.tag.closing) {
        depth--;
        if (depth === 0) return;
      } else if (!token.tag.selfClosing) {
        depth++;
      }
    }
    if (token.tag.closing || token.tag.name !== "a") continue;
    const href = getHtmlAttribute(token.tag.attrs, "href");
    if (!href || href.startsWith("#")) continue;
    try {
      const u = new URL(href, "http://placeholder.local");
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      const pathname = u.pathname.length > 1 && u.pathname.endsWith("/")
        ? u.pathname.slice(0, -1)
        : u.pathname;
      out.add(pathname + u.search);
    } catch {
      // ignore malformed hrefs
    }
  }
}

/** Mark links that live inside navigation-ish containers. */
export function markNavLinks(html: string, links: LinkKnowledge[]): LinkKnowledge[] {
  // Collect nav link paths: inside <nav>/<aside>/<header> or containers whose
  // class/id smells like navigation (sidebar, menu, toc, docs-nav, …).
  const navPaths = new Set<string>();
  const tokens = tokenizeHtml(html);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind !== "tag" || token.tag.closing || token.tag.selfClosing) continue;
    if (!NAV_TAGS.has(token.tag.name) && !isNavContainer(token.tag)) continue;
    collectContainerHrefs(tokens, i, token.tag.name, navPaths);
  }

  const normalize = (pathname: string): string =>
    pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  return links.map((link) => {
    if (!link.internal) return link;
    try {
      const u = new URL(link.url);
      if (navPaths.has(normalize(u.pathname) + u.search)) return { ...link, inNav: true };
    } catch {
      // ignore
    }
    return link;
  });
}

/** Extract headings (h1–h3) with anchor ids, deduped within the page. */
export function extractHeadings(html: string): HeadingKnowledge[] {
  const headings: HeadingKnowledge[] = [];
  const usedIds = new Set<string>();
  const tokens = tokenizeHtml(html);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.kind !== "tag" || token.tag.closing) continue;
    const name = token.tag.name;
    if (name !== "h1" && name !== "h2" && name !== "h3") continue;
    const level = Number(name[1]) as 1 | 2 | 3;
    const text = innerText(elementInnerHtml(tokens, i, name));
    if (!text) continue;
    let id = getHtmlAttribute(token.tag.attrs, "id") ?? slugify(text);
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
  return runtimeHtmlToMarkdown(stripHtmlBlocks(html, ["nav", "footer"]));
}
