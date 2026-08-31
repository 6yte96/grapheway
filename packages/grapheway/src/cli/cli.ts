#!/usr/bin/env node
/**
 * grapheway CLI
 *
 *   grapheway generate [--config grapheway.config.ts] [--out public]
 *   grapheway audit <url>
 *   grapheway serve  [--config grapheway.config.ts] [--port 3000]
 */

import { auditUrl, generate, parseFlags, parseProbeFlags, probe, serve } from "./commands.ts";
import { mcpConfigJson, parseGatewayFlags, runGateway } from "./gateway.ts";
import { DEFAULT_CONFIG_PATH, loadConfig } from "./load-config.ts";

const HELP = `grapheway — native agent access for your web app

Usage:
  grapheway gateway --probe <url> [--refresh <hours>] [--port <port>] [--host <host>] [--depth <n>] [--max-pages <n>]
  grapheway gateway --config <file> [--port <port>] [--host <host>]
  grapheway gateway --graph <graph.json> [--port <port>] [--host <host>]
      The standalone graph gateway: a lightweight server that HOLDS a graph
      (probed from any legacy site, from a config file, or from an exported
      graph.json) and speaks the agent protocol to anyone — MCP over HTTP
      first. Agents connect by pointing their MCP client at /mcp; with
      --probe --refresh <hours> it re-crawls on a schedule and patches the
      live graph, so subscribers always see the site fresh.

  grapheway mcp-config [--url <url>] [--port <port>]
      Print the exact mcpServers JSON to paste into Claude Desktop, Cursor,
      VS Code or Claude Code — the "connect your agent" snippet.

  grapheway probe <url> [--port <port>] [--out <dir>] [--depth <n>] [--max-pages <n>] [--no-serve]
      Convert ANY website into an agent-native knowledge graph — no site
      involvement, no paid crawlers. Crawls the site, extracts its content
      (nav, headings, links, OpenAPI endpoints) into a tagged graph, then
      serves it locally as the full agent surface (discovery, /graph/v1,
      /agent, MCP) and/or exports graph.json + config.json with --out.

  grapheway serve [--config <file>] [--port <port>]
      Serve the runtime agent surface plus the optional compat files
      (llms.txt, robots.txt, sitemap.xml) from a config file.

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
    case "gateway": {
      const flags = parseGatewayFlags(args.slice(1));
      await runGateway(flags);
      break;
    }
    case "mcp-config": {
      const rest = args.slice(1);
      let url = "http://localhost:4321/mcp";
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i] ?? "";
        if (a === "--url") url = rest[++i] ?? url;
        else if (a === "--port") url = `http://localhost:${rest[++i] ?? 4321}/mcp`;
      }
      if (!url.endsWith("/mcp")) url = url.replace(/\/+$/, "") + "/mcp";
      console.log(`Paste this into Claude Desktop / Cursor / VS Code / Claude Code:\n`);
      console.log(mcpConfigJson(url));
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
