/**
 * Export a probed site's graph + config as static JSON — for CI caches,
 * offline use, or feeding other tooling.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProbeResult } from "./graph.ts";

export interface ExportOptions {
  /** Output directory (default `./grapheway-probe`). */
  outDir?: string;
  /** Also write llms.txt-style markdown for every page. */
  withMarkdown?: boolean;
}

/**
 * Write `graph.json` + `config.json` (+ `llms.txt` when requested).
 * Returns the paths written.
 */
export async function exportProbed(
  result: ProbeResult,
  options: ExportOptions = {},
): Promise<string[]> {
  const outDir = options.outDir ?? "grapheway-probe";
  await mkdir(outDir, { recursive: true });

  const written: string[] = [];
  const write = async (name: string, content: string) => {
    const target = join(outDir, name);
    await writeFile(target, content, "utf-8");
    written.push(target);
  };

  await write("graph.json", JSON.stringify({ config: result.config, graph: result.graph }, null, 2));
  await write("config.json", JSON.stringify(result.config, null, 2));

  if (options.withMarkdown) {
    const md = result.pages
      .map((p) => `# ${p.title}\n\n${p.description ? p.description + "\n\n" : ""}(${p.url})\n`)
      .join("\n---\n\n");
    await write("pages.md", md);
  }

  return written;
}
