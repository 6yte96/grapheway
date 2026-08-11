/**
 * Core type definitions for `grapheway`.
 *
 * Everything in this package is pure data + pure functions:
 * it runs in Node, Bun, Deno, and the browser with zero dependencies.
 */

/** A single link/file listed inside an llms.txt section. */
export interface LlmsTxtItem {
  /** Display title (also used as the link anchor). */
  title: string;
  /** Absolute or root-relative URL of the page. */
  url: string;
  /** Short human note describing what an agent will find there. */
  notes?: string;
}

/** A curated section of site content (llms.txt "file list"). */
export interface Section {
  /** Section heading, rendered as an H2 in llms.txt. */
  title: string;
  /** Where this section lives on the site (optional). */
  url?: string;
  /** Short description of the section's purpose. */
  description?: string;
  /** Markdown-style links to the important pages in this section. */
  items?: LlmsTxtItem[];
  /**
   * llms.txt convention: "Optional" sections may be dropped by agents to
   * conserve context. Defaults to false.
   */
  optional?: boolean;
}

/** A general-purpose link (e.g. social, contact, external). */
export interface SiteLink {
  title: string;
  url: string;
  description?: string;
}

/**
 * A basic action an agent can perform against the site.
 * Actions are exposed both through the HTTP API (`POST /agent/action`)
 * and as MCP tools on the `/mcp` endpoint.
 */
export interface ActionDef {
  /** Stable machine name, e.g. `search_content`. */
  name: string;
  /** Human/agent-readable description of what the action does. */
  description: string;
  /**
   * JSON Schema (subset) describing accepted arguments.
   * `properties` uses a plain object so it serializes cleanly to JSON.
   */
  inputSchema?: {
    type?: string;
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
}

/** Info about the person/team behind the site (agents.txt extension). */
export interface AgentContact {
  name?: string;
  email?: string;
  url?: string;
  /** Preferred protocol for contacting the owner. */
  protocol?: "email" | "url" | "other";
}

/**
 * Everything grapheway needs to describe your site.
 * This is the single source of truth consumed by every generator.
 */
export interface GraphewayConfig {
  /** Site name (used as the llms.txt H1 and Organization name). */
  name: string;
  /** Canonical origin, e.g. `https://example.com`. */
  url: string;
  /** One-line tagline, shown under the H1. */
  tagline?: string;
  /**
   * Markdown description of the site — the first thing agents read.
   * High factual density = better GEO.
   */
  summary?: string;
  /** Contact info for humans/agents (agents.txt). */
  contact?: AgentContact;
  /** Curated content sections shown to agents. */
  sections?: Section[];
  /** General purpose links. */
  links?: SiteLink[];
  /**
   * Basic actions agents can call. Provide implementations in
   * `@grapheway/web`; here we only declare their schemas.
   */
  actions?: ActionDef[];
  /** Key capabilities the site supports (agents.txt). */
  capabilities?: string[];
  /**
   * Robots.txt policy for AI crawlers.
   * - `allowTraining`: allow training crawlers (GPTBot, ClaudeBot, CCBot, ...)
   * - `allowSearch`: allow search/retrieval crawlers (OAI-SearchBot, ...)
   * Defaults: training blocked, search allowed — the safe GEO default.
   */
  robots?: {
    allowTraining?: boolean;
    allowSearch?: boolean;
    /** Extra user-agents to explicitly allow, e.g. `["Bingbot"]`. */
    extraAllow?: string[];
    /** Extra user-agents to explicitly block, e.g. `["Bytespider"]`. */
    extraDisallow?: string[];
  };
  /** Content fetch options used by the server's built-in get_page action. */
  fetcher?: {
    /** Optional headers forwarded when fetching internal pages. */
    headers?: Record<string, string>;
  };
}

/** The generated machine-readable manifest served at `/agent` and `agents.json`. */
export interface AgentManifest {
  /** Manifest spec version. */
  version: string;
  /** When this manifest was generated (ISO 8601). */
  generatedAt: string;
  site: {
    name: string;
    url: string;
    tagline?: string;
    summary?: string;
    contact?: AgentContact;
  };
  /** Absolute URLs of the agent-facing endpoints. */
  endpoints: {
    manifest: string;
    info: string;
    sections: string;
    actions: string;
    action: string;
    llmsTxt: string;
    llmsFullTxt?: string;
    mcp: string;
    robotsTxt: string;
    sitemap: string;
  };
  /** Curated content sections. */
  sections: Section[];
  /** Declared basic actions. */
  actions: ActionDef[];
  /** Machine-actionable capabilities (agents.txt). */
  capabilities: string[];
  /** GEO / agent-readiness fields. */
  geo: {
    llmsTxt: boolean;
    llmsFullTxt: boolean;
    agentsTxt: boolean;
    agentsJson: boolean;
    robotsAiPolicy: boolean;
    jsonLd: boolean;
    semanticHtml: boolean;
  };
  /** Important links. */
  links: SiteLink[];
}

/** Result of a single agent-readiness check. */
export interface AuditCheck {
  id: string;
  label: string;
  /** Whether the check passed. */
  ok: boolean;
  /** Human-readable detail / hint when failing. */
  detail?: string;
  /** Relative weight used for the score (sums to 100). */
  weight: number;
}

/** Full audit outcome. */
export interface AuditResult {
  url: string;
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  checks: AuditCheck[];
  summary: string;
}

/** Current grapheway package version (used in serverInfo + user-agents). */
export const GRAPHEWAY_VERSION = "0.1.0";

export const MANIFEST_VERSION = GRAPHEWAY_VERSION;
