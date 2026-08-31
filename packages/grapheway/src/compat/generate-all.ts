/**
 * One-shot convenience: derive every legacy static artifact from a config.
 * Returns a map of `filename -> content`, ready to write to disk
 * (used by the CLI `generate` command) or serve directly.
 */

import type { GraphewayConfig } from "../core/index.js";
import { generateLlmsTxt } from "./llms-txt.ts";
import { buildAgentsTxt, buildAgentsJson } from "./agents-txt.ts";
import { buildRobotsTxt } from "./robots.ts";
import { generateSitemapXml } from "./sitemap.ts";

export function generateAll(config: GraphewayConfig): Record<string, string> {
  return {
    "llms.txt": generateLlmsTxt(config),
    "agents.txt": buildAgentsTxt(config),
    "agents.json": buildAgentsJson(config),
    "robots.txt": buildRobotsTxt(config),
    "sitemap.xml": generateSitemapXml(config),
  };
}
