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
export declare const EMPTY_GRAPH: KnowledgeGraph;
/** Deterministic id for a section that has no URL of its own. */
export declare function sectionId(config: GraphewayConfig, title: string, index: number): string;
/**
 * Resolve a possibly root-relative URL to its absolute href, normalized to
 * a single canonical form (no trailing slash) so `/`, `/index`-style paths
 * and the site root dedupe to the same node id.
 */
export declare function resolveUrl(config: GraphewayConfig, url: string): string;
/**
 * Project a config into a structural knowledge graph:
 *  - site root → a `page` node
 *  - each section → a `section` node; its items → `page` nodes with
 *    `is_part_of` edges to the section
 *  - same-origin `links` and `section.url` → `links_to` edges from root
 * Cross-origin URLs are never added — the graph lists this site only.
 */
export declare function projectGraph(config: GraphewayConfig): KnowledgeGraph;
/** Build the site's knowledge graph. Custom builder wins; extras merge. */
export declare function buildGraph(config: GraphewayConfig, options?: GraphBuildOptions): KnowledgeGraph;
//# sourceMappingURL=graph.d.ts.map