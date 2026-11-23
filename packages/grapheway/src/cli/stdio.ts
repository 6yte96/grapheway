/**
 * Stdio transport for MCP — the universal client path.
 *
 * HTTP `/mcp` is great for servers, but Claude Desktop, Cursor and most
 * local clients launch a command and speak newline-delimited JSON-RPC over
 * stdin/stdout. This makes grapheway usable with zero hosting:
 *
 *   npx -y grapheway mcp --probe https://docs.example.com
 *   npx -y grapheway mcp --config grapheway.config.ts
 *
 * Protocol messages go to stdout. Logs go to stderr so they never corrupt
 * the JSON-RPC stream.
 */

import { createInterface } from "node:readline";
import type { AgentManifest, KnowledgeGraph } from "../core/index.js";
import { handleMcpMessage, type McpDeps } from "../web/mcp.ts";
import type { AgentRequest, AgentResponse } from "../web/types.ts";

/** The subset of `createGrapheway()` the stdio transport needs. */
export interface StdioAgent {
  manifest: AgentManifest;
  graph: KnowledgeGraph;
  handler: (req: AgentRequest) => Promise<AgentResponse>;
}

export interface StdioOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  error?: NodeJS.WritableStream;
}

async function callAction(
  agent: StdioAgent,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const res = await agent.handler({
    method: "POST",
    url: "/agent/action",
    headers: { "content-type": "application/json" },
    body: { name, arguments: args },
  });
  let data: { ok?: boolean; result?: unknown; error?: string };
  try {
    data = JSON.parse(res.body) as typeof data;
  } catch {
    throw new Error(`Action ${name} returned a non-JSON response`);
  }
  if (!data.ok) throw new Error(data.error ?? `Action ${name} failed`);
  return data.result;
}

/** Build the MCP dependency bag from a live grapheway agent. */
export function buildStdioDeps(agent: StdioAgent): McpDeps {
  return {
    manifest: agent.manifest,
    graph: agent.graph,
    runAction: (name, args) => callAction(agent, name, args),
    readNode: async (id) => {
      try {
        const page = await callAction(agent, "get_page", { url: id });
        if (typeof page === "string") return page;
      } catch {
        // Fall through to the node representation.
      }
      const res = await agent.handler({
        method: "GET",
        url: `/graph/v1/node?id=${encodeURIComponent(id)}`,
        headers: {},
      });
      return res.body;
    },
  };
}

/**
 * Run the stdio MCP loop until the input stream closes.
 * Exported for tests with injectable streams.
 */
export async function runStdioServer(agent: StdioAgent, options: StdioOptions = {}): Promise<void> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;
  const error = options.error ?? process.stderr;
  const deps = buildStdioDeps(agent);

  const write = (value: unknown) => {
    output.write(`${JSON.stringify(value)}\n`);
  };

  error.write(
    `grapheway MCP (stdio) · "${agent.manifest.site.name}" · ` +
      `${agent.graph.nodes.length} nodes · ${agent.graph.edges.length} edges\n`,
  );

  const rl = createInterface({ input, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let message: unknown;
    try {
      message = JSON.parse(trimmed);
    } catch {
      write({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }

    try {
      const response = await handleMcpMessage(message, deps);
      if (response !== null) write(response);
    } catch (err) {
      const id =
        typeof message === "object" && message !== null && "id" in message
          ? (message as { id?: unknown }).id ?? null
          : null;
      write({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }
}
