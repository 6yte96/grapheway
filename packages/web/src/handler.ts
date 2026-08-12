/**
 * `createGrapheway` — the universal runtime agent endpoint.
 *
 * Serves, from one handler (framework-agnostic — wrap with the adapters):
 *   GET  /.well-known/agent    discovery: how agents find this surface
 *   GET  /graph/v1             graph summary
 *   GET  /graph/v1/node        a node (page/section) of the site graph
 *   GET  /graph/v1/edges       edges touching a node (links, relations)
 *   GET  /graph/v1/search      ranked node search over the graph
 *   GET  /graph/v1/path        shortest path between two nodes
 *   GET  /agent                full manifest (JSON)
 *   GET  /agent/info           site info
 *   GET  /agent/sections       curated sections
 *   GET  /agent/actions        declared actions
 *   POST /agent/action         run a basic action {name, arguments}
 *   POST /mcp                  Model Context Protocol (streamable HTTP)
 *   GET  /mcp                  MCP SSE endpoint announcement
 *
 * Legacy static files (llms.txt, robots.txt, sitemap.xml, …) are NOT served
 * here — mount `compatHandler` from `@grapheway/compat` alongside if you want
 * them. The core never depends on them.
 */

import {
  applyPatches,
  buildDiscovery,
  buildGraph,
  buildManifest,
  findNode,
  findPathWithEdges,
  neighborsOf,
  searchNodes,
  type GraphewayConfig,
  type GraphBuildOptions,
  type GraphEdgeType,
  type GraphPatch,
  type KnowledgeGraph,
} from "grapheway";
import { createActionRunner } from "./actions.ts";
import {
  buildSseStream,
  handleMcpMessage,
  isNotification,
  parseMcpBody,
  sessionIdFor,
  MCP_PROTOCOL_VERSION,
} from "./mcp.ts";
import type {
  GraphewayOptions,
  AgentResponse,
  AgentRequest,
  RouteHandler,
  ClosableAsyncIterable,
} from "./types.ts";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, mcp-session-id, authorization",
  "access-control-expose-headers": "mcp-session-id",
  "cache-control": "no-store",
};

function respond(status: number, body: string, contentType: string, extra: Record<string, string> = {}): AgentResponse {
  return { status, body, contentType, headers: { ...CORS_HEADERS, ...extra } };
}

function json(status: number, data: unknown, extra: Record<string, string> = {}): AgentResponse {
  return respond(status, JSON.stringify(data, null, 2), "application/json", extra);
}

function text(status: number, body: string, extra: Record<string, string> = {}): AgentResponse {
  return respond(status, body, "text/plain; charset=utf-8", extra);
}

/** Format one SSE event (event name + JSON data). */
function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** A tiny push-based async channel that adapters drain as a body stream. */
function createPushChannel() {
  const queue: string[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  return {
    push(data: string) {
      queue.push(data);
      wake?.();
    },
    close() {
      closed = true;
      wake?.();
    },
    async *[Symbol.asyncIterator](): AsyncGenerator<string> {
      while (true) {
        while (queue.length) yield queue.shift()!;
        if (closed) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    },
  };
}

/** Create the framework-agnostic runtime agent handler. */
export function createGrapheway(config: GraphewayConfig, options: GraphewayOptions = {}) {
  const manifest = buildManifest(config);

  // The live graph: starts from the config projection, then apps can push
  // GraphPatches at runtime (`patchGraph`). Subscribers (SSE, MCP, agents)
  // receive every change — the realtime half of native access.
  let liveGraph: KnowledgeGraph = buildGraph(config, options.graph);
  let graphVersion = 0;
  const graphListeners = new Set<(payload: { version: number; patches: GraphPatch[] }) => void>();
  const subscribeGraph = (listener: (payload: { version: number; patches: GraphPatch[] }) => void) => {
    graphListeners.add(listener);
    return () => graphListeners.delete(listener);
  };

  const prefix = (options.prefix ?? "/").replace(/\/+$/, "");

  const getPageMarkdown = async (path: string): Promise<string | null> =>
    options.getPageMarkdown ? await options.getPageMarkdown(path) : null;

  const runner = createActionRunner({
    manifest,
    config,
    options,
    origin: config.url,
    path: "/",
  });

  // Actions registered at runtime (not declared in config) still need to be
  // discoverable + callable over MCP, so they become additional tools.
  const additionalTools = Object.keys(options.actions ?? {})
    .filter((name) => !manifest.actions.some((a) => a.name === name))
    .map((name) => ({
      name,
      description: `Custom action registered at runtime: ${name}`,
      inputSchema: { type: "object", properties: {} },
    }));

  /** Root-relative path of a node, or null when it has no distinct page. */
  const nodePath = (node: { id: string; type: string }): string | null => {
    if (node.type === "entity" || node.type === "concept") return null;
    let u: URL;
    try {
      u = new URL(node.id, config.url);
    } catch {
      return null;
    }
    const path = `${u.pathname}${u.search}`;
    if (path === "" || path === "/") return null; // no distinct page (e.g. urn section ids)
    return path;
  };

  /** Resolve a node id to markdown for MCP resources/read. */
  const readNode = async (id: string): Promise<string> => {
    const node = findNode(liveGraph, id);
    if (!node) throw new Error(`Unknown node: ${id}`);
    const path = nodePath(node);
    if (path) {
      const md = await getPageMarkdown(path);
      if (md) return md;
      // SSRF-guarded: fetchPage only allows the site's own origin.
      return await runner.ctx.fetchPage(path);
    }
    return `# ${node.label}\n\n${JSON.stringify(node.props ?? {}, null, 2)}`;
  };

  /** Resolve the origin from the request (for absolute URLs). */
  function originFor(req: AgentRequest): string {
    const forwarded = req.headers["x-forwarded-proto"];
    const host = req.headers["host"] ?? new URL(config.url).host;
    const proto = Array.isArray(forwarded) ? forwarded[0] : (forwarded ?? new URL(config.url).protocol.replace(":", ""));
    return `${proto}://${Array.isArray(host) ? host[0] : host}`;
  }

  const routes: Array<{ match: (path: string, method: string) => boolean; handler: RouteHandler }> = [
    // ---- Graph protocol (/graph/v1) ----
    {
      match: (p, m) => p === "/graph/v1" && m === "GET",
      handler: () => {
        const provenance: Record<string, number> = {};
        const confidence: Record<string, number> = {};
        for (const e of liveGraph.edges) {
          provenance[e.provenance ?? "unknown"] = (provenance[e.provenance ?? "unknown"] ?? 0) + 1;
          confidence[e.confidence ?? "unknown"] = (confidence[e.confidence ?? "unknown"] ?? 0) + 1;
        }
        return json(200, {
          version: graphVersion,
          nodes: liveGraph.nodes.length,
          edges: liveGraph.edges.length,
          nodeTypes: [...new Set(liveGraph.nodes.map((n) => n.type))].sort(),
          edgeTypes: [...new Set(liveGraph.edges.map((e) => e.type))].sort(),
          provenance,
          confidence,
          endpoints: {
            node: "/graph/v1/node?id=<node-id>",
            edges: "/graph/v1/edges?id=<node-id>&direction=out|in|both",
            search: "/graph/v1/search?q=<query>",
            path: "/graph/v1/path?from=<id>&to=<id>",
            events: "/graph/v1/events",
          },
        });
      },
    },
    {
      match: (p, m) => p === "/graph/v1/node" && m === "GET",
      handler: (req) => {
        const id = new URL(req.url, "http://localhost").searchParams.get("id") ?? "";
        const node = findNode(liveGraph, id);
        if (!node) return json(404, { error: "Unknown node", id });
        return json(200, node);
      },
    },
    {
      match: (p, m) => p === "/graph/v1/edges" && m === "GET",
      handler: (req) => {
        const sp = new URL(req.url, "http://localhost").searchParams;
        const id = sp.get("id") ?? "";
        const dir = sp.get("direction")?.toLowerCase();
        const direction = dir === "in" || dir === "out" ? dir : "both";
        const type = (sp.get("type") ?? undefined) as GraphEdgeType | undefined;
        return json(200, neighborsOf(liveGraph, id, direction, type));
      },
    },
    {
      match: (p, m) => p === "/graph/v1/search" && m === "GET",
      handler: (req) => {
        const sp = new URL(req.url, "http://localhost").searchParams;
        const q = sp.get("q") ?? "";
        const limit = Number(sp.get("limit") ?? 10);
        return json(200, { query: q, results: searchNodes(liveGraph, q, Number.isFinite(limit) ? limit : 10) });
      },
    },
    {
      match: (p, m) => p === "/graph/v1/path" && m === "GET",
      handler: (req) => {
        const sp = new URL(req.url, "http://localhost").searchParams;
        const from = sp.get("from") ?? "";
        const to = sp.get("to") ?? "";
        const result = findPathWithEdges(liveGraph, from, to);
        if (!result) return json(404, { error: "No path between nodes", from, to });
        return json(200, { from, to, path: result.path, edges: result.edges });
      },
    },
    {
      // Realtime graph subscription (SSE): snapshot + every applied patch.
      match: (p, m) => p === "/graph/v1/events" && m === "GET",
      handler: () => ({
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
          connection: "keep-alive",
        },
        body: "",
        contentType: "text/event-stream; charset=utf-8",
        bodyStream: graphEventStream(),
      }),
    },

    // ---- Discovery ----
    {
      match: (p) => p === "/.well-known/agent",
      handler: () => json(200, buildDiscovery(config, liveGraph)),
    },

    // ---- Manifest + actions (runtime) ----
    {
      match: (p) => p === "/agent",
      handler: () => json(200, manifest),
    },
    {
      match: (p) => p === "/agent/info",
      handler: () => json(200, manifest.site),
    },
    {
      match: (p) => p === "/agent/sections",
      handler: () => json(200, manifest.sections),
    },
    {
      match: (p) => p === "/agent/actions",
      handler: () => json(200, manifest.actions),
    },
    {
      match: (p, m) => p === "/agent/action" && m === "POST",
      handler: async (req) => {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const name = String(body.name ?? body.action ?? "");
        const args = (body.arguments ?? body.args ?? {}) as Record<string, unknown>;
        if (!name) return json(400, { error: "Missing action `name`." });
        try {
          const result = await runner.runAction(name, args);
          return json(200, { action: name, ok: true, result });
        } catch (err) {
          return json(400, {
            action: name,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    },

    // ---- MCP ----
    {
      match: (p) => p === "/mcp",
      handler: async (req) => {
        if (req.method === "GET") {
          const origin = originFor(req);
          const session = sessionIdFor(req);
          return respond(
            200,
            buildSseStream(origin, session.id),
            "text/event-stream; charset=utf-8",
            { "mcp-session-id": session.id },
          );
        }
        if (req.method !== "POST") {
          return respond(405, "Method Not Allowed", "text/plain");
        }
        const session = sessionIdFor(req);
        const raw = parseMcpBody(req.body);
        if (isNotification(raw)) {
          return respond(202, "", "text/plain", { "mcp-session-id": session.id });
        }
        const response = await handleMcpMessage(raw, {
          manifest,
          runAction: runner.runAction,
          additionalTools,
          graph: liveGraph,
          readNode,
        });
        if (response === null) {
          return respond(202, "", "text/plain", { "mcp-session-id": session.id });
        }
        return json(200, response, {
          "mcp-session-id": session.id,
          "mcp-protocol-version": MCP_PROTOCOL_VERSION,
        });
      },
    },
  ];

  /** Live SSE stream of graph changes (snapshot + patches + heartbeat). */
  function graphEventStream(): ClosableAsyncIterable<string> {
    const channel = createPushChannel();
    const unsubscribe = subscribeGraph((payload) => channel.push(sse("graph", payload)));
    const heartbeat = setInterval(() => channel.push(": ping\n\n"), 15_000);
    channel.push(
      sse("graph", {
        type: "snapshot",
        version: graphVersion,
        nodes: liveGraph.nodes.length,
        edges: liveGraph.edges.length,
      }),
    );
    return {
      /** Close the stream early (e.g. client disconnected). */
      close: () => channel.close(),
      async *[Symbol.asyncIterator]() {
        try {
          yield* channel;
        } finally {
          clearInterval(heartbeat);
          unsubscribe();
          channel.close();
        }
      },
    };
  }

  return {
    /** The framework-agnostic handler. */
    async handler(req: AgentRequest): Promise<AgentResponse> {
      // OPTIONS preflight (CORS).
      if (req.method === "OPTIONS") {
        return { status: 204, headers: CORS_HEADERS, body: "", contentType: "text/plain" };
      }

      let path: string;
      try {
        path = new URL(req.url, "http://localhost").pathname;
      } catch {
        path = req.url.split("?")[0] ?? "/";
      }
      const clean = prefix === "" ? path : path.startsWith(prefix) ? path.slice(prefix.length) || "/" : null;
      if (clean === null) {
        return text(404, `Not found: ${path}`);
      }

      for (const route of routes) {
        if (route.match(clean, req.method)) {
          const res = await route.handler(req, {
            manifest,
            config,
            runAction: runner.runAction,
            getPageMarkdown,
          });
          return res;
        }
      }

      return json(404, { error: "Not found", path, hint: "See /.well-known/agent for the agent surface." });
    },

    /** The generated manifest (same as GET /agent). */
    manifest,

    /**
     * The site's live knowledge graph (same data served at /graph/v1).
     * Re-read after calling `patchGraph` to see the new state.
     */
    get graph(): KnowledgeGraph {
      return liveGraph;
    },

    /** Current graph version — increments on every patch. */
    get version(): number {
      return graphVersion;
    },

    /**
     * Push graph changes at runtime. Subscribers (SSE /graph/v1/events,
     * MCP clients, agents) receive the patches immediately.
     * Returns the new graph version.
     *
     *   agent.patchGraph([
     *     { type: "add_node", node: { id: "https://…/solar", type: "page", label: "Solar Hub" } },
     *     { type: "add_edge", edge: { id: "e-live", source: "https://…", target: "https://…/solar", type: "links_to" } },
     *   ]);
     */
    patchGraph(patches: GraphPatch | GraphPatch[]): number {
      const list = Array.isArray(patches) ? patches : [patches];
      liveGraph = applyPatches(liveGraph, list);
      graphVersion += 1;
      const payload = { version: graphVersion, patches: list };
      for (const listener of [...graphListeners]) listener(payload);
      return graphVersion;
    },
  };
}

export type { AgentResponse, AgentRequest, GraphewayOptions };
