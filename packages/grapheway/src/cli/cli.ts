#!/usr/bin/env node
/**
 * grapheway CLI
 *
 *   grapheway generate [--config grapheway.config.ts] [--out public]
 *   grapheway audit <url>
 *   grapheway serve  [--config grapheway.config.ts] [--port 3000]
 */

import { readFile, writeFile } from "node:fs/promises";
import {
  GRAPHEWAY_INDEX,
  GRAPHEWAY_REPO,
  GRAPHEWAY_SITE,
  GRAPHEWAY_VERSION,
  type GraphewayConfig,
  type KnowledgeGraph,
} from "../core/index.js";
import { createProbeAgent, probeSite, summarizeProbe } from "../probe/index.js";
import { createGrapheway } from "../web/index.js";
import { badgeMarkdown, generateBadgeSvg } from "./badge.ts";
import { auditUrl, generate, parseFlags, parseProbeFlags, probe, serve } from "./commands.ts";
import { mcpConfigJson, parseGatewayFlags, runGateway } from "./gateway.ts";
import { scaffoldProject, type Framework, type InitOptions } from "./init.ts";
import { DEFAULT_CONFIG_PATH, loadConfig } from "./load-config.ts";
import { runStdioServer, type StdioAgent } from "./stdio.ts";

/** One-line, non-nagging growth footer shown after a successful command. */
function printGrowthFooter(): void {
  console.log(`  ★ Star grapheway: ${GRAPHEWAY_REPO}`);
  console.log(`  ◇ Add your site to the live index: ${GRAPHEWAY_INDEX}\n`);
}

const HELP = `grapheway — native agent access for your web app

New here? Run \`grapheway init\` inside your project. It detects the
framework, writes a config, and mounts the agent surface in one step.

Usage:
  grapheway init [--dir <dir>] [--url <site>] [--name <name>] [--framework next|express|hono|node|static] [--max-pages <n>] [--force]
      Zero-to-agent-surface scaffold. With --url, probes the existing site
      and generates a real config (sections, links, actions) from its content.
      Next.js gets middleware + route handler; Express/Hono/node get an exact
      mount snippet; static hosts get the compat files.

  grapheway badge [--score <n>] [--url <site>] [--label <text>] [--value <text>] [--out <file>] [--md]
      Emit an embeddable SVG agent-readiness badge (no tracking). With --url,
      runs the live audit first; with --md, prints the markdown snippet.

  grapheway gateway --probe <url> [--refresh <hours>] [--port <port>] [--host <host>] [--depth <n>] [--max-pages <n>]
  grapheway gateway --config <file> [--port <port>] [--host <host>]
  grapheway gateway --graph <graph.json> [--port <port>] [--host <host>]
      The standalone graph gateway: a lightweight server that HOLDS a graph
      (probed from any legacy site, from a config file, or from an exported
      graph.json) and speaks the agent protocol to anyone — MCP over HTTP
      first. Agents connect by pointing their MCP client at /mcp; with
      --probe --refresh <hours> it re-crawls on a schedule and patches the
      live graph, so subscribers always see the site fresh.

  grapheway mcp (--probe <url> | --config <file> | --graph <file>)
      Run a stdio MCP server — the universal client path for Claude Desktop,
      Cursor, VS Code and any local MCP client. Protocol on stdout, logs on
      stderr. No hosting, no port, no account.

  grapheway mcp-config [--url <url>] [--port <port>]
  grapheway mcp-config --stdio [--probe <url> | --config <file>]
      Print the exact mcpServers JSON to paste into Claude Desktop, Cursor,
      VS Code or Claude Code. Use --stdio for a local command-based server.

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

  grapheway --version
      Print the installed version.

  grapheway --help
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h" || command === "help") {
    console.log(HELP);
    return;
  }

  if (command === "--version" || command === "-v" || command === "version") {
    // Bare version so scripts can read it directly.
    console.log(GRAPHEWAY_VERSION);
    return;
  }

  switch (command) {
    case "init": {
      const rest = args.slice(1);
      const options: InitOptions = {};
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i] ?? "";
        if (a === "--dir" || a === "-d") options.dir = rest[++i];
        else if (a === "--url" || a === "-u") options.url = rest[++i];
        else if (a === "--name" || a === "-n") options.name = rest[++i];
        else if (a === "--framework" || a === "-f") options.framework = rest[++i] as Framework;
        else if (a === "--max-pages" || a === "-m") options.maxPages = Number(rest[++i] ?? 20);
        else if (a === "--force") options.force = true;
      }
      const result = await scaffoldProject(options);
      console.log(
        `\n  grapheway init — ${result.framework}${result.probed ? " · config generated from live probe" : ""}\n`,
      );
      for (const file of result.files) console.log(`  ✓ ${file}`);
      for (const file of result.skipped) console.log(`  · ${file} (exists — use --force to overwrite)`);
      console.log("\n  Next:");
      for (const step of result.nextSteps) console.log(`    ${step}`);
      console.log("");
      printGrowthFooter();
      break;
    }
    case "badge": {
      const rest = args.slice(1);
      let score: number | undefined;
      let url: string | undefined;
      let label = "agent-ready";
      let value: string | undefined;
      let out: string | undefined;
      let markdown = false;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i] ?? "";
        if (a === "--score") score = Number(rest[++i]);
        else if (a === "--url") url = rest[++i];
        else if (a === "--label") label = rest[++i] ?? label;
        else if (a === "--value") value = rest[++i];
        else if (a === "--out" || a === "-o") out = rest[++i];
        else if (a === "--md") markdown = true;
      }
      if (url && (score === undefined || !Number.isFinite(score))) {
        const result = await auditUrl(url);
        score = result.score;
      }
      const finalValue = value ?? (score !== undefined && Number.isFinite(score) ? `${score}/100` : "grapheway");
      const svg = generateBadgeSvg({ label, value: finalValue });
      if (out) {
        await writeFile(out, svg, "utf-8");
        console.log(`  ✓ ${out}`);
        if (markdown) console.log(`  ${badgeMarkdown(out, url ?? GRAPHEWAY_SITE)}`);
      } else {
        console.log(svg);
      }
      break;
    }
    case "generate": {
      const { configPath, outDir } = parseFlags(args.slice(1));
      const config = await loadConfig(configPath);
      const files = await generate(config, outDir ?? "public");
      console.log(`Generated ${files.length} agent files for "${config.name}":`);
      for (const f of files) console.log(`  ✓ ${f}`);
      printGrowthFooter();
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
      printGrowthFooter();
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
    case "mcp": {
      const rest = args.slice(1);
      let probeUrl: string | undefined;
      let configPath: string | undefined;
      let graphPath: string | undefined;
      let maxPages = 25;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i] ?? "";
        if (a === "--probe") probeUrl = rest[++i];
        else if (a === "--config" || a === "-c") configPath = rest[++i];
        else if (a === "--graph") graphPath = rest[++i];
        else if (a === "--max-pages" || a === "-m") maxPages = Number(rest[++i] ?? 25);
      }
      const sources = [probeUrl, configPath, graphPath].filter(Boolean);
      if (sources.length !== 1) {
        console.error(
          "grapheway mcp needs exactly one source: --probe <url>, --config <file>, or --graph <file>",
        );
        process.exit(1);
      }

      let agent: StdioAgent;
      if (probeUrl) {
        const result = await probeSite(probeUrl, { maxDepth: 2, maxPages });
        console.error("\n" + summarizeProbe(result) + "\n");
        agent = createProbeAgent(probeUrl, result).agent;
      } else if (configPath) {
        const config = await loadConfig(configPath);
        agent = createGrapheway(config);
      } else {
        const raw = JSON.parse(await readFile(graphPath!, "utf-8")) as {
          config?: GraphewayConfig;
          graph?: KnowledgeGraph;
        };
        if (!raw.config) {
          console.error("grapheway mcp: --graph must point at an exported { config, graph } file");
          process.exit(1);
        }
        const graph = raw.graph;
        agent = graph
          ? createGrapheway(raw.config, { graph: { builder: () => graph } })
          : createGrapheway(raw.config);
      }

      await runStdioServer(agent);
      break;
    }
    case "mcp-config": {
      const rest = args.slice(1);
      let url = "http://localhost:4321/mcp";
      let stdio = false;
      let probeUrl: string | undefined;
      let configPath: string | undefined;
      for (let i = 0; i < rest.length; i++) {
        const a = rest[i] ?? "";
        if (a === "--url") url = rest[++i] ?? url;
        else if (a === "--port") url = `http://localhost:${rest[++i] ?? 4321}/mcp`;
        else if (a === "--stdio") stdio = true;
        else if (a === "--probe") probeUrl = rest[++i];
        else if (a === "--config") configPath = rest[++i];
      }
      if (stdio) {
        const source = probeUrl
          ? ["--probe", probeUrl]
          : ["--config", configPath ?? "grapheway.config.ts"];
        console.log(`Paste this into Claude Desktop / Cursor / VS Code / Claude Code:\n`);
        console.log(
          JSON.stringify(
            {
              mcpServers: {
                grapheway: { command: "npx", args: ["-y", "grapheway", "mcp", ...source] },
              },
            },
            null,
            2,
          ),
        );
        printGrowthFooter();
        break;
      }
      if (!url.endsWith("/mcp")) url = url.replace(/\/+$/, "") + "/mcp";
      console.log(`Paste this into Claude Desktop / Cursor / VS Code / Claude Code:\n`);
      console.log(mcpConfigJson(url));
      printGrowthFooter();
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
