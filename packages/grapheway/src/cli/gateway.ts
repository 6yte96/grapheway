/**
 * `grapheway gateway` — the standalone graph gateway.
 *
 * A lightweight server that HOLDS a graph (probed from any legacy site,
 * loaded from a config file, or from an exported graph.json) and speaks
 * the agent protocol to anyone — MCP over HTTP first. Agents connect by
 * pointing their MCP client at `http://localhost:<port>/mcp`; no client
 * shims, no per-agent processes, one live graph shared by many agents.
 *
 *   grapheway gateway --probe https://legacy-docs.example --refresh 24
 *   grapheway gateway --config grapheway.config.ts
 *   grapheway gateway --graph graph.json
 *
 * With `--probe` + `--refresh <hours>` the gateway re-crawls on a schedule
 * and pushes the structural diff through `patchGraph` — SSE subscribers and
 * MCP clients see the site go live without ever re-probing.
 */

import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { GraphewayConfig, KnowledgeGraph } from "../core/index.js";
import { compatHandler } from "../compat/index.js";
import { createGrapheway, toNodeHandler } from "../web/index.js";
import { createProbeAgent, probeSite, summarizeProbe } from "../probe/index.js";
import { positiveInt } from "./commands.ts";
import { loadConfig } from "./load-config.ts";

export interface GatewayFlags {
  port: number;
  host: string;
  /** Probe any legacy site into the held graph (mutually exclusive). */
  probeUrl?: string;
  /** Serve a config-defined graph (mutually exclusive). */
  configPath?: string;
  /** Hold an exported graph.json (mutually exclusive). */
  graphPath?: string;
  /** Re-crawl every N hours and patch the live graph (probe mode). */
  refreshHours?: number;
  depth?: number;
  maxPages?: number;
}

export interface GatewayHandle {
  /** The port actually listening (useful with port 0). */
  port: number;
  close: () => Promise<void>;
}

/** Parse `gateway` flags. Exactly one of --probe/--config/--graph is required. */
export function parseGatewayFlags(args: string[]): GatewayFlags {
  let port = 4321;
  let host = "127.0.0.1";
  let probeUrl: string | undefined;
  let configPath: string | undefined;
  let graphPath: string | undefined;
  let refreshHours: number | undefined;
  let depth: number | undefined;
  let maxPages: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (a === "--port" || a === "-p") port = positiveInt(args[++i], 4321) ?? 4321;
    else if (a === "--host") host = args[++i] ?? "127.0.0.1";
    else if (a === "--probe") probeUrl = args[++i];
    else if (a === "--config" || a === "-c") configPath = args[++i];
    else if (a === "--graph") graphPath = args[++i];
    else if (a === "--refresh") refreshHours = positiveInt(args[++i], 24);
    else if (a === "--depth" || a === "-d") depth = positiveInt(args[++i], 3);
    else if (a === "--max-pages" || a === "-m") maxPages = positiveInt(args[++i], 50);
  }
  const sources = [probeUrl, configPath, graphPath].filter(Boolean);
  if (sources.length !== 1) {
    throw new Error(
      "gateway needs exactly one graph source: --probe <url>, --config <file>, or --graph <file>",
    );
  }
  if (refreshHours && !probeUrl) {
    throw new Error("--refresh only makes sense with --probe (it re-crawls the probed site)");
  }
  return { port, host, probeUrl, configPath, graphPath, refreshHours, depth, maxPages };
}

/** The exact `mcpServers` snippet agents paste into Claude/Cursor/VS Code. */
export function mcpConfigJson(url: string): string {
  return JSON.stringify({ mcpServers: { grapheway: { url } } }, null, 2);
}

/** Print the gateway surface banner shared by all source modes. */
function printBanner(name: string, url: string, extras: string[] = []) {
  const lines = [
    `Gateway \"${name}\" listening on ${url}`,
    `  discovery    ${url}/.well-known/agent`,
    `  graph        ${url}/graph/v1`,
    `  viewer       ${url}/graph (interactive)`,
    `  events       ${url}/graph/v1/events (realtime SSE)`,
    `  manifest     ${url}/agent`,
    `  MCP          ${url}/mcp`,
    ...extras,
    ``,
    `Connect any agent — paste this into Claude Desktop / Cursor / VS Code / Claude Code:`,
    mcpConfigJson(`${url}/mcp`),
    ``,
  ];
  console.log("\n" + lines.join("\n"));
}

/**
 * Run the gateway until the process exits. Resolves once listening, with a
 * handle for tests (`close()`). In probe + --refresh mode a timer re-crawls
 * the site and patches the live graph.
 */
export async function runGateway(flags: GatewayFlags): Promise<GatewayHandle> {
  const { port, host, probeUrl, configPath, graphPath, refreshHours } = flags;

  let name: string;
  let handler: ReturnType<typeof createGrapheway>["handler"];
  let compat: ReturnType<typeof compatHandler> | undefined;
  let refreshTimer: ReturnType<typeof setInterval> | undefined;

  if (probeUrl) {
    const origin = probeUrl.replace(/\/+$/, "");
    const result = await probeSite(origin, { maxDepth: flags.depth, maxPages: flags.maxPages });
    console.log("\n" + summarizeProbe(result) + "\n");
    const holder = createProbeAgent(origin, result);
    name = result.config.name;
    handler = holder.agent.handler;

    if (refreshHours && refreshHours > 0) {
      const intervalMs = refreshHours * 3_600_000;
      let refreshing = false; // guard against overlapping crawls
      refreshTimer = setInterval(async () => {
        if (refreshing) return;
        refreshing = true;
        try {
          const next = await probeSite(origin, { maxDepth: flags.depth, maxPages: flags.maxPages });
          const version = holder.refresh(next);
          console.log(
            `[gateway] refreshed ${next.config.name}: v${version} (${next.stats.pages} pages, ${next.stats.edges} edges)`,
          );
        } catch (err) {
          console.error(`[gateway] refresh failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          refreshing = false;
        }
      }, intervalMs);
    }
  } else if (configPath) {
    const config = await loadConfig(configPath);
    const agent = createGrapheway(config);
    compat = compatHandler(config);
    name = config.name;
    handler = agent.handler;
  } else {
    // --graph <file>: hold an exported graph.json ({ config, graph }).
    const raw = await readFile(graphPath!, "utf8");
    const data = JSON.parse(raw) as { config?: GraphewayConfig; graph?: KnowledgeGraph };
    if (!data.graph) throw new Error(`--graph ${graphPath} is missing a "graph" field`);
    const config: GraphewayConfig = data.config ?? {
      name: "Graph",
      url: "http://localhost",
      capabilities: ["graph"],
    };
    const agent = createGrapheway(config, { graph: { builder: () => data.graph! } });
    name = config.name;
    handler = agent.handler;
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (compat) {
      const path = new URL(req.url ?? "/", "http://localhost").pathname;
      const compatRes = await compat({ path });
      if (compatRes) {
        res.statusCode = compatRes.status;
        for (const [k, v] of Object.entries(compatRes.headers)) res.setHeader(k, v);
        res.setHeader("content-type", compatRes.contentType);
        res.end(compatRes.body);
        return;
      }
    }
    await toNodeHandler(handler)(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  const actualBase = `http://${host === "0.0.0.0" ? "localhost" : host}:${actualPort}`;
  printBanner(name, actualBase, refreshTimer ? [`  refresh      every ${refreshHours}h (patches the live graph)`] : []);

  return {
    port: actualPort,
    close: async () => {
      if (refreshTimer) clearInterval(refreshTimer);
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
