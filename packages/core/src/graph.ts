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

export type GraphNodeType = "page" | "section" | "entity" | "concept" | "api";

export interface GraphNode {
  /** Stable identifier — absolute URL for pages/sections, urn: for others. */
  id: string;
  type: GraphNodeType;
  /** Human/agent-readable title. */
  label: string;
  /** Optional metadata (description, notes, tags…). */
  props?: Record<string, unknown>;
}

export type GraphEdgeType = "links_to" | "is_part_of" | "related" | "mentions" | "exposes";

/**
 * Where an edge came from — the audit trail for the graph.
 *
 * - `config`   — declared directly in the site config (sections/links)
 * - `section`  — a curated item listed under a section
 * - `link`     — a standalone link declared in the config
 * - `builder`  — produced by a custom `builder` function
 * - `extra`    — merged in via the `extra` layer
 * - `derived`  — inferred at runtime (e.g. discovered by the site itself)
 */
export type EdgeProvenance = "config" | "section" | "link" | "builder" | "extra" | "derived";

/**
 * How confident we are in a relationship (Graphify-style provenance).
 *
 * - `extracted` — explicitly declared: the relationship exists in the source
 * - `inferred`  — reasoned/derived: usually right, worth verifying
 * - `ambiguous` — evidence points more than one way
 */
export type EdgeConfidence = "extracted" | "inferred" | "ambiguous";

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  /** Optional human/agent-readable text for the relationship (e.g. link text). */
  label?: string;
  props?: Record<string, unknown>;
  /** Where this edge came from (audit trail). */
  provenance?: EdgeProvenance;
  /** How confident we are in the relationship. */
  confidence?: EdgeConfidence;
  /** One-line human/agent-readable explanation of the relationship. */
  note?: string;
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
    addEdge({
      source: rootId,
      target: sectionNodeId,
      type: "links_to",
      provenance: "config",
      confidence: "extracted",
      note: `Section "${section.title}" declared in the site config`,
    });

    for (const item of section.items ?? []) {
      const u = new URL(item.url, config.url);
      if (u.origin !== siteOrigin) continue;
      const id = resolveUrl(config, item.url);
      addNode({ id, type: "page", label: item.title, props: { notes: item.notes } });
      addEdge({
        source: sectionNodeId,
        target: id,
        type: "is_part_of",
        provenance: "section",
        confidence: "extracted",
        note: `Curated item under section "${section.title}"`,
      });
    }
  });

  for (const link of config.links ?? []) {
    const u = new URL(link.url, config.url);
    if (u.origin !== siteOrigin) continue;
    const id = resolveUrl(config, link.url);
    addNode({ id, type: "page", label: link.title, props: { description: link.description } });
    addEdge({
      source: rootId,
      target: id,
      type: "links_to",
      provenance: "link",
      confidence: "extracted",
      note: `Link "${link.title}" declared in the site config`,
    });
  }

  return { nodes, edges };
}

/** Default provenance for edges coming out of the custom layers. */
const LAYER_PROVENANCE: Record<"builder" | "extra", Pick<GraphEdge, "provenance" | "confidence">> = {
  builder: { provenance: "builder", confidence: "extracted" },
  extra: { provenance: "extra", confidence: "extracted" },
};

/** Tag every edge of a layer with default provenance (author's own wins). */
function tagLayer(
  graph: KnowledgeGraph,
  layer: "builder" | "extra",
): KnowledgeGraph {
  return { ...graph, edges: graph.edges.map((e) => ({ ...LAYER_PROVENANCE[layer], ...e })) };
}

/** Build the site's knowledge graph. Custom builder wins; extras merge. */
export function buildGraph(config: GraphewayConfig, options: GraphBuildOptions = {}): KnowledgeGraph {
  const projected = options.builder ? options.builder(config) : projectGraph(config);
  const base = options.builder ? tagLayer(projected, "builder") : projected;
  const extra = options.extra;
  if (!extra) return base;
  return {
    nodes: [...base.nodes, ...extra.nodes.filter((n) => !base.nodes.some((b) => b.id === n.id))],
    edges: [...base.edges, ...tagLayer(extra, "extra").edges],
  };
}
