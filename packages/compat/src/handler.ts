/**
 * `compatHandler` — serve the legacy agent-discovery files at runtime.
 *
 * This is the optional compat surface. The runtime core (`@grapheway/web`)
 * never imports this package: mount it alongside your agent handler only if
 * you want `llms.txt` / `agents.txt` / `robots.txt` / `sitemap.xml` served.
 *
 *   import { compatHandler } from "@grapheway/compat";
 *   const compat = compatHandler(config);
 *   // for each request: const res = await compat({ path }); if (res) respond(res)
 */

import type { GraphewayConfig } from "grapheway";
import { generateLlmsFullTxt, generateLlmsTxt } from "./llms-txt.ts";
import { buildAgentsJson, buildAgentsTxt } from "./agents-txt.ts";
import { buildRobotsTxt } from "./robots.ts";
import { generateSitemapXml } from "./sitemap.ts";

export interface CompatRequest {
  /** Root-relative request path, e.g. `/llms.txt`. */
  path: string;
  /** HTTP method (default GET). */
  method?: string;
}

export interface CompatResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  contentType: string;
}

export interface CompatOptions {
  /** Resolves a page's markdown for `llms-full.txt`. Optional. */
  getPageMarkdown?: (path: string) => string | null | Promise<string | null>;
}

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
};

/**
 * Create a handler that serves the compat files, or `null` for any
 * path it doesn't own (so callers can fall through to the runtime handler).
 */
export function compatHandler(config: GraphewayConfig, options: CompatOptions = {}) {
  const getMarkdown = async (path: string): Promise<string | null> =>
    options.getPageMarkdown ? await options.getPageMarkdown(path) : null;

  return async function handle(req: CompatRequest): Promise<CompatResponse | null> {
    const respond = (status: number, body: string, contentType: string): CompatResponse => ({
      status,
      headers: CORS_HEADERS,
      body,
      contentType,
    });

    const method = (req.method ?? "GET").toUpperCase();
    if (method === "OPTIONS") {
      return { status: 204, headers: { ...CORS_HEADERS, "access-control-allow-methods": "GET, OPTIONS" }, body: "", contentType: "text/plain" };
    }
    if (method !== "GET") return null;

    switch (req.path) {
      case "/llms.txt":
        return respond(200, generateLlmsTxt(config), "text/plain; charset=utf-8");

      case "/llms-full.txt": {
        const pageMarkdown: Record<string, string> = {};
        for (const section of config.sections ?? []) {
          for (const item of section.items ?? []) {
            const path = item.url.startsWith("/")
              ? item.url
              : new URL(item.url, config.url).pathname;
            if (pageMarkdown[path]) continue;
            const md = await getMarkdown(path);
            if (md) pageMarkdown[path] = md;
          }
        }
        return respond(200, generateLlmsFullTxt(config, pageMarkdown), "text/plain; charset=utf-8");
      }

      case "/agents.txt":
        return respond(200, buildAgentsTxt(config), "text/plain; charset=utf-8");

      case "/agents.json":
        return respond(200, buildAgentsJson(config), "application/json");

      case "/robots.txt":
        return respond(200, buildRobotsTxt(config), "text/plain; charset=utf-8");

      case "/sitemap.xml":
        return respond(200, generateSitemapXml(config), "application/xml");

      default:
        return null;
    }
  };
}
