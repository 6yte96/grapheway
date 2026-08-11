/**
 * Minimal, spec-aligned implementation of the Model Context Protocol
 * *Streamable HTTP* transport (https://modelcontextprotocol.io).
 *
 * Any MCP client (Claude Desktop, Cursor, Claude Code, `mcp` CLI, ...) can
 * connect to your site's `/mcp` endpoint and get:
 *   - the site's knowledge graph as native tools (`graph_node`,
 *     `graph_neighbors`, `graph_search`, `graph_path`)
 *   - the site's declared actions as tools (`tools/call`)
 *   - node content as markdown resources (`resources/read`)
 *
 * Supported methods: `initialize`, `notifications/initialized`, `ping`,
 * `tools/list`, `tools/call`, `resources/list`, `resources/read`,
 * `prompts/list`. Responses are JSON (or SSE on GET).
 */

import {
  GRAPHEWAY_VERSION,
  GRAPH_TOOLS,
  findNode,
  findPath,
  neighborsOf,
  searchNodes,
  type AgentManifest,
  type GraphEdgeType,
  type KnowledgeGraph,
} from "grapheway";
import type { AgentRequest } from "./types.ts";

export const MCP_PROTOCOL_VERSION = "2025-03-26";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

interface McpToolDef {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpDeps {
  manifest: AgentManifest;
  runAction: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Actions registered at runtime (via createGrapheway options) that are not in the manifest. */
  additionalTools?: McpToolDef[];
  /** The site's knowledge graph — powers the graph_* tools + resources. */
  graph: KnowledgeGraph;
  /** Resolves a node id to markdown (for resources/read). */
  readNode?: (id: string) => Promise<string>;
}

/** The site's graph as native MCP tools (shared definition from core). */
export { GRAPH_TOOLS };

/** Map the site's declared + runtime-registered actions to MCP tool definitions. */
export function toolsForManifest(manifest: AgentManifest, additional: McpToolDef[] = []): McpToolDef[] {
  const extra = new Set(additional.map((t) => t.name));
  const declared = manifest.actions
    .map((a) => ({
      name: a.name,
      description: a.description,
      inputSchema: a.inputSchema ?? { type: "object", properties: {} },
    }))
    .filter((t) => !extra.has(t.name));
  return [...declared, ...GRAPH_TOOLS, ...additional];
}

/** True when a tool with this name is callable over MCP. */
export function isKnownTool(deps: McpDeps, name: string): boolean {
  return (
    deps.manifest.actions.some((a) => a.name === name) ||
    (deps.additionalTools ?? []).some((t) => t.name === name) ||
    GRAPH_TOOLS.some((t) => t.name === name)
  );
}

/** Execute a graph_* tool against the site graph (synchronous). */
export function callGraphTool(deps: McpDeps, name: string, args: Record<string, unknown>): unknown {
  const g = deps.graph;
  switch (name) {
    case "graph_node":
      return findNode(g, String(args.id ?? ""));
    case "graph_neighbors": {
      const rawDir = typeof args.direction === "string" ? args.direction.toLowerCase() : "";
      const dir = rawDir === "in" || rawDir === "out" ? rawDir : "both";
      const type = typeof args.type === "string" ? (args.type as GraphEdgeType) : undefined;
      return neighborsOf(g, String(args.id ?? ""), dir, type);
    }
    case "graph_search": {
      const limit = Number(args.limit ?? 10);
      const safe = Number.isFinite(limit) && limit > 0 ? limit : 10;
      return { query: args.q, results: searchNodes(g, String(args.q ?? ""), safe) };
    }
    case "graph_path":
      return { path: findPath(g, String(args.from ?? ""), String(args.to ?? "")) };
    default:
      return null;
  }
}

function rpcError(id: JsonRpcRequest["id"], code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Handle a JSON-RPC message over the MCP endpoint.
 * Returns the JSON-RPC response (or `null` for notifications, which the
 * caller answers with HTTP 202 and no body).
 */
export async function handleMcpMessage(
  raw: unknown,
  deps: McpDeps,
): Promise<Record<string, unknown> | null> {
  let msg: JsonRpcRequest;
  try {
    if (typeof raw !== "object" || raw === null) throw new Error("not an object");
    msg = raw as JsonRpcRequest;
    if (msg.jsonrpc !== "2.0") {
      return rpcError(msg.id ?? null, -32600, "Invalid Request: jsonrpc must be 2.0");
    }
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const method = msg.method ?? "";
  const id = msg.id ?? null;

  // Notifications have no id — respond to the transport with 202, nothing here.
  if (msg.id === undefined) return null;

  try {
    switch (method) {
      case "initialize": {
        const clientVersion = (msg.params?.protocolVersion as string) ?? "unknown";
        return rpcResult(id, {
          protocolVersion:
            clientVersion === "2024-11-05" ? "2024-11-05" : MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false }, resources: {} },
          serverInfo: { name: "grapheway", version: GRAPHEWAY_VERSION },
        });
      }
      case "ping":
        return rpcResult(id, {});
      case "tools/list":
        return rpcResult(id, {
          tools: toolsForManifest(deps.manifest, deps.additionalTools ?? []),
        });
      case "tools/call": {
        const name = String(msg.params?.name ?? "");
        const args = (msg.params?.arguments as Record<string, unknown>) ?? {};
        if (GRAPH_TOOLS.some((t) => t.name === name)) {
          return rpcResult(id, {
            content: [
              {
                type: "text",
                text: JSON.stringify(callGraphTool(deps, name, args), null, 2),
              },
            ],
            isError: false,
          });
        }
        if (!isKnownTool(deps, name)) {
          return rpcError(id, -32602, `Unknown tool: ${name}`);
        }
        const result = await deps.runAction(name, args);
        return rpcResult(id, {
          content: [
            {
              type: "text",
              text:
                typeof result === "string" ? result : JSON.stringify(result, null, 2),
            },
          ],
          isError: false,
        });
      }
      case "resources/list":
        return rpcResult(id, {
          resources: deps.graph.nodes.slice(0, 100).map((n) => ({
            uri: `grapheway://node/${encodeURIComponent(n.id)}`,
            name: n.label,
            mimeType: "text/markdown",
          })),
        });
      case "resources/read": {
        if (!deps.readNode) return rpcError(id, -32602, "resources/read not supported");
        const uri = String(msg.params?.uri ?? "");
        const nodeId = decodeURIComponent(uri.replace(/^grapheway:\/\/node\//, ""));
        try {
          const text = await deps.readNode(nodeId);
          return rpcResult(id, { contents: [{ uri, mimeType: "text/markdown", text }] });
        } catch (err) {
          return rpcError(id, -32602, err instanceof Error ? err.message : String(err));
        }
      }
      case "prompts/list":
        return rpcResult(id, { prompts: [] });
      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    return rpcError(id, -32603, err instanceof Error ? err.message : "Internal error");
  }
}

/** Parse an incoming HTTP request body into a JSON-RPC message. */
export function parseMcpBody(body: unknown): unknown {
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body ?? null;
}

/**
 * True when the request is a JSON-RPC notification (no `id`).
 * Notifications get HTTP 202 Accepted with an empty body.
 */
export function isNotification(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null) return false;
  return (raw as JsonRpcRequest).id === undefined;
}

/** Build the `Mcp-Session-Id` response header + generate new sessions. */
export function sessionIdFor(req: AgentRequest): { id: string; isNew: boolean } {
  const incoming = req.headers["mcp-session-id"] ?? req.headers["Mcp-Session-Id"];
  if (typeof incoming === "string" && incoming.length > 0) {
    return { id: incoming, isNew: false };
  }
  return { id: crypto.randomUUID(), isNew: true };
}

/** Build the SSE response body for GET /mcp (streamable HTTP). */
export function buildSseStream(origin: string, sessionId: string): string {
  const endpoint = `${origin}/mcp`;
  const lines = [
    `event: endpoint`,
    `data: ${JSON.stringify({ uri: endpoint, sessionId })}`,
    "",
    "event: keepalive",
    `data: ${JSON.stringify({})}`,
    "",
  ];
  return lines.join("\n");
}
