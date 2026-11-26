/**
 * Helpers for making your *rendered pages* agent-friendly:
 * inject meta tags + JSON-LD into any HTML document head at request time.
 */

import { renderJsonLdHtml, renderMetaTags, type GraphewayConfig } from "../core/index.js";

/**
 * Inject GEO meta tags, Open Graph tags and Schema.org JSON-LD into an
 * HTML document's `<head>`. Returns the modified document. If the document
 * has no `<head>`, the tags are prepended.
 */
export function injectHead(html: string, config: GraphewayConfig): string {
  const tags = [renderMetaTags(config), renderJsonLdHtml(config)].join("\n");
  const headStart = html.toLowerCase().indexOf("<head");
  if (headStart >= 0) {
    const after = html[headStart + 5] ?? "";
    const isTagName = after === ">" || after === " " || after === "\t" || after === "\n" || after === "\r";
    if (isTagName) {
      const headEnd = html.indexOf(">", headStart + 5);
      if (headEnd >= 0) {
        return `${html.slice(0, headEnd + 1)}\n${tags}${html.slice(headEnd + 1)}`;
      }
    }
  }
  return `${tags}\n${html}`;
}
