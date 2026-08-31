# Changelog

All notable changes to Grapheway will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-27

Initial release — the foundation.

### Added

#### Core (`grapheway`)
- Knowledge graph model: typed nodes, typed edges, properties, versioning
- Graph operations: `createGraph`, `addNode`, `addEdge`, `removeNode`, `removeEdge`
- Live patching: `applyPatch` / `applyPatches` with structural validation
- Structural diff: `diffGraphs` computes minimal patch set between snapshots
- Discovery manifest: agent card for `/.well-known/agent`
- JSON-LD serialization: Schema.org `Organization`, `WebSite`, `WebPage`

#### Web Runtime (`grapheway/web`)
- Drop-in agent endpoint: `createGrapheway(config, options)`
- 11 HTTP routes: discovery, graph, node, edges, search, path, graph dump, SSE events, viewer, agent API, MCP
- Framework adapters: `node:http`, Express, Hono
- MCP server: spec-aligned streamable HTTP (`/mcp`)
- Interactive graph viewer: `GET /graph` — self-contained force-layout UI with search, path inspector, realtime SSE, filters
- Live graph updates: `patchGraph()` pushes diffs to SSE subscribers
- GEO injection: `injectHead()` adds JSON-LD + semantic metadata

#### Probe (`grapheway/probe`)
- Website crawling: robots.txt-respecting, same-origin, configurable depth/pages
- Knowledge extraction: navigation, headings, links, content → typed graph nodes
- OpenAPI detection: specs → typed `api` nodes with method, path, summary, tags
- Local serving: full agent surface via `serveProbed` / `createProbeAgent`
- Export: `graph.json` + `config.json` via `exportProbed`
- Provenance: every edge tagged as `extracted` / `inferred` / `ambiguous`

#### Agent SDK (`grapheway/agent`)
- Typed `GraphewayClient`: discovery, graph traversal, search, pathfinding, actions, content
- Realtime subscription: `subscribeGraph()` streams patches to local graph
- Full graph fetch: `getGraph()`
- Agent skill: `SKILL.md` teaches AI agents to use graph endpoints

#### CLI (`grapheway/cli`)
- `grapheway gateway` — server-centric: holds a graph, answers agents over MCP
  - `--probe <url>` — crawl and hold
  - `--config <file>` — config-defined graph
  - `--graph <file>` — pre-exported graph
  - `--refresh <hours>` — re-crawl on schedule, patch live graph
- `grapheway mcp-config` — prints MCP client config for Claude/Cursor/VS Code
- `grapheway probe <url>` — convert any site into a graph
- `grapheway serve` — serve from config
- `grapheway audit <url>` — agent-readiness audit (0–100 score)
- `grapheway generate` — legacy static files (llms.txt, robots.txt, sitemap.xml)

#### Compat (`grapheway/compat`)
- Optional legacy files: `llms.txt`, `agents.txt`, `robots.txt`, `sitemap.xml`
- Decoupled from core runtime

#### Infrastructure
- Monorepo with Bun workspaces
- esbuild-based build pipeline (JS bundles + `.d.ts`)
- GitHub Actions: build-dev (dev branch) + publish (main branch)
- 111 tests across 13 files
- GPL-3.0 license
