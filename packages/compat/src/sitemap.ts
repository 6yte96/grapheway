/**
 * Generate `sitemap.xml` following the sitemaps.org protocol.
 *
 * Includes the site root, every section page URL (when set), and every
 * curated item URL. External `links` (social profiles, status pages, …)
 * are excluded by design — a sitemap should list pages of this site only.
 */

import type { GraphewayConfig } from "grapheway";

/** Escape a string for safe inclusion in XML text content. */
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Resolve a possibly root-relative URL to its absolute href, or `null` for
 * cross-origin URLs (only same-origin pages belong in the sitemap).
 * Unlike `absoluteUrl` in manifest.ts, this also handles absolute URLs via
 * the URL constructor. The root form keeps its trailing slash so it dedupes
 * with `rootUrl` below.
 */
function absolute(config: GraphewayConfig, url: string): string | null {
  const u = new URL(url, config.url);
  if (u.origin !== new URL(config.url).origin) return null;
  return u.pathname === "/" ? u.href : u.href.replace(/\/+$/, "");
}

/** The site root — origin + path, with a conventional trailing slash. */
function rootUrl(config: GraphewayConfig): string {
  const u = new URL(config.url);
  return `${u.origin}${u.pathname.replace(/\/+$/, "")}/`;
}

/** Generate `/sitemap.xml` for the site described by `config`. */
export function generateSitemapXml(config: GraphewayConfig): string {
  const urls = new Set<string>([rootUrl(config)]);
  for (const section of config.sections ?? []) {
    if (section.url) {
      const loc = absolute(config, section.url);
      if (loc) urls.add(loc);
    }
    for (const item of section.items ?? []) {
      const loc = absolute(config, item.url);
      if (loc) urls.add(loc);
    }
  }
  const entries = [...urls]
    .map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`)
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${entries}\n` +
    `</urlset>\n`
  );
}
