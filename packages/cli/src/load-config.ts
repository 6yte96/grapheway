/**
 * Load an grapheway config file.
 * Supported: `.ts`, `.mjs`, `.js`, `.json` (default export / module.exports).
 * Loaded via dynamic import so TypeScript configs work out of the box
 * under Bun (and under Node 22+ with `--experimental-strip-types`).
 */

import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GraphewayConfig } from "grapheway";

export async function loadConfig(configPath: string): Promise<GraphewayConfig> {
  const abs = resolve(configPath);

  if (abs.endsWith(".json")) {
    const raw = readFileSync(abs, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "default" in (parsed as Record<string, unknown>)) {
      return (parsed as { default: GraphewayConfig }).default;
    }
    return parsed as GraphewayConfig;
  }

  const mod = (await import(pathToFileURL(abs).href)) as Record<string, unknown>;

  // Accept common export names: default, config, graphewayConfig, grapheway.
  const candidates: unknown[] = [
    mod.default,
    mod.config,
    mod.graphewayConfig,
    mod.grapheway,
  ];
  const isConfig = (v: unknown): v is GraphewayConfig =>
    typeof v === "object" && v !== null && "name" in v && "url" in v;
  const named = candidates.find(isConfig);
  if (named) return named;

  // Fall back to the module itself if it IS a config (module.exports style).
  if (isConfig(mod)) return mod;

  throw new Error(
    `grapheway: ${configPath} must export a config object with at least { name, url } ` +
      `(export default, config, graphewayConfig, or grapheway).`,
  );
}

export const DEFAULT_CONFIG_PATH = "grapheway.config.ts";
