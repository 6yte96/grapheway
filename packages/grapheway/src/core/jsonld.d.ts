import type { GraphewayConfig } from "./types.ts";
/**
 * Generate Schema.org JSON-LD objects describing the site.
 * This is the structured-data backbone of GEO: LLMs and AI answer engines
 * (Google AI Overviews, Perplexity, Copilot) parse this without running JS.
 */
export declare function generateJsonLd(config: GraphewayConfig): Record<string, unknown>[];
/** Render JSON-LD objects as `<script type="application/ld+json">` tags. */
export declare function renderJsonLdHtml(config: GraphewayConfig): string;
/**
 * Render standard meta + Open Graph + Twitter tags.
 * Includes the llms.txt "documentation" meta that some crawlers look for.
 */
export declare function renderMetaTags(config: GraphewayConfig): string;
/** A tiny HTML escape helper (kept dependency-free and XSS-safe). */
export declare function escapeHtml(input: string): string;
//# sourceMappingURL=jsonld.d.ts.map