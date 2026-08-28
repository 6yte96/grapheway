# @grapheway/probe

**Convert any website into an agent-native knowledge graph — no site involvement, no paid crawlers.**

Point it at any URL. It crawls the site, extracts its content into a tagged graph, and serves it through the same runtime surface agents already know.

## What it does

1. **Crawls** any website (robots.txt-respecting, same-origin, configurable depth/pages)
2. **Extracts** knowledge: navigation, headings, links, content → typed graph nodes
3. **Detects** OpenAPI specs → typed `api` nodes with method, path, summary, tags
4. **Serves** the full agent surface locally (discovery, graph, MCP, actions)
5. **Exports** `graph.json` + `config.json` for static use

Every edge carries **provenance** (`extracted` / `inferred` / `ambiguous`) so agents know how much to trust each link.

## Install

```bash
npm install @grapheway/probe
# or: bun add @grapheway/probe
```

## Quick start

```bash
# Crawl a site and serve it as a full agent surface
bunx grapheway probe https://expressjs.com

# Export the graph instead of serving
bunx grapheway probe https://expressjs.com --no-serve --out ./express-graph
```

From code:

```ts
import { probeSite, serveProbed, exportProbed } from "@grapheway/probe";

// Crawl
const result = await probeSite("https://legacy-docs.example", {
  maxPages: 50,
  maxDepth: 3,
});
console.log(result.graph.nodes.length, "nodes");

// Serve locally (full agent surface on :4321)
const server = await serveProbed("https://legacy-docs.example");

// Export for static use
await exportProbed(result, { outDir: "./graph" });
```

## CLI flags

| Flag | Default | Description |
|---|---|---|
| `--port` | 4321 | Server port |
| `--depth` | 3 | Max link depth |
| `--max-pages` | 50 | Max pages to crawl |
| `--no-serve` | false | Export only, don't start server |
| `--out` | ./graph | Export directory |

## What the graph looks like

```
Probed Express.js (https://expressjs.com)
  pages:    25
  headings: 521
  edges:    1927  (1361 extracted, 566 inferred)
  api:      12 endpoints (https://expressjs.com/openapi.json)

Serving "Express.js" as an agent surface:
  discovery    http://localhost:4321/.well-known/agent
  graph        http://localhost:4321/graph/v1
  MCP          http://localhost:4321/mcp
  viewer       http://localhost:4321/graph
```

## Provenance model

| Confidence | Meaning |
|---|---|
| `extracted` | Read directly from a page's navigation or links |
| `inferred` | Computed from context (e.g. a link in a section) |
| `ambiguous` | Best-effort — worth verifying |

## API

```ts
probeSite(url, options): Promise<ProbeResult>
serveProbed(url, options?): Promise<{ server, port, graph }>
exportProbed(result, options): Promise<void>
createProbeAgent(origin, result): ProbeAgent
```

## License

GPL-3.0
