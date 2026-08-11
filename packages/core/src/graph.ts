/**
 * The knowledge-graph model — the core of grapheway's runtime agent surface.
 *
 * A site's content is exposed to agents as a typed graph: pages/sections as
 * nodes, real relations as edges. Agents traverse, search and act on this
 * graph instead of scraping HTML — that is the "native access" promise.
 *
 * The graph is a *view* over user-controlled sources:
 *  1. a full custom `builder` function (total control), or
 *  2. the config projection (sections/items/links → nodes + edges), with
 *  3. optional `extra` nodes/edges merged in (e.g. a semantic layer).
 */

import type { GraphewayConfig } from "./types.ts";

export type GraphNodeType = "page" | "section" | "entity" | "concept";

export interface GraphNode {
  /** Stable identifier — absolute URL for pages/sections, urn: for others. */
  id: string;
  type: GraphNodeType;
  /** Human/agent-readable title. */
  label: string;
  /** Optional metadata (description, notes, tags…). */
  props?: Record<string, unknown>;
}

export type GraphEdgeType = "links_to" | "is_part_of" | "related" | "mentions";

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  props?: Record<string, unknown>;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphBuildOptions {
  /** Full custom builder — total control; replaces the config projection. */
  builder?: (config: GraphewayConfig) => KnowledgeGraph;
  /** Extra nodes/edges merged into the projected graph (e.g. semantic layer). */
  extra?: KnowledgeGraph;
}

export const EMPTY_GRAPH: KnowledgeGraph = { nodes: [], edges: [] };

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

/** Deterministic id for a section that has no URL of its own. */
export function sectionId(config: GraphewayConfig, title: string, index: number): string {
  return `${config.url.replace(/\/+$/, "")}#section-${slugify(title)}-${index}`;
}

/**
 * Resolve a possibly root-relative URL to its absolute href, normalized to
 * a single canonical form (no trailing slash) so `/`, `/index`-style paths
 * and the site root dedupe to the same node id.
 */
export function resolveUrl(config: GraphewayConfig, url: string): string {
  return new URL(url, config.url).href.replace(/\/+$/, "");
}

/**
 * Project a config into a structural knowledge graph:
 *  - site root → a `page` node
 *  - each section → a `section` node; its items → `page` nodes with
 *    `is_part_of` edges to the section
 *  - same-origin `links` and `section.url` → `links_to` edges from root
 * Cross-origin URLs are never added — the graph lists this site only.
 */
export function projectGraph(config: GraphewayConfig): KnowledgeGraph {
  const siteOrigin = new URL(config.url).origin;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  let edgeSeq = 0;

  const addNode = (n: GraphNode) => {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      nodes.push(n);
    }
  };
  const addEdge = (e: Omit<GraphEdge, "id">) => edges.push({ id: `e${edgeSeq++}`, ...e });

  const rootId = resolveUrl(config, "/");
  addNode({
    id: rootId,
    type: "page",
    label: config.name,
    props: { tagline: config.tagline, summary: config.summary },
  });

  (config.sections ?? []).forEach((section, i) => {
    const sectionNodeId = section.url
      ? resolveUrl(config, section.url)
      : sectionId(config, section.title, i);
    addNode({
      id: sectionNodeId,
      type: "section",
      label: section.title,
      props: { description: section.description, optional: section.optional },
    });
    // Every section is reachable from the root (even without a URL of its own).
    addEdge({ source: rootId, target: sectionNodeId, type: "links_to" });

    for (const item of section.items ?? []) {
      const u = new URL(item.url, config.url);
      if (u.origin !== siteOrigin) continue;
      const id = resolveUrl(config, item.url);
      addNode({ id, type: "page", label: item.title, props: { notes: item.notes } });
      addEdge({ source: sectionNodeId, target: id, type: "is_part_of" });
    }
  });

  for (const link of config.links ?? []) {
    const u = new URL(link.url, config.url);
    if (u.origin !== siteOrigin) continue;
    const id = resolveUrl(config, link.url);
    addNode({ id, type: "page", label: link.title, props: { description: link.description } });
    addEdge({ source: rootId, target: id, type: "links_to" });
  }

  return { nodes, edges };
}

/** Build the site's knowledge graph. Custom builder wins; extras merge. */
export function buildGraph(config: GraphewayConfig, options: GraphBuildOptions = {}): KnowledgeGraph {
  const base = options.builder ? options.builder(config) : projectGraph(config);
  const extra = options.extra;
  if (!extra) return base;
  return {
    nodes: [...base.nodes, ...extra.nodes.filter((n) => !base.nodes.some((b) => b.id === n.id))],
    edges: [...base.edges, ...extra.edges],
  };
}
