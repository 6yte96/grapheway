/**
 * The three CLI commands: `generate`, `audit`, `serve`.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { GraphewayConfig, AuditResult } from "grapheway";
import { compatHandler, generateAll } from "@grapheway/compat";
import { createGrapheway, toNodeHandler } from "@grapheway/web";
import { exportProbed, probeSite, serveProbed, summarizeProbe } from "@grapheway/probe";
import { loadConfig } from "./load-config.ts";

/**
 * `grapheway generate [--config path] [--out dir]` — legacy static files
 * (llms.txt, agents.txt, agents.json, robots.txt, sitemap.xml) via compat.
 */
export async function generate(config: GraphewayConfig, outDir: string): Promise<string[]> {
  const files = generateAll(config);

  const out = resolve(outDir);
  await mkdir(out, { recursive: true });
  const written: string[] = [];
  for (const [name, content] of Object.entries(files)) {
    const target = join(out, name);
    await writeFile(target, content, "utf-8");
    written.push(target);
  }
  return written;
}

interface LiveCheck {
  label: string;
  ok: boolean;
  detail?: string;
  weight: number;
}

/**
 * `grapheway audit <url>` — live agent-readiness audit (GEO score).
 * Checks the *deployed* site, not your local config.
 */
export async function auditUrl(url: string): Promise<AuditResult> {
  const origin = url.replace(/\/+$/, "");
  const checks: LiveCheck[] = [];
  const add = (label: string, ok: boolean, detail?: string, weight = 10) =>
    checks.push({ label, ok, detail, weight });

  const fetchText = async (path: string) => {
    try {
      const res = await fetch(origin + path, { redirect: "follow" });
      return { status: res.status, text: await res.text(), headers: res.headers };
    } catch {
      return { status: 0, text: "", headers: undefined };
    }
  };

  // 1. Discovery + graph (the runtime surface)
  const discovery = await fetchText("/.well-known/agent");
  const discoveryOk = discovery.status === 200 && discovery.text.includes('"protocol"');
  add(
    "discovery (.well-known/agent)",
    discoveryOk,
    discovery.status === 0 ? "unreachable" : `HTTP ${discovery.status}`,
    14,
  );
  const graph = await fetchText("/graph/v1");
  add(
    "knowledge graph (/graph/v1)",
    graph.status === 200 && /"nodes"\s*:\s*[1-9]/.test(graph.text),
    graph.status === 0 ? "unreachable" : `HTTP ${graph.status}`,
    12,
  );

  // 2. robots.txt + AI policy
  const robots = await fetchText("/robots.txt");
  add(
    "robots.txt exists",
    robots.status === 200,
    robots.status === 0 ? "unreachable" : `HTTP ${robots.status}`,
    10,
  );
  add(
    "AI crawler policy (GPTBot/ClaudeBot)",
    robots.status === 200 && /GPTBot/.test(robots.text) && /ClaudeBot/.test(robots.text),
    undefined,
    6,
  );

  // 3. llms.txt (compat)
  const llms = await fetchText("/llms.txt");
  add(
    "llms.txt exists (compat)",
    llms.status === 200,
    llms.status === 0 ? "unreachable" : `HTTP ${llms.status}`,
    8,
  );
  add(
    "llms.txt well-formed (H1 + sections)",
    llms.status === 200 && /^#\s/m.test(llms.text) && /^##\s/m.test(llms.text),
    undefined,
    6,
  );

  // 4. agents.json / agent manifest
  const agentsJson = await fetchText("/agents.json");
  const agentsOk = agentsJson.status === 200 && agentsJson.text.trim().startsWith("{");
  add("agents.json manifest exists (compat)", agentsOk, undefined, 6);
  const agentEndpoint = await fetchText("/agent");
  const agentApiOk = agentEndpoint.status === 200 && agentEndpoint.text.includes('"actions"');
  add(
    "/agent API (info + actions)",
    agentApiOk,
    agentEndpoint.status === 0 ? "unreachable" : `HTTP ${agentEndpoint.status}`,
    8,
  );

  // 5. MCP endpoint
  add("open MCP endpoint (/mcp)", (await fetchText("/mcp")).status === 200, undefined, 10);

  // 6. Homepage semantics
  const home = await fetchText("/");
  add("homepage reachable", home.status === 200, home.status === 0 ? "unreachable" : `HTTP ${home.status}`, 6);
  const html = home.text.toLowerCase();
  add(
    "meta description present",
    home.status === 200 && /<meta[^>]+name=["']description["']/i.test(home.text),
    undefined,
    4,
  );
  add(
    "structured data (JSON-LD) present",
    home.status === 200 && /application\/ld\+json/.test(html),
    undefined,
    6,
  );
  add(
    "semantic HTML: single H1",
    home.status === 200 && (html.match(/<h1[\s>]/g) ?? []).length === 1,
    undefined,
    2,
  );
  add(
    "server-rendered content (no blank body)",
    home.status === 200 && home.text.replace(/<[^>]+>/g, "").trim().length > 100,
    undefined,
    2,
  );

  // 7. sitemap
  add("sitemap.xml exists (compat)", (await fetchText("/sitemap.xml")).status === 200, undefined, 0);

  const totalWeight = checks.reduce((s, c) => s + c.weight, 0) || 1;
  const earned = checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0);
  const score = Math.round((earned / totalWeight) * 100);
  const grade: AuditResult["grade"] =
    score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : score >= 50 ? "D" : "F";
  const failed = checks.filter((c) => !c.ok);

  return {
    url: origin,
    score,
    grade,
    checks: checks.map((c) => ({ id: c.label, label: c.label, ok: c.ok, detail: c.detail, weight: c.weight })),
    summary:
      failed.length === 0
        ? "Fully agent-ready. Agents can discover, read and act on this site."
        : `${failed.length} issue${failed.length > 1 ? "s" : ""} found: ${failed
            .map((c) => c.label)
            .join(", ")}.`,
  };
}

/**
 * `grapheway probe <url> [--port n] [--out dir] [--depth n] [--max-pages n]`
 * — convert any legacy website into an agent-native graph. Crawls the site,
 * builds a tagged knowledge graph from its content (nav, headings, links,
 * OpenAPI endpoints), then serves it locally as the full agent surface —
 * discovery, /graph/v1, /agent, MCP — for agents to use, and/or exports it.
 */
export interface ProbeFlags {
  url: string;
  port?: number;
  outDir?: string;
  depth?: number;
  maxPages?: number;
  noServe?: boolean;
}

export async function probe(flags: ProbeFlags): Promise<void> {
  const { url, port, outDir, depth, maxPages, noServe } = flags;
  const result = await probeSite(url, { maxDepth: depth, maxPages });
  console.log("\n" + summarizeProbe(result) + "\n");

  if (outDir) {
    const files = await exportProbed(result, { outDir });
    for (const f of files) console.log(`  ✓ ${f}`);
    console.log("");
  }

  if (noServe) return;

  const server = await serveProbed(url, { result });
  const p = port ?? 4321;
  console.log(`Serving "${result.config.name}" as an agent surface:`);
  console.log(`  discovery    http://localhost:${p}/.well-known/agent`);
  console.log(`  graph        http://localhost:${p}/graph/v1`);
  console.log(`  events       http://localhost:${p}/graph/v1/events (realtime SSE)`);
  console.log(`  manifest     http://localhost:${p}/agent`);
  console.log(`  MCP          http://localhost:${p}/mcp`);
  console.log(`  point agents at http://localhost:${p} (grapheway-mcp, GraphewayClient, SKILL.md)\n`);
  await new Promise<void>(() => {}); // keep serving
}

/**
 * `grapheway serve --config path [--port n]` — serve the runtime agent
 * surface (discovery, graph, /agent, /mcp) plus the optional compat files.
 */
export async function serve(config: GraphewayConfig, port: number): Promise<void> {
  const compat = compatHandler(config);
  const agent = createGrapheway(config);

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    const compatRes = await compat({ path });
    if (compatRes) {
      res.statusCode = compatRes.status;
      for (const [k, v] of Object.entries(compatRes.headers)) res.setHeader(k, v);
      res.setHeader("content-type", compatRes.contentType);
      res.end(compatRes.body);
      return;
    }
    await toNodeHandler(agent.handler)(req, res);
  });

  server.listen(port, () => {
    console.log(`grapheway serving for "${config.name}"`);
    console.log(`  discovery    http://localhost:${port}/.well-known/agent`);
    console.log(`  graph        http://localhost:${port}/graph/v1`);
    console.log(`  manifest     http://localhost:${port}/agent`);
    console.log(`  MCP          http://localhost:${port}/mcp`);
    console.log(`  compat       http://localhost:${port}/llms.txt (robots.txt, sitemap.xml, …)`);
  });
}

/** Shared arg parsing for `generate`/`serve`. */
export function parseFlags(args: string[]): { configPath: string; outDir?: string; port?: number } {
  let configPath = "grapheway.config.ts";
  let outDir: string | undefined;
  let port: number | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (a === "--config" || a === "-c") configPath = args[++i] ?? configPath;
    else if (a === "--out" || a === "-o") outDir = args[++i] ?? "public";
    else if (a === "--port" || a === "-p") port = Number(args[++i] ?? 3000);
  }
  return { configPath, outDir, port };
}

/** Parse a positive integer flag value; returns undefined when absent or junk. */
function positiveInt(raw: string | undefined, fallback: number): number | undefined {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

/** Parse `probe` flags: <url> [--port n] [--out dir] [--depth n] [--max-pages n] [--no-serve]. */
export function parseProbeFlags(args: string[]): ProbeFlags {
  let url = "";
  let port: number | undefined;
  let outDir: string | undefined;
  let depth: number | undefined;
  let maxPages: number | undefined;
  let noServe = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? "";
    if (a === "--port" || a === "-p") port = positiveInt(args[++i], 4321) ?? 4321;
    else if (a === "--out" || a === "-o") outDir = args[++i];
    else if (a === "--depth" || a === "-d") depth = positiveInt(args[++i], 3);
    else if (a === "--max-pages" || a === "-m") maxPages = positiveInt(args[++i], 50);
    else if (a === "--no-serve") noServe = true;
    else if (!url && !a.startsWith("-")) url = a;
  }
  if (!url) {
    throw new Error("probe requires a URL, e.g. grapheway probe https://docs.example.com");
  }
  return { url, port, outDir, depth, maxPages, noServe };
}
