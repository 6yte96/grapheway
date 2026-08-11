import { MANIFEST_VERSION, type AgentManifest, type GraphewayConfig } from "./types.ts";

/** Build the absolute URL for a root-relative path. */
export function absoluteUrl(config: GraphewayConfig, path: string): string {
  const base = config.url.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

const DEFAULT_ACTIONS: AgentManifest["actions"] = [
  {
    name: "get_site_info",
    description:
      "Returns the site's name, tagline, summary, contact info and the sections available to agents. Call this first.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_sections",
    description:
      "Lists every curated content section the site publishes for agents, with their titles, URLs and notes.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_page",
    description:
      "Fetches a page of the site as clean markdown. Pass the page URL or a section title.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Absolute or root-relative URL of the page." },
        section: { type: "string", description: "A section title to fetch the first item of." },
      },
    },
  },
  {
    name: "search_content",
    description:
      "Searches the site's content. Returns matching pages with titles, URLs and snippets. Only available if the site configured a search function.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string", description: "The search query." } },
      required: ["q"],
    },
  },
];

/**
 * Build the machine-readable agent manifest served at `/agent`
 * (also published as `agents.json`).
 */
export function buildManifest(config: GraphewayConfig): AgentManifest {
  const url = absoluteUrl(config, "/agent");
  const sections = config.sections ?? [];
  const declared = config.actions ?? [];
  // Built-in actions first; app-declared actions override same-name built-ins.
  const actions = [...DEFAULT_ACTIONS];
  for (const declaredAction of declared) {
    const idx = actions.findIndex((a) => a.name === declaredAction.name);
    if (idx >= 0) actions[idx] = declaredAction;
    else actions.push(declaredAction);
  }

  return {
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    site: {
      name: config.name,
      url: config.url,
      tagline: config.tagline,
      summary: config.summary,
      contact: config.contact,
    },
    endpoints: {
      manifest: url,
      info: absoluteUrl(config, "/agent/info"),
      sections: absoluteUrl(config, "/agent/sections"),
      actions: absoluteUrl(config, "/agent/actions"),
      action: absoluteUrl(config, "/agent/action"),
      llmsTxt: absoluteUrl(config, "/llms.txt"),
      llmsFullTxt: absoluteUrl(config, "/llms-full.txt"),
      mcp: absoluteUrl(config, "/mcp"),
      robotsTxt: absoluteUrl(config, "/robots.txt"),
      sitemap: absoluteUrl(config, "/sitemap.xml"),
    },
    sections,
    actions,
    capabilities: config.capabilities ?? [],
    geo: {
      llmsTxt: true,
      llmsFullTxt: true,
      agentsTxt: true,
      agentsJson: true,
      robotsAiPolicy: true,
      jsonLd: true,
      semanticHtml: true,
    },
    links: config.links ?? [],
  };
}

