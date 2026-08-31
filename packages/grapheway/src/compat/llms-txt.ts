import { absoluteUrl, type GraphewayConfig, type LlmsTxtItem, type Section } from "../core/index.js";

/**
 * Generate `/llms.txt` following the llmstxt.org convention:
 *
 *   # Title
 *   > optional blockquote summary
 *   descriptive paragraphs
 *   ## Section heading
 *   - [Title](url): notes
 *   ## Optional
 *   - [Title](url): notes
 *
 * This file is the fastest way for an agent to understand your site.
 */
export function generateLlmsTxt(config: GraphewayConfig): string {
  const lines: string[] = [];
  lines.push(`# ${config.name}`);
  if (config.tagline) lines.push("");
  if (config.tagline) lines.push(`> ${config.tagline}`);
  if (config.summary) lines.push("");
  if (config.summary) lines.push(config.summary.trim());
  lines.push("");

  for (const section of config.sections ?? []) {
    const heading = section.optional ? "Optional" : section.title;
    lines.push(`## ${heading}`);
    if (section.description) {
      lines.push("");
      lines.push(section.description.trim());
      lines.push("");
    }
    lines.push("");
    for (const item of section.items ?? []) {
      lines.push(`- [${item.title}](${absoluteUrl(config, item.url)}): ${item.notes ?? ""}`);
    }
    lines.push("");
  }

  if (config.links && config.links.length > 0) {
    lines.push("## Links");
    lines.push("");
    for (const link of config.links) {
      lines.push(`- [${link.title}](${absoluteUrl(config, link.url)}): ${link.description ?? ""}`);
    }
    lines.push("");
  }

  // Trim trailing blank lines.
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n") + "\n";
}

/**
 * Generate `/llms-full.txt` — the llms.txt document with every listed
 * page's markdown appended inline, so agents get full context in one fetch.
 *
 * @param pageMarkdown map of page URL (root-relative, e.g. `/docs/install`)
 *   to its markdown content. Missing pages are noted but skipped.
 */
export function generateLlmsFullTxt(
  config: GraphewayConfig,
  pageMarkdown: Record<string, string>,
): string {
  const head = generateLlmsTxt(config).trimEnd();
  const sections: Section[] = config.sections ?? [];
  const items: LlmsTxtItem[] = sections.flatMap((s) => s.items ?? []);

  const parts: string[] = [head];
  const used = new Set<string>();
  for (const item of items) {
    const path = rootPath(item.url);
    if (used.has(path)) continue;
    used.add(path);
    const md = pageMarkdown[path] ?? pageMarkdown[item.url];
    if (md === undefined) continue;
    parts.push("");
    parts.push(`# ${item.title}`);
    parts.push(`> Source: ${absoluteUrl(config, item.url)}`);
    parts.push("");
    parts.push(md.trim());
    parts.push("");
  }
  return parts.join("\n") + "\n";
}

/** Convert a possibly absolute URL into a root-relative path. */
export function rootPath(url: string): string {
  try {
    const u = new URL(url, "https://placeholder.invalid");
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

/** Validate an llms.txt string against the llmstxt.org spec (basic). */
export function validateLlmsTxt(text: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split("\n");
  if (!lines[0]?.startsWith("# ")) {
    errors.push("Line 1 must be a single H1 title (`# Title`).");
  }
  const hasH2 = lines.some((l) => l.startsWith("## "));
  if (!hasH2) errors.push("Expected at least one `## Section` file list.");
  const hasLink = lines.some((l) => l.trim().match(/^-\s*\[.+\]\(.+\)/));
  if (!hasLink) errors.push("Expected at least one `- [Title](url)` entry.");
  return { valid: errors.length === 0, errors };
}
