# grapheway

**Runtime core for Grapheway — the knowledge graph engine for AI agents.**

Zero dependencies. Runs in Node, Bun, Deno, and the browser.

## What it does

Provides the foundational data model and operations that every other Grapheway package builds on:

- **Knowledge graph model** — typed nodes and edges with properties, provenance, and confidence
- **Graph operations** — `createGraph`, `addNode`, `addEdge`, `removeNode`, `removeEdge`
- **Live patching** — `applyPatch` / `applyPatches` with structural validation (no dangling edges, cascade removals)
- **Structural diff** — `diffGraphs` computes the minimal patch set between two graph snapshots
- **Discovery manifest** — agent card format (what, how, where) for `/.well-known/agent`
- **JSON-LD serialization** — Schema.org `Organization`, `WebSite`, `WebPage` for GEO

## Install

```bash
npm install grapheway
# or: bun add grapheway
```

## Quick start

```ts
import { createGraph, addNode, addEdge, applyPatch } from "grapheway";

// Build a graph
let graph = createGraph({
  name: "My Site",
  url: "https://example.com",
  tagline: "An example",
});

graph = addNode(graph, {
  id: "/docs",
  type: "page",
  label: "Documentation",
});

graph = addEdge(graph, {
  id: "home-to-docs",
  source: "/",
  target: "/docs",
  type: "links_to",
});

// Patch it live
const version = applyPatch(graph, {
  type: "add_node",
  node: { id: "/pricing", type: "page", label: "Pricing" },
});

// Diff two snapshots
import { diffGraphs } from "grapheway";
const patches = diffGraphs(oldGraph, newGraph);
```

## API

### Graph construction

```ts
createGraph(manifest: Manifest): KnowledgeGraph
addNode(graph, node): KnowledgeGraph
addEdge(graph, edge): KnowledgeGraph
removeNode(graph, id): KnowledgeGraph
removeEdge(graph, id): KnowledgeGraph
```

### Live patching

```ts
applyPatch(graph, patch): KnowledgeGraph     // single patch, returns new version
applyPatches(graph, patches): KnowledgeGraph  // batch, validated order
diffGraphs(prev, next): GraphPatch[]          // structural diff → minimal patches
```

### Discovery

```ts
createDiscovery(manifest): object             // /.well-known/agent card
createManifest(config): Manifest              // config → manifest
```

### JSON-LD

```ts
injectJsonLd(config): string                  // <script type="application/ld+json">
```

## Graph model

```ts
interface KnowledgeGraph {
  manifest: Manifest;
  nodes: Node[];
  edges: Edge[];
  version: number;
}

interface Node {
  id: string;
  type: "page" | "section" | "api" | "action" | string;
  label: string;
  properties?: Record<string, unknown>;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
  provenance?: "config" | "section" | "link" | "builder" | "derived";
  confidence?: "extracted" | "inferred" | "ambiguous";
  note?: string;
}
```

## License

GPL-3.0
