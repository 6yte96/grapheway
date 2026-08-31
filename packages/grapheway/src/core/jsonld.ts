import type { GraphewayConfig } from "./types.ts";

/**
 * Generate Schema.org JSON-LD objects describing the site.
 * This is the structured-data backbone of GEO: LLMs and AI answer engines
 * (Google AI Overviews, Perplexity, Copilot) parse this without running JS.
 */
export function generateJsonLd(config: GraphewayConfig): Record<string, unknown>[] {
  const graph: Record<string, unknown>[] = [];

  // The Organization.
  const org: Record<string, unknown> = {
    "@type": "Organization",
    "@id": `${config.url}/#organization`,
    name: config.name,
    url: config.url,
  };
  if (config.tagline) org["slogan"] = config.tagline;
  if (config.summary) org["description"] = config.summary;
  if (config.contact?.email) org["email"] = config.contact.email;
  graph.push(org);

  // The WebSite with a SearchAction, if a search handler is declared.
  const searchAction = config.actions?.find((a) => a.name === "search_content");
  const website: Record<string, unknown> = {
    "@type": "WebSite",
    "@id": `${config.url}/#website`,
    url: config.url,
    name: config.name,
    publisher: { "@id": `${config.url}/#organization` },
  };
  if (searchAction) {
    website["potentialAction"] = {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${config.url}/agent/action?action=search_content&q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    };
  }
  graph.push(website);

  // One WebPage per curated section, so agents can find content fast.
  for (const section of config.sections ?? []) {
    if (!section.url) continue;
    graph.push({
      "@type": "WebPage",
      "@id": `${config.url}${section.url}#webpage`,
      url: `${config.url}${section.url}`,
      name: section.title,
      description: section.description,
      isPartOf: { "@id": `${config.url}/#website` },
    });
  }

  return graph;
}

/** Render JSON-LD objects as `<script type="application/ld+json">` tags. */
export function renderJsonLdHtml(config: GraphewayConfig): string {
  return generateJsonLd(config)
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join("\n");
}

/**
 * Render standard meta + Open Graph + Twitter tags.
 * Includes the llms.txt "documentation" meta that some crawlers look for.
 */
export function renderMetaTags(config: GraphewayConfig): string {
  const desc = config.summary?.replace(/[#>*_`\[\]]/g, "").slice(0, 160) ?? config.tagline ?? "";
  const tags: string[] = [];
  tags.push(`<meta name="description" content="${escapeHtml(desc)}">`);
  tags.push(`<meta name="generator" content="grapheway">`);
  tags.push(`<meta name="robots" content="index, follow, max-image-preview:large">`);
  tags.push(`<meta property="og:title" content="${escapeHtml(config.name)}">`);
  tags.push(`<meta property="og:type" content="website">`);
  tags.push(`<meta property="og:url" content="${config.url}">`);
  if (desc) tags.push(`<meta property="og:description" content="${escapeHtml(desc)}">`);
  tags.push(`<meta name="twitter:card" content="summary">`);
  tags.push(`<meta name="twitter:title" content="${escapeHtml(config.name)}">`);
  if (desc) tags.push(`<meta name="twitter:description" content="${escapeHtml(desc)}">`);
  return tags.join("\n");
}

/** A tiny HTML escape helper (kept dependency-free and XSS-safe). */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
