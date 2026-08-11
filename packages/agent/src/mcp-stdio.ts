#!/usr/bin/env node
/**
 * `grapheway-mcp <site-url>` — a runnable Model Context Protocol server
 * (stdio transport) that exposes any grapheway-enabled site to your local
 * MCP client (Claude Desktop, Cursor, Claude Code, VS Code, `mcp` CLI, ...).
 *
 * Example Claude Desktop config:
 *   "grapheway": { "command": "bunx", "args": ["grapheway-mcp", "https://example.com"] }
 *
 * The site's declared basic actions become MCP tools, so the agent can
 * read info and take basic actions against the site without scraping.
 */

import { GraphewayClient } from "./client.ts";
import { GRAPHEWAY_VERSION, GRAPH_TOOLS, type AgentManifest } from "grapheway";

const PROTOCOL_VERSION = "2025-03-26";

/** Execute a graph_* tool against the remote site via the client. */
async function clientGraphCall(
  client: GraphewayClient,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "graph_node":
      return client.graphNode(String(args.id ?? ""));
    case "graph_neighbors": {
      const rawDir = typeof args.direction === "string" ? args.direction.toLowerCase() : "";
      const direction = rawDir === "in" || rawDir === "out" ? rawDir : "both";
      return client.graphEdges(
        String(args.id ?? ""),
        direction as "out" | "in" | "both",
        typeof args.type === "string" ? args.type : undefined,
      );
    }
    case "graph_search": {
      const limit = Number(args.limit ?? 10);
      return client.graphSearch(String(args.q ?? ""), Number.isFinite(limit) && limit > 0 ? limit : 10);
    }
    case "graph_path":
      return client.graphPath(String(args.from ?? ""), String(args.to ?? ""));
    default:
      return null;
  }
}

function log(msg: string) {
  process.stderr.write(`[grapheway-mcp] ${msg}\n`);
}

function writeLine(obj: unknown) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function rpcResult(id: unknown, result: unknown) {
  writeLine({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string) {
  writeLine({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function runStdioServer(baseUrl: string) {
  const client = new GraphewayClient(baseUrl);
  let manifest: AgentManifest;

  try {
    manifest = await client.getManifest();
  } catch (err) {
    log(
      `✗ ${baseUrl} does not look grapheway-enabled: ${
        err instanceof Error ? err.message : String(err)
      }. Serve /agent with @grapheway/web, or generate static files with the grapheway CLI.`,
    );
    process.exit(1);
  }

  log(`connected to ${manifest.site.name} (${baseUrl})`);
  log(`exposing ${manifest.actions.length} tools: ${manifest.actions.map((a) => a.name).join(", ")}`);

  const tools = [
    ...manifest.actions.map((a) => ({
      name: a.name,
      description: a.description,
      inputSchema: a.inputSchema ?? { type: "object", properties: {} },
    })),
    ...GRAPH_TOOLS,
  ];

  let buffer = "";

  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", async (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let msg: { id?: unknown; method?: string; params?: Record<string, unknown> };
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }

      const id = msg.id;
      // Notifications: no response needed.
      if (id === undefined) continue;

      try {
        switch (msg.method) {
          case "initialize":
            rpcResult(id, {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: { tools: { listChanged: false } },
              serverInfo: { name: "grapheway-mcp", version: GRAPHEWAY_VERSION },
            });
            break;
          case "ping":
            rpcResult(id, {});
            break;
          case "tools/list":
            rpcResult(id, { tools });
            break;
          case "tools/call": {
            const name = String(msg.params?.name ?? "");
            const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
            if (!tools.some((t) => t.name === name)) {
              rpcError(id, -32602, `Unknown tool: ${name}`);
              break;
            }
            const result = GRAPH_TOOLS.some((t) => t.name === name)
              ? await clientGraphCall(client, name, args)
              : await client.callAction(name, args);
            rpcResult(id, {
              content: [
                {
                  type: "text",
                  text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                },
              ],
              isError: false,
            });
            break;
          }
          default:
            rpcError(id, -32601, `Method not found: ${msg.method}`);
        }
      } catch (err) {
        rpcError(id, -32603, err instanceof Error ? err.message : String(err));
      }
    }
  });
}

// CLI entry: `grapheway-mcp <site-url>`
function isCliEntry(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return entry.endsWith("mcp-stdio.ts") || entry.endsWith("mcp-stdio.js");
}

if (isCliEntry()) {
  const target = process.argv[2];
  if (!target) {
    log("usage: grapheway-mcp <site-url>");
    log("example: bunx grapheway-mcp https://example.com");
    process.exit(1);
  }
  runStdioServer(target);
}
