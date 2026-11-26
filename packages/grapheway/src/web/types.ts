/**
 * Minimal, framework-agnostic HTTP surface for grapheway's server.
 * `handler()` consumes an `AgentRequest` and returns an `AgentResponse`.
 * Adapters (node:http, Express, Hono, ...) translate between these and
 * their native request/response objects — see `adapters.ts`.
 */

export interface AgentRequest {
  method: string;
  /** Full URL path + query, e.g. `/agent?format=json`. */
  url: string;
  headers: Record<string, string | string[] | undefined>;
  /** Parsed JSON body when `content-type: application/json`. */
  body?: unknown;
}

export interface AgentResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  contentType: string;
  /**
   * Optional streaming body (SSE). When present, adapters write chunks as
   * they arrive and keep the connection open (used by /graph/v1/events).
   */   bodyStream?: ClosableAsyncIterable<string>;
 }

/** An async iterable that can also be closed early (e.g. client went away). */
export interface ClosableAsyncIterable<T> extends AsyncIterable<T> {
  close?: () => void;
}


/** A route handler. May be async (actions can await work). */
export type RouteHandler = (req: AgentRequest, ctx: GraphewayContext) => Promise<AgentResponse> | AgentResponse;

export interface GraphewayContext {
  /** Resolved config + generated manifest. */
  manifest: import("grapheway").AgentManifest;
  config: import("grapheway").GraphewayConfig;
  /** Runs a registered or built-in action. */
  runAction: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** Resolves page markdown for llms-full.txt (may be null). */
  getPageMarkdown: (path: string) => Promise<string | null>;
}

/** Result of an authorization check. */
export interface ActionDecision {
  allowed: boolean;
  /** HTTP status to use when denied. Defaults to 403. */
  status?: number;
  /** Human-readable reason returned to the caller. */
  reason?: string;
}

/** Audit record emitted after every action call. */
export interface ActionAuditEvent {
  action: string;
  ok: boolean;
  status: number;
  durationMs: number;
  clientKey?: string;
  error?: string;
  readOnly?: boolean;
  destructive?: boolean;
}

/** Rate limit settings for the whole surface. `false` disables it. */
export interface RateLimitOptions {
  /** Window length in milliseconds. Default 60000. */
  windowMs?: number;
  /** Max requests per key per window. Default 600. */
  max?: number;
  /** Derive the bucket key. Default: first `x-forwarded-for`, then `x-real-ip`, then `local`. */
  key?: (req: AgentRequest) => string;
}

/** Extra knobs accepted by `createGrapheway`. */
export interface GraphewayOptions {
  /**
   * Custom action implementations keyed by action name.
   * Overrides built-in actions with the same name.
   */
  actions?: Record<string, (args: Record<string, unknown>, ctx: ActionCallContext) => unknown | Promise<unknown>>;
  /**
   * Resolves a page's markdown for `llms-full.txt` and the `get_page`
   * action. If omitted, get_page falls back to fetching + converting HTML.
   */
  getPageMarkdown?: (path: string) => string | null | Promise<string | null>;
  /**
   * Custom search implementation for the `search_content` action.
   * Receives the query and the built-in context; return search hits.
   */
  search?: (q: string, ctx: ActionCallContext) => unknown | Promise<unknown>;
  /** Custom path prefix (default `/`). */
  prefix?: string;
  /**
   * Gate every action call. Return `false` (or `{ allowed: false }`) to
   * refuse. Throw to fail with a specific status. Runs before the handler.
   */
  authorize?: (
    action: string,
    args: Record<string, unknown>,
    ctx: ActionCallContext,
  ) => boolean | ActionDecision | Promise<boolean | ActionDecision>;
  /** In-process rate limit for the whole surface. Default 600 req/min per key. */
  rateLimit?: false | RateLimitOptions;
  /** Maximum accepted body size in bytes. Default 1 MiB. */
  maxBodyBytes?: number;
  /** Action execution timeout in milliseconds. Default 10000. `0` disables. */
  actionTimeoutMs?: number;
  /** Max concurrent action executions. Default 0 (unlimited). Over-limit calls return 503. */
  maxConcurrentActions?: number;
  /** Audit hook called after every action. Nothing is stored by default. */
  onAction?: (event: ActionAuditEvent) => void | Promise<void>;
  /**
   * Graph build options: a full custom `builder` (total control) and/or
   * `extra` nodes/edges merged into the config projection (semantic layer).
   */
  graph?: import("grapheway").GraphBuildOptions;
}

/** Context passed to every action implementation. */
export interface ActionCallContext {
  manifest: import("grapheway").AgentManifest;
  config: import("grapheway").GraphewayConfig;
  /** Root-relative path of the request (no query). */
  path: string;
  /** Fetches a page of the site as best-effort markdown. */
  fetchPage: (url: string) => Promise<string>;
  /** Origin of the request, e.g. `https://example.com`. */
  origin: string;
  /** Bucket key for rate limiting and audit records (IP or custom). */
  clientKey?: string;
}
