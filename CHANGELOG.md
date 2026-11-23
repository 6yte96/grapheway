# Changelog

All notable changes to Grapheway will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.5] - 2026-11-23

The registry release — discoverable by MCP clients that query the official index.

### Added
- `mcpName: io.github.6yte96/grapheway` in the package metadata.
- `server.json` validated against the Official MCP Registry schema, listing the
  stdio transport (`npx -y grapheway mcp --probe <url>`).
- `bun run mcp:validate` and `bun run mcp:publish` helper scripts.

## [0.2.4] - 2026-11-23

The universal-client release — stdio MCP, so no hosting is required.

### Added
- **`grapheway mcp`** — a stdio MCP server over newline-delimited JSON-RPC.
  Accepts `--probe <url>`, `--config <file>` or `--graph <file>`. Protocol
  on stdout, logs on stderr. Works in Claude Desktop, Cursor, VS Code and
  Claude Code without a port, daemon or account.
- **`grapheway mcp-config --stdio`** — prints the exact `npx` client snippet.
- Stdio tests (initialize, tools/list, parse errors): 129 tests, 400 assertions.

## [0.2.3] - 2026-11-23

The adoption release — one command, a public index, and a Web-standard adapter.

### Added

#### CLI (`grapheway/cli`)
- **`grapheway init`** — detects Next.js / Express / Hono / node:http / static,
  writes `grapheway.config.ts`, mounts the Next.js middleware + route handler,
  or generates the static compat files. `--url` probes a live site and writes a
  real config; `--force` overwrites; existing files are never clobbered by default.
- **`grapheway badge`** — self-contained SVG agent-readiness badge, with
  `--url` (run the audit), `--score`, `--label`, `--value`, `--out`, `--md`.

#### Web (`grapheway/web`)
- **`toFetchHandler` / `toNextHandler`** — Web-standard Fetch adapter for
  Next.js App Router, Cloudflare Workers, Deno, Bun and edge runtimes.
  Supports a rewritten-path header so one route can serve the whole surface.
- MCP `initialize` now returns server `instructions` with the graph-first
  workflow and the `npx grapheway init` adoption path.

#### Protocol surfaces
- `llms.txt` and `agents.txt` now include a visible "Agent access" section:
  protocol attribution and the one-command install path. Opt out with
  `attribution: false`.
- `agents.json` / `/agent` manifests expose `poweredBy`.
- The graph viewer carries a visible "powered by grapheway" link.

#### Distribution
- `website/public/adopters.json` — a self-submitted registry of sites that
  publish an agent surface, with a daily verifier that checks only each site's
  public `/.well-known/agent` card (no visitor tracking).
- Live adoption index at `/adopters/` with GitHub stars and npm downloads.
- The landing page is now a static agent surface: `/.well-known/agent`,
  `llms.txt`, `agents.json`, `robots.txt`, `sitemap.xml`, JSON-LD and
  `.nojekyll`; its own audit score rises from 14/100 to 70/100.
- `docs/launch/` — 7-day launch calendar, channel targets and copy.
- GitHub CI matrix (typecheck, tests, build, Node 20 smoke test).

### Changed
- Node engine lowered from `>=22` to `>=20`.
- Package homepage points at the landing page; keywords expanded for
  agent-ready / AX / A2A / llms.txt discovery.
- Test count: 127 tests across 16 files.

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
