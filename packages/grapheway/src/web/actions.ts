/**
 * Action execution engine.
 *
 * Built-in actions (`get_site_info`, `list_sections`, `get_page`,
 * `search_content`) work out of the box; apps can override any of them or
 * add their own through `createGrapheway({ actions })`.
 */

import { GRAPHEWAY_VERSION, type AgentManifest } from "../core/index.js";
import type { ActionCallContext, GraphewayOptions } from "./types.ts";

export interface ActionRunnerDeps {
  manifest: AgentManifest;
  config: import("grapheway").GraphewayConfig;
  options: GraphewayOptions;
  origin: string;
  path: string;
}

/** Best-effort HTML → Markdown, good enough for agents to read content. */
export function htmlToMarkdown(html: string): string {
  let s = html;
  // Remove comments, scripts, styles, and embedded JSON-LD.
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_m, t: string) => `# ${t.trim()}\n\n`);
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, t: string) => `## ${t.trim()}\n\n`);
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, t: string) => `### ${t.trim()}\n\n`);
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_m, t: string) => `#### ${t.trim()}\n\n`);
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, t: string) => `- ${t.trim()}\n`);
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<p[^>]*>/gi, "\n\n");
  s = s.replace(/<\/p>/gi, "\n\n");
  s = s.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, text: string) => `[${text.trim()}](${href})`);
  s = s.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_m, t: string) => `**${t.trim()}**`);
  s = s.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_m, t: string) => `_${t.trim()}_`);
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, t: string) => "`" + t.trim() + "`");
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_m, t: string) => "```\n" + t.trim() + "\n```\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim() + "\n";
}

/**
 * Create the action runner. `runAction` throws a typed error when the
 * action is unknown or its handler fails, letting the HTTP layer decide
 * how to serialize it.
 */
export function createActionRunner(deps: ActionRunnerDeps) {
  const { manifest, config, options, origin, path } = deps;

  // SSRF guard: the server will only ever fetch the site's own origin.
  const allowedOrigin = new URL(config.url).origin;

  const ctx: ActionCallContext = {
    manifest,
    config,
    path,
    origin,
    fetchPage: async (url: string) => {
      let target: URL;
      if (/^https?:\/\//.test(url)) {
        target = new URL(url);
        if (target.origin !== allowedOrigin) {
          throw new Error(
            `get_page: cannot fetch ${target.origin} — only the site's own origin (${allowedOrigin}) is allowed.`,
          );
        }
      } else {
        // Root-relative paths resolve against the configured site origin.
        target = new URL(url.startsWith("/") ? url : `/${url}`, allowedOrigin);
      }
      const res = await fetch(target.href, {
        headers: { "user-agent": `grapheway/${GRAPHEWAY_VERSION}`, ...(config.fetcher?.headers ?? {}) },
      });
      if (!res.ok) throw new Error(`Failed to fetch ${target.href}: HTTP ${res.status}`);
      const html = await res.text();
      return htmlToMarkdown(html);
    },
  };

  const builtins: Record<string, (args: Record<string, unknown>) => unknown> = {
    get_site_info: () => manifest.site,
    list_sections: () => manifest.sections,
    get_page: async (args) => {
      const url = typeof args.url === "string" ? args.url : "";
      const sectionTitle = typeof args.section === "string" ? args.section : "";
      let target = url;
      if (!target && sectionTitle) {
        // 1. Exact section title → first item of that section.
        const section = manifest.sections.find(
          (s) => s.title.toLowerCase() === sectionTitle.toLowerCase(),
        );
        target = section?.items?.[0]?.url ?? "";
        // 2. Item title anywhere in the manifest → its URL.
        if (!target) {
          const item = manifest.sections
            .flatMap((s) => s.items ?? [])
            .find((i) => i.title.toLowerCase() === sectionTitle.toLowerCase());
          target = item?.url ?? "";
        }
      }
      if (!target) {
        return {
          error: "Provide a `url` or a valid `section` title.",
          sections: manifest.sections.map((s) => s.title),
        };
      }
      // Prefer the app-provided markdown resolver.
      if (options.getPageMarkdown) {
        const md = await options.getPageMarkdown(target);
        if (md) return md;
      }
      const md = await ctx.fetchPage(target);
      return { url: target, markdown: md };
    },
    search_content: async (args) => {
      const q = String(args.q ?? "");
      if (!q) return { error: "Provide a `q` query string." };
      if (!options.search) {
        return {
          error: "This site has not enabled search_content. Use get_page or list_sections instead.",
          sections: manifest.sections.map((s) => s.title),
        };
      }
      return options.search(q, ctx);
    },
  };

  return {
    async runAction(name: string, args: Record<string, unknown>): Promise<unknown> {
      const custom = options.actions?.[name];
      if (custom) return custom(args, ctx);
      const fn = builtins[name];
      if (!fn) {
        const available = [...Object.keys(builtins), ...Object.keys(options.actions ?? {})];
        throw new Error(`Unknown action "${name}". Available: ${available.join(", ")}`);
      }
      return fn(args);
    },
    ctx,
  };
}
