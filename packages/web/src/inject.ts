/**
 * Helpers for making your *rendered pages* agent-friendly:
 * inject meta tags + JSON-LD into any HTML document head at request time.
 */

import { renderJsonLdHtml, renderMetaTags, type GraphewayConfig } from "grapheway";

/**
 * Inject GEO meta tags, Open Graph tags and Schema.org JSON-LD into an
 * HTML document's `<head>`. Returns the modified document. If the document
 * has no `<head>`, the tags are prepended.
 */
export function injectHead(html: string, config: GraphewayConfig): string {
  const tags = [renderMetaTags(config), renderJsonLdHtml(config)].join("\n");
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (m) => `${m}\n${tags}`);
  }
  return `${tags}\n${html}`;
}
