/**
 * `GraphewayClient` — the agent-side client.
 *
 * Point it at any site that runs `@grapheway/web` (or serves the
 * standard files) and you can fetch its manifest, curated sections and
 * call its basic actions — the same surface MCP exposes, but as plain
 * typed methods over fetch.
 *
 * Works in Node 18+, Bun, Deno, and browsers.
 */

import {
  GRAPHEWAY_VERSION,
  type AgentManifest,
  type GraphewayConfig,
  type DiscoveryDoc,
  type GraphEdge,
  type GraphNode,
  type KnowledgeGraph,
  type Section,
} from "grapheway";

export interface AgentActionResult {
  action: string;
  ok: boolean;
  result: unknown;
  error?: string;
}

export class GraphewayClient {
  /** Origin of the target site, e.g. `https://example.com`. */
  readonly origin: string;
  private _manifest?: AgentManifest;

  constructor(baseUrl: string) {
    this.origin = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T>;
  private async request<T>(path: string, init: RequestInit | undefined, notFoundOk: true): Promise<T | null>;
  private async request<T>(path: string, init?: RequestInit, notFoundOk = false): Promise<T | null> {
    const res = await fetch(`${this.origin}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        "user-agent": `grapheway-agent/${GRAPHEWAY_VERSION}`,
        ...(init?.headers ?? {}),
      },
    });
    if (notFoundOk && res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`grapheway: ${res.status} ${res.statusText} for ${path}`);
    }
    return (await res.json()) as T;
  }

  /** Like `request`, but returns `null` on 404 (used by optional lookups). */
  private async requestOrNull<T>(path: string): Promise<T | null> {
    return this.request<T>(path, undefined, true);
  }

  /** Fetch + cache the site's agent manifest (`GET /agent`). */
  async getManifest(force = false): Promise<AgentManifest> {
    if (!this._manifest || force) {
      this._manifest = await this.request<AgentManifest>("/agent");
    }
    return this._manifest;
  }

  /** Site info object (`GET /agent/info`). */
  async getInfo(): Promise<AgentManifest["site"]> {
    return this.request<AgentManifest["site"]>("/agent/info");
  }

  /** Curated sections (`GET /agent/sections`). */
  async getSections(): Promise<Section[]> {
    return this.request<Section[]>("/agent/sections");
  }

  /** Declared actions (`GET /agent/actions`). */
  async getActions(): Promise<AgentManifest["actions"]> {
    return this.request<AgentManifest["actions"]>("/agent/actions");
  }

  /** The llms.txt markdown index (`GET /llms.txt`). */
  async getLlmsTxt(): Promise<string> {
    const res = await fetch(`${this.origin}/llms.txt`);
    if (!res.ok) throw new Error(`grapheway: no /llms.txt (HTTP ${res.status})`);
    return res.text();
  }

  /** Call a basic action (`POST /agent/action`). */
  async callAction(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const res = await this.request<AgentActionResult>("/agent/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, arguments: args }),
    });
    if (!res.ok) throw new Error(`grapheway: action "${name}" failed: ${res.error ?? "unknown"}`);
    return res.result;
  }

  /** Convenience wrapper around `callAction`. */
  async getSiteInfo(): Promise<AgentManifest["site"]> {
    return (await this.callAction("get_site_info")) as AgentManifest["site"];
  }

  /** Convenience wrapper around `callAction`. */
  async getPage(urlOrSection: string): Promise<string> {
    const result = (await this.callAction("get_page", {
      url: urlOrSection.startsWith("/") || urlOrSection.includes("://") ? urlOrSection : undefined,
      section: urlOrSection.startsWith("/") || urlOrSection.includes("://") ? undefined : urlOrSection,
    })) as string | { markdown?: string; error?: string };
    if (typeof result === "string") return result;
    if (result.markdown) return result.markdown;
    throw new Error(`grapheway: get_page failed: ${result.error ?? "unknown"}`);
  }

  /** Convenience wrapper around `callAction`. */
  async search(q: string): Promise<unknown> {
    return this.callAction("search_content", { q });
  }

  /** True if the site looks grapheway-enabled (has /agent). */
  async isAgentReady(): Promise<boolean> {
    try {
      await this.getManifest();
      return true;
    } catch {
      return false;
    }
  }

  // ---- Graph traversal (the native-access surface) ----

  /** The discovery card (`GET /.well-known/agent`). */
  async getDiscovery(): Promise<DiscoveryDoc> {
    return this.request<DiscoveryDoc>("/.well-known/agent");
  }

  /** Graph summary (`GET /graph/v1`). */
  async graphSummary(): Promise<GraphSummary> {
    return this.request<GraphSummary>("/graph/v1");
  }

  /** A single graph node by id (`GET /graph/v1/node`), or null if absent. */
  async graphNode(id: string): Promise<GraphNode | null> {
    return this.requestOrNull<GraphNode>(`/graph/v1/node?id=${encodeURIComponent(id)}`);
  }

  /** Edges touching a node (`GET /graph/v1/edges`). */
  async graphEdges(
    id: string,
    direction: "out" | "in" | "both" = "both",
    type?: string,
  ): Promise<NeighborsResult> {
    const params = new URLSearchParams({ id, direction });
    if (type) params.set("type", type);
    return this.request<NeighborsResult>(`/graph/v1/edges?${params}`);
  }

  /** Ranked node search (`GET /graph/v1/search`). */
  async graphSearch(q: string, limit = 10): Promise<SearchResult> {
    return this.request<SearchResult>(`/graph/v1/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  }

  /**
   * Shortest path between two nodes with its edges (`GET /graph/v1/path`),
   * or null. Every hop carries the edge that connects it — the auditable
   * path: type, label, provenance and confidence of each relationship.
   */
  async graphPath(from: string, to: string): Promise<PathResult | null> {
    const res = await this.requestOrNull<PathResult>(
      `/graph/v1/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    if (!res) return null;
    return { path: res.path, edges: res.edges ?? [] };
  }

  /**
   * Subscribe to the site's graph updates over SSE (`GET /graph/v1/events`).
   * The callback fires with a snapshot first, then a `graph` event on every
   * patch the site applies. Returns an unsubscribe function.
   */
  async subscribeGraph(
    onEvent: (event: GraphEvent) => void,
    opts: { signal?: AbortSignal } = {},
  ): Promise<() => void> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onAbort, { once: true });

    const res = await fetch(`${this.origin}/graph/v1/events`, {
      headers: {
        accept: "text/event-stream",
        "user-agent": `grapheway-agent/${GRAPHEWAY_VERSION}`,
      },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      throw new Error(`grapheway: graph events unavailable (HTTP ${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    void (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const eventLine = raw.split("\n").find((l) => l.startsWith("event: "));
            const dataLine = raw.split("\n").find((l) => l.startsWith("data: "));
            if (!dataLine) continue;
            let data: unknown;
            try {
              data = JSON.parse(dataLine.slice(6).trim());
            } catch {
              continue;
            }
            onEvent({ event: eventLine ? eventLine.slice(7).trim() : "message", data });
          }
        }
      } catch {
        // Aborted (unsubscribe) or connection closed — normal teardown.
      } finally {
        opts.signal?.removeEventListener("abort", onAbort);
        try {
          await reader.cancel();
        } catch {
          // already closed
        }
      }
    })();

    return () => controller.abort();
  }

  /**
   * Walk the site graph up to `maxDepth` hops from `startId` — the native
   * replacement for crawling: follow edges instead of scraping HTML.
   */
  async traverse(
    startId: string,
    maxDepth = 2,
    type?: string,
    maxNodes = 100,
  ): Promise<KnowledgeGraph> {
    const visited = new Set<string>([startId]);
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const start = await this.graphNode(startId);
    if (start) {
      nodes.push(start);
      nodeIds.add(start.id);
    }
    let frontier = [startId];
    for (let depth = 0; depth < maxDepth && frontier.length > 0 && nodes.length < maxNodes; depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        if (nodes.length >= maxNodes) break;
        const res = await this.graphEdges(id, "both", type);
        for (const e of res.edges) {
          if (!edgeIds.has(e.id)) {
            edgeIds.add(e.id);
            edges.push(e);
          }
          const other = e.source === id ? e.target : e.source;
          if (!visited.has(other)) {
            visited.add(other);
            if (nodeIds.size < maxNodes) {
              const node = await this.graphNode(other);
              if (node) {
                nodes.push(node);
                nodeIds.add(node.id);
              }
            }
            next.push(other);
          }
        }
      }
      frontier = next;
    }
    return { nodes, edges };
  }
}

/** Response of `GET /graph/v1`. */
export interface GraphSummary {
  version?: number;
  nodes: number;
  edges: number;
  nodeTypes: string[];
  edgeTypes: string[];
  /** Edge-count breakdown by provenance (config/section/link/builder/extra/derived). */
  provenance?: Record<string, number>;
  /** Edge-count breakdown by confidence (extracted/inferred/ambiguous). */
  confidence?: Record<string, number>;
  endpoints?: Record<string, string>;
}

/** Response of `GET /graph/v1/path`: node ids + the edges behind each hop. */
export interface PathResult {
  path: string[];
  edges: GraphEdge[];
}

/** An event delivered by `subscribeGraph` (SSE /graph/v1/events). */
export interface GraphEvent {
  event: string;
  data: unknown;
}

/** A graph subscription event carrying `{ version, patches }`. */
export interface GraphUpdateEvent extends GraphEvent {
  data: { version: number; patches: Array<{ type: string; [k: string]: unknown }> };
}

/** Response of `GET /graph/v1/edges`. */
export interface NeighborsResult {
  edges: GraphEdge[];
  nodes: GraphNode[];
}

/** Response of `GET /graph/v1/search`. */
export interface SearchResult {
  query: string;
  results: Array<{ node: GraphNode; score: number }>;
}

/** Probe a site and return a short human-readable report. */
export async function probeSite(baseUrl: string): Promise<Record<string, unknown>> {
  const client = new GraphewayClient(baseUrl);
  const report: Record<string, unknown> = { url: baseUrl };
  try {
    const manifest = await client.getManifest();
    report["agent"] = {
      site: manifest.site.name,
      actions: manifest.actions.map((a) => a.name),
      mcp: manifest.endpoints.mcp,
      sections: manifest.sections.length,
    };
  } catch (err) {
    report["agent"] = { error: err instanceof Error ? err.message : String(err) };
  }
  try {
    report["llms.txt"] = (await client.getLlmsTxt()).slice(0, 120) + "…";
  } catch (err) {
    report["llms.txt"] = { error: err instanceof Error ? err.message : String(err) };
  }
  return report;
}
