import { generateJsonLd, type GraphewayConfig, type AuditCheck } from "grapheway";
import { generateLlmsTxt, validateLlmsTxt } from "./llms-txt.ts";
import { buildRobotsTxt } from "./robots.ts";

/**
 * Audit a config's *output* — pure, no network. Verifies that every
 * artifact grapheway generates is well-formed and GEO-aligned.
 * Use `grapheway audit <url>` (CLI) for a live end-to-end audit.
 */
export function auditConfig(config: GraphewayConfig): AuditCheck[] {
  const checks: AuditCheck[] = [];
  const add = (id: string, label: string, ok: boolean, detail?: string, weight = 10) =>
    checks.push({ id, label, ok, detail, weight });

  const llms = generateLlmsTxt(config);
  const llmsValidation = validateLlmsTxt(llms);
  add("llms-h1", "llms.txt starts with an H1 title", llmsValidation.errors.length === 0, llmsValidation.errors[0], 10);
  add("llms-sections", "llms.txt has curated sections", (config.sections?.length ?? 0) > 0, undefined, 8);
  add("llms-summary", "llms.txt has a summary paragraph", Boolean(config.summary), undefined, 6);

  const robots = buildRobotsTxt(config);
  add("robots-ai", "robots.txt declares an AI crawler policy", robots.includes("GPTBot") && robots.includes("ClaudeBot"), undefined, 10);
  add("robots-training-blocked", "training crawlers are blocked by default", !(config.robots?.allowTraining ?? false), undefined, 5);

  const jsonLd = generateJsonLd(config);
  add("jsonld-org", "JSON-LD declares an Organization", jsonLd.some((o) => o["@type"] === "Organization"), undefined, 8);
  add("jsonld-website", "JSON-LD declares a WebSite", jsonLd.some((o) => o["@type"] === "WebSite"), undefined, 5);

  add("manifest", "Agent manifest is configured", Boolean(config.name && config.url), "config.name and config.url are required", 12);
  add("actions", "Basic actions are exposed", (config.actions?.length ?? 0) > 0, undefined, 8);
  add("sections-urls", "Sections use root-relative or absolute URLs", (config.sections ?? []).every((s) => (s.items ?? []).every((i) => /^\//.test(i.url) || /^https?:\/\//.test(i.url))), undefined, 6);
  add("contact", "Contact info published for agents", Boolean(config.contact?.email || config.contact?.url), undefined, 4);
  add("capabilities", "Capabilities declared", (config.capabilities?.length ?? 0) > 0, undefined, 3);

  return checks;
}

/** Compute a 0–100 score + grade from checks. */
export function scoreChecks(checks: AuditCheck[]): { score: number; grade: "A+" | "A" | "B" | "C" | "D" | "F" } {
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0) || 1;
  const earned = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  const score = Math.round((earned / totalWeight) * 100);
  const grade = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F";
  return { score, grade };
}
