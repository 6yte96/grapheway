#!/usr/bin/env node
/**
 * grapheway CLI
 *
 *   grapheway generate [--config grapheway.config.ts] [--out public]
 *   grapheway audit <url>
 *   grapheway serve  [--config grapheway.config.ts] [--port 3000]
 */

import { auditUrl, generate, parseFlags, parseProbeFlags, probe, serve } from "./commands.ts";
import { DEFAULT_CONFIG_PATH, loadConfig } from "./load-config.ts";

const HELP = `grapheway — native agent access for your web app

Usage:
  grapheway serve [--config <file>] [--port <port>]
      Serve the runtime agent surface: discovery (/.well-known/agent),
      knowledge graph (/graph/v1), JSON API (/agent), MCP (/mcp) — plus
      the optional compat files (llms.txt, robots.txt, sitemap.xml).

  grapheway probe <url> [--port <port>] [--out <dir>] [--depth <n>] [--max-pages <n>] [--no-serve]
      Convert ANY website into an agent-native knowledge graph — no site
      involvement, no paid crawlers. Crawls the site, extracts its content
      (nav, headings, links, OpenAPI endpoints) into a tagged graph, then
      serves it locally as the full agent surface (discovery, /graph/v1,
      /agent, MCP) and/or exports graph.json + config.json with --out.

  grapheway generate [--config <file>] [--out <dir>]
      Generate the legacy static files (llms.txt, agents.txt, agents.json,
      robots.txt, sitemap.xml) into <dir> (default: ./public).

  grapheway audit <url>
      Live agent-readiness audit with a GEO/agent score (0–100).

  grapheway --help
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h" || command === "help") {
    console.log(HELP);
    return;
  }

  switch (command) {
    case "generate": {
      const { configPath, outDir } = parseFlags(args.slice(1));
      const config = await loadConfig(configPath);
      const files = await generate(config, outDir ?? "public");
      console.log(`Generated ${files.length} agent files for "${config.name}":`);
      for (const f of files) console.log(`  ✓ ${f}`);
      break;
    }
    case "audit": {
      const url = args[1];
      if (!url) {
        console.error("grapheway: audit requires a URL, e.g. grapheway audit https://example.com");
        process.exit(1);
      }
      const result = await auditUrl(url);
      console.log(`\n  Agent Readiness Audit: ${result.url}`);
      console.log(`  Score: ${result.score}/100  Grade: ${result.grade}\n`);
      for (const check of result.checks) {
        const mark = check.ok ? "✓" : "✗";
        const detail = check.detail ? ` — ${check.detail}` : "";
        console.log(`  ${mark} ${check.label}${detail}`);
      }
      console.log(`\n  ${result.summary}\n`);
      break;
    }
    case "probe": {
      const flags = parseProbeFlags(args.slice(1));
      await probe(flags);
      break;
    }
    case "serve": {
      const { configPath, port } = parseFlags(args.slice(1));
      const config = await loadConfig(configPath ?? DEFAULT_CONFIG_PATH);
      await serve(config, port ?? 3000);
      break;
    }
    default:
      console.error(`grapheway: unknown command "${command}"`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`grapheway: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
