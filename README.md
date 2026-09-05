# grapheway

[![Status: Beta](https://img.shields.io/badge/status-beta-amber.svg)](https://github.com/6yte96/grapheway)
[![Documentation](https://img.shields.io/badge/docs-github_pages-blue.svg)](https://6yte96.github.io/grapheway/)
[![Tests](https://img.shields.io/badge/tests-111%20pass-success.svg)](https://github.com/6yte96/grapheway)

> **Current status:** Grapheway is currently in active **Beta** (`v0.2.2`). Project documentation and live demo are hosted on GitHub Pages: [https://6yte96.github.io/grapheway/](https://6yte96.github.io/grapheway/)

**Native agent access for your web app — no paid crawlers, no scraping, no
fees.** Your site opens its own door: its content becomes a live, typed
knowledge graph that agents discover, traverse, search and act on — over
open protocols, at runtime, for free.

One package, subpath imports:

- **For webservers — `grapheway/web`.** Your site opts in: install the
  runtime, describe it in one config, and its content becomes a live, typed
  knowledge graph that agents discover, traverse, search and act on — over
  open protocols, at runtime, for free.
- **For agents — `grapheway/probe`.** No site involvement needed: point it
  at *any* legacy website (docs, APIs, anything), and it converts the site's
  own content into the same graph — served locally for agents to use, or
  exported as JSON. `grapheway probe <url>`.

What a grapheway site exposes:

- **Knowledge graph** — pages/sections become typed nodes, links become
  edges. Agents `graph_node`, `graph_neighbors`, `graph_search` and
  `graph_path` their way through your content instead of scraping HTML.
- **Discovery** — `/.well-known/agent` (an A2A-style agent card) tells any
  agent exactly what you expose, how, and where.
- **Open MCP** — the same surface as a real
  [Model Context Protocol](https://modelcontextprotocol.io) endpoint (`/mcp`):
  graph tools, your actions as tools, and node content as markdown resources.
- **Actions** — your **basic actions** (check status, checkout, query —
  anything) exposed identically over HTTP and MCP.
- **Maximum control** — every node, edge, page and action is *yours* to
  define or override. Nothing is auto-derived behind your back.
- **Compat (optional)** — `llms.txt`, `robots.txt`, `sitemap.xml`, … served
  at runtime by a fully decoupled module, for the agents that still probe them.

The core is **framework-agnostic and dependency-free**: it runs in Node, Bun,
Deno, and the browser, and works with Express, Hono, Next.js, plain
`node:http`, or static hosts.

---

## Subpath exports

One install. Import what you need:

```bash
npm install grapheway
# or: bun add grapheway
```

| Import | What it is |
| --- | --- |
| `grapheway` | Core: graph model, discovery, manifest, JSON-LD. Zero deps. |
| `grapheway/web` | **For webservers** — drop-in agent endpoint: graph, `/agent`, `/mcp` + framework adapters. |
| `grapheway/probe` | **For agents** — convert ANY legacy site into a graph: crawl → graph → serve locally / export JSON. |
| `grapheway/compat` | Optional legacy files (llms.txt, agents.txt, robots.txt, sitemap.xml). |
| `grapheway/agent` | Typed `GraphewayClient` + skill for AI agents. |
| `grapheway/cli` | CLI: gateway, probe, mcp-config, serve, audit, generate. |

```
Your website/app
      │  grapheway.config.ts
      ▼
┌─────────────────────────── grapheway ───────────────────────────┐
│  /.well-known/agent  → discovery (what/how/where)               │
│  /graph/v1           → knowledge graph: nodes · edges · search  │
│                         path · traverse                         │
│  /agent              → JSON API: info · sections · actions      │
│  /mcp                → MCP: graph tools · your actions ·        │
│                         resources (markdown)                    │
│  <head>              → JSON-LD + Open Graph (GEO)               │
│  + grapheway/compat → llms.txt · robots.txt · sitemap.xml      │
└─────────────────────────────────────────────────────────────────┘
      ▲                                        ▲
  humans / search                     agents (Claude, Cursor, …)
                                      via grapheway/agent or MCP
```

---

## Quick start (app side)

**1. Install**

```bash
bun add grapheway
# or: npm i grapheway
```

**2. Describe your site in one config**

```ts
// grapheway.config.ts
import type { GraphewayConfig } from "grapheway";

export const graphewayConfig: GraphewayConfig = {
  name: "Acme Gadgets",
  url: "https://acme.example",
  tagline: "API-powered gadgets for everyone",
  summary:
    "Acme Gadgets sells small, API-powered devices. Every product ships with an open HTTP API and full documentation.",
  contact: { email: "hello@acme.example", protocol: "email" },
  capabilities: ["search", "mcp"],

  sections: [
    {
      title: "Getting Started",
      items: [
        { title: "Install the SDK", url: "/docs/install", notes: "npm i acme, auth, first call" },
        { title: "Quickstart", url: "/docs/quickstart", notes: "First API call in 5 minutes" },
      ],
    },
  ],

  actions: [
    {
      name: "check_device_status",
      description: "Checks the online/offline status of a device by serial.",
      inputSchema: {
        type: "object",
        properties: { serial: { type: "string" } },
        required: ["serial"],
      },
    },
  ],
};
```

**3. Mount the endpoint (any framework)**

```ts
import { createServer } from "node:http";
import { createGrapheway, toNodeHandler, injectHead } from "grapheway/web";
import { graphewayConfig } from "./grapheway.config.ts";

const agent = createGrapheway(graphewayConfig, {
  search: (q) => searchYourSite(q),              // powers search_content
  getPageMarkdown: (path) => markdownFor(path),  // powers get_page + node content
  actions: {
    check_device_status: async (args) => queryDevice(args.serial),
  },
});

const server = createServer(async (req, res) => {
  // 1. Serve your normal pages (with GEO tags injected into <head>).
  if (isPage(req.url)) {
    res.end(injectHead(renderPage(req.url), graphewayConfig));
    return;
  }
  // 2. Everything else → grapheway (graph, /agent, /mcp, …).
  await toNodeHandler(agent.handler)(req, res);
});

server.listen(3000);
```

That's it. Your site now exposes its native agent surface:

```
GET  /.well-known/agent   discovery: protocol, capabilities, endpoints
GET  /graph/v1            graph summary
GET  /graph/v1/node       a node (page/section) of the site graph
GET  /graph/v1/edges      edges touching a node (links, relations)
GET  /graph/v1/search     ranked node search over the graph
GET  /graph/v1/path       shortest path between two nodes (auditable)
GET  /graph/v1/graph      the full live graph (nodes + edges + version)
GET  /graph/v1/events     live graph events (SSE) — realtime subscriptions
GET  /graph               the interactive graph viewer (self-contained UI)
GET  /agent               full manifest
GET  /agent/info          site info          GET  /agent/sections   curated sections
GET  /agent/actions       declared actions   POST /agent/action     run an action
POST /mcp                 Model Context Protocol (streamable HTTP)
GET  /mcp                 MCP SSE announcement

# Optional (mount grapheway/compat): llms.txt, agents.txt, agents.json,
# robots.txt, sitemap.xml — served at runtime for agents that probe them.
```

> Every route sends `Access-Control-Allow-Origin: *`, so any agent anywhere
> can call your endpoints cross-origin — free, global, open by design.

### Framework adapters

`grapheway/web` ships adapters for `node:http`, Express, and Hono:

```ts
// Express
app.use(toExpressHandler(agent.handler));

// Hono — mount at root or under a prefix
app.all("*", toHonoHandler(agent.handler));
```

The core handler itself only needs `{ method, url, headers, body }` in and
`{ status, headers, body, contentType }` out — writing an adapter for your
framework of choice is ~10 lines (see `adapters.ts`).

---

## Actions — let agents *do* things

Built-in actions work out of the box:

| Action | Description |
| --- | --- |
| `get_site_info` | Site name, tagline, summary, contact. Call this first. |
| `list_sections` | Curated sections with titles + URLs. |
| `get_page` | A page as clean markdown — pass `{ url }` or `{ section }`. |
| `search_content` | Search the site (only if you pass a `search` function). |

Register your own:

```ts
createGrapheway(config, {
  actions: {
    check_device_status: async ({ serial }, ctx) => {
      return { serial, status: "online", checkedAt: new Date().toISOString() };
    },
  },
});
```

Agents call it via the HTTP API **or** as an MCP tool — same implementation:

```bash
curl -X POST https://acme.example/agent/action \
  -H 'content-type: application/json' \
  -d '{"name":"check_device_status","arguments":{"serial":"WB-0001"}}'
```

```json
{ "action": "check_device_status", "ok": true, "result": { "serial": "WB-0001", "status": "online" } }
```

---

## `grapheway probe` — convert any website into a graph (for agents)

The webserver story above requires the site to opt in. But most of the web
isn't grapheway-enabled — legacy docs, old frameworks, static sites. That's
what **`grapheway/probe`** is for: the *agent-side* tool that converts
**any** URL into the same native agent surface, with zero site involvement.

It extracts the site's own **knowledge** (not its tech stack): title, meta
description, navigation, headings, links — and, when present, OpenAPI
endpoints. Everything becomes a tagged graph (nav links `extracted`, content
links `inferred`, headings `derived`), served through the *exact same*
runtime surface, so agents point at `http://localhost:PORT` and all their
existing tooling just works:

```bash
# Crawl any docs site and serve it as a full agent surface on :4321
bunx grapheway probe https://expressjs.com

# …or export the graph instead of serving
bunx grapheway probe https://expressjs.com --no-serve --out ./express-graph
```

```
Probed Express.js (https://expressjs.com)
  pages:    25
  headings: 521
  edges:    1927  (1361 extracted, 566 inferred)
  api:      12 endpoints (https://expressjs.com/openapi.json)

Serving "Express.js" as an agent surface:
  discovery    http://localhost:4321/.well-known/agent
  graph        http://localhost:4321/graph/v1
  events       http://localhost:4321/graph/v1/events (realtime SSE)
  MCP          http://localhost:4321/mcp
```

From code:

```ts
import { probeSite, serveProbed, exportProbed } from "grapheway/probe";

const result = await probeSite("https://legacy-docs.example", { maxPages: 50 });
console.log(result.graph.nodes.length, "nodes"); // agents can walk, search, act

const server = await serveProbed("https://legacy-docs.example"); // :4321
// point your MCP client at http://localhost:4321/mcp  →  the legacy docs as MCP tools

await exportProbed(result, { outDir: "./graph" }); // graph.json + config.json
```

Flags: `--port <n>`, `--depth <n>` (link depth, default 3), `--max-pages <n>`
(default 50), `--no-serve`, `--out <dir>`. Robots.txt is respected; pages are
fetched same-origin only; OpenAPI specs (`openapi.json`, `swagger.json`, …)
become typed `api` nodes with method, path, summary and tags.

This is the same promise as the opt-in path, applied to the sites that
haven't joined yet: **agents stop scraping — they read the graph instead.**

---

## The gateway — one server, many agents

The probe and the site runtime both end in the same place: a graph server
that speaks the agent protocol. `grapheway gateway` makes that server a
first-class artifact — a lightweight daemon that **holds** a graph and
answers agents over MCP (streamable HTTP) first:

```bash
# Hold any site's graph; re-crawl every 24h → the diff patches the live
# graph, so SSE subscribers and MCP clients always see it fresh
bunx grapheway gateway --probe https://legacy-docs.example --refresh 24

# …a config-defined graph…
bunx grapheway gateway --config grapheway.config.ts

# …or an exported graph.json (no network needed)
bunx grapheway gateway --graph graph.json
```

Agents connect by pointing their MCP client at the gateway — **no client
shims, no per-agent processes, one live graph shared by every agent**:

```bash
bunx grapheway mcp-config          # prints the exact snippet to paste
```

```json
{
  "mcpServers": {
    "grapheway": { "url": "http://localhost:4321/mcp" }
  }
}
```

Paste that into Claude Desktop / Cursor / VS Code / Claude Code and the
gateway's graph tools + actions appear as native MCP tools. The gateway
talks MCP over plain HTTP — the modern protocol — so nothing needs to run
on the agent's machine. Localhost-first by default; expose with
`--host 0.0.0.0` when you want remote agents to reach it.

---

## Open MCP (the "free global open MCP")

`/mcp` is a spec-aligned Model Context Protocol *streamable HTTP* server.
Any MCP client can connect and gets your site's graph + actions as native
tools, plus node content as markdown resources:

```
Claude Desktop / Cursor / VS Code / mcp CLI  ──►  https://your-site.com/mcp
                                                      ├─ tools/list
                                                      │    ├─ graph_node · graph_neighbors
                                                      │    ├─ graph_search · graph_path
                                                      │    └─ your actions as tools
                                                      ├─ tools/call → graph + actions
                                                      └─ resources/read → page markdown
```

```bash
curl -X POST https://acme.example/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Supported: `initialize`, `ping`, `tools/list`, `tools/call`, `resources/list`,
`resources/read`, notifications. No API key. No account. Open to every agent
that speaks MCP.

---

## The agent side — `grapheway/agent`

Everything above makes **your site** agent-ready. This package is for the
**agent** (or the tooling around it) that wants to consume it.

### 1. Typed client

```ts
import { GraphewayClient } from "grapheway/agent";

const acme = new GraphewayClient("https://acme.example");

const discovery = await acme.getDiscovery();   // what/how/where (agent card)
const graph     = await acme.graphSummary();   // nodes + edges available
const node      = await acme.graphNode("https://acme.example/docs/install");
const neighbors = await acme.graphEdges(node.id, "both");  // how it links
const hits      = await acme.graphSearch("weather");       // ranked nodes
const path      = await acme.graphPath("https://acme.example", node.id);
const walked    = await acme.traverse("https://acme.example", 2);  // native crawl

const manifest = await acme.getManifest();     // info + sections + actions
const page     = await acme.getPage("Install the SDK");  // clean markdown
const status   = await acme.callAction("check_device_status", { serial: "WB-0001" });
```

That's the whole promise: **the agent reads your site by walking its graph —
no paid crawler APIs, no scraping.**

### 2. Connect via MCP — the gateway

The primary way agents consume grapheway is over MCP, pointing straight at
a server that holds the graph (`grapheway gateway`, a site running
`grapheway/web`, or a `serveProbed` surface):

```bash
bunx grapheway gateway --probe https://acme.example --refresh 24
bunx grapheway mcp-config --port 4321
```

```json
{
  "mcpServers": {
    "grapheway": { "url": "http://localhost:4321/mcp" }
  }
}
```

Paste that into any MCP client — the graph tools and the site's actions
become native tools, no shims required. This package's `GraphewayClient`
is the same surface as typed methods, for embedding in your own tooling.

### 3. Skill for agents

[`packages/grapheway/SKILL.md`](https://github.com/6yte96/grapheway/blob/main/packages/grapheway/SKILL.md) teaches any
AI agent how to discover and use agent-ready endpoints (probe
`/.well-known/agent` → traverse the graph → call actions → MCP), so agents
know to use your structured surface before scraping HTML.

---

## Provenance & confidence — answers you can audit

Every edge in a grapheway graph carries **provenance** (where it came from:
a `config` declaration, a `section`, a `link` on a page, a `builder`
function, or `derived` at runtime) and a **confidence** tag — the same
`EXTRACTED` / `INFERRED` / `AMBIGUOUS` trust model that made Graphify famous,
adapted from code to the web:

| Confidence | Meaning |
| --- | --- |
| `extracted` | Ground truth — the site owner declared it or it was read directly from a page's links. |
| `inferred` | Computed with clear evidence (e.g. a link found in a section or a parent page). |
| `ambiguous` | Best-effort — worth verifying before relying on it (e.g. deduped links, guessed pages). |

The graph **summary** reports how trustworthy the map is:

```json
{
  "nodes": 12,
  "edges": 31,
  "provenance": { "config": 6, "section": 9, "link": 12, "derived": 4 },
  "confidence": { "extracted": 18, "inferred": 9, "ambiguous": 4 }
}
```

And **`graph_path` doesn't just answer — it shows its work**: the response
includes every edge in the path with its provenance and confidence, so an
agent can decide how much to trust the route, and a site owner can see
exactly what an agent was told.

```json
{
  "found": true,
  "path": ["/", "/docs", "/docs/install"],
  "edges": [
    {
      "from": "/", "to": "/docs", "type": "link",
      "provenance": "section", "confidence": "extracted",
      "note": "Declared in 'Getting Started' section"
    }
  ]
}
```

---

## Realtime — the live graph

Your graph is not a static dump: it's a **live structure agents can subscribe
to**. Call `patchGraph()` from your app code whenever the world changes — new
product, new docs page, price update — and the server applies the patch and
broadcasts it:

```ts
const agent = createGrapheway(config, { search, getPageMarkdown, actions });

// Anywhere in your app:
agent.patchGraph([
  { type: "add_node", node: { id: "/products/neo", type: "page", label: "NEO Gadget" } },
  { type: "add_edge", edge: { id: "e-neo", source: "/", target: "/products/neo", type: "links_to" } },
  { type: "set_node_meta", id: "/products/neo", meta: { price: "$199" } },
  { type: "remove_node", id: "/products/legacy" },
]);
```

Patches are applied in order and validated: `add_edge` endpoints must already
exist (add the nodes first), `remove_node` also removes every edge touching it,
and duplicates are no-ops. The returned value is the new graph version.

Agents connect to `GET /graph/v1/events` over **Server-Sent Events**: they
receive the current snapshot, then a stream of patches as the site evolves —
no polling, no re-crawling:

```bash
curl -N https://acme.example/graph/v1/events
```

```
event: graph
data: {"type":"snapshot","version":0,"nodes":12,"edges":31}

event: graph
data: {"version":1,"patches":[{"type":"add_node","node":{"id":"/products/neo","type":"page","label":"NEO Gadget"}},{"type":"add_edge","edge":{"id":"e-neo","source":"/","target":"/products/neo","type":"links_to"}}]}

: ping        (heartbeat every 15s)
```

The `grapheway/agent` client wraps it in a typed subscription that streams
patches straight into a local graph:

```ts
const acme = new GraphewayClient("https://acme.example");
const unsub = acme.subscribeGraph((patch) => {
  console.log("graph changed:", patch.addEdges?.length ?? 0, "new edges");
});
```

That's Graphify's "always-on" promise, on the web side: **agents stop
re-crawling your site — your site pushes its truth to them.**

---

## The graph viewer — see what agents see

Every grapheway surface (your site, a `grapheway gateway`, a probed legacy
site) also serves **`GET /graph`** — a self-contained, zero-dependency
interactive map of the live graph. No build step, no CDN, no libraries:

- a hand-rolled force-directed layout — nodes colored by type, edges by
  confidence (`extracted` / `inferred` / `ambiguous`)
- pan, zoom, drag nodes; hover for edge provenance; click any node for its
  full detail + neighbors
- **search** (`/graph/v1/search`) and the **path inspector** — pick any two
  nodes and see the auditable route with its provenance badges
- **realtime**: it subscribes to `/graph/v1/events`, so patches animate in
  live as your app pushes them
- type/confidence filters, label toggle, one-click JSON export of the graph

Open `http://localhost:4321/graph` on any running gateway, or
`https://your-site.com/graph` on a grapheway-enabled site. The viewer is
just a page — its data comes entirely from the same graph API agents use.

---

## CLI

```bash
# THE graph gateway: a lightweight server that holds a graph and answers
# agents over MCP. With --probe --refresh it re-crawls and patches the
# live graph on a schedule — one server, many agents, always fresh.
bunx grapheway gateway --probe https://legacy-docs.example --refresh 24
bunx grapheway gateway --config grapheway.config.ts
bunx grapheway gateway --graph graph.json

# Print the mcpServers snippet to paste into any MCP client
bunx grapheway mcp-config --port 4321

# Convert ANY website into an agent-native graph (for agents, no site
# involvement): crawl → serve locally as the full agent surface
bunx grapheway probe https://legacy-docs.example --port 4321
# …or export the graph instead
bunx grapheway probe https://legacy-docs.example --no-serve --out ./graph

# Serve the runtime agent surface + compat files from a config file
bunx grapheway serve --config grapheway.config.ts --port 3000

# Live agent-readiness audit of any deployed site
bunx grapheway audit https://acme.example
#   Score: 92/100  Grade: A
#   ✓ discovery (.well-known/agent)  ✓ knowledge graph (/graph/v1)
#   ✓ robots.txt AI policy           ✓ /agent API
#   ✓ open MCP endpoint (/mcp)       ✓ structured data (JSON-LD)
#   …

# Legacy static files for a plain static host (via grapheway/compat)
bunx grapheway generate --config grapheway.config.ts --out public
```

---

## GEO — Generative Engine Optimization

`grapheway` treats GEO as a first-class, always-on feature:

- **Structured data**: Schema.org `Organization`, `WebSite` (with
  `SearchAction`), and one `WebPage` per curated section, injected as
  `<script type="application/ld+json">` into every page via `injectHead()`.
- **Semantic metadata**: description, Open Graph, and Twitter card tags.
- **Audit**: `grapheway audit <url>` checks 14 signals (robots policy,
  llms.txt format, JSON-LD, semantic HTML, SSR content, MCP, …) and scores
  0–100 with a grade.

---

## Repository layout

```
grapheway/
├─ packages/grapheway/                — single unified package
│  ├─ src/core/       graphemodel, discovery, manifest, JSON-LD
│  ├─ src/web/        runtime endpoint + adapters + MCP
│  ├─ src/probe/      convert ANY site into a graph
│  ├─ src/compat/     optional legacy files (llms.txt, robots, …)
│  ├─ src/agent/      typed client + skill
│  ├─ src/cli/        gateway / probe / mcp-config / serve / audit / generate
│  └─ test/           111 tests across 6 subpath modules
├─ examples/simple-site/              — runnable demo (server + demo client)
├─ docs/                               — landing page (GitHub Pages) + white paper
└─ README.md
```

```bash
bun install          # install workspace deps
bun run build        # compile to dist/ (6 bundles + .d.ts)
bun test             # 111 tests across all subpaths
npx tsc --noEmit     # typecheck
bun run example      # start the demo site on :4321
```

---

## Publishing (npm)

One package, one publish:

1. **Develop on `dev`** — pushes to `dev` trigger internal GitHub runner builds that commit the tarball to `artifacts/` (stays strictly within GitHub, no npm publishing).
2. **Bump the version** in `packages/grapheway/package.json` when ready to release.
3. **Open PR to `main`** — GitHub Actions runs typecheck and tests on the PR (no publishing).
4. **Merge into `main`** — merging the pull request into `main` triggers the `Publish to npm` workflow to build and publish the release to the npm registry.

> The package compiles to `dist/` (6 JS bundles + type declarations) — works on
> **Node**, **Bun**, **Deno**, and bundlers. Subpath exports let users import
> only what they need. Binary: `grapheway`.

### Dev builds (artifacts)

Every push to `dev` builds the unified package **on the GitHub runner** and commits

the tarball back into the repo on `dev` under `artifacts/` — grab the latest

build straight from the branch, no local build needed:

```bash
npm i https://github.com/6yte96/grapheway/raw/dev/artifacts/grapheway-0.1.0.tgz
```

(The commit-back is tagged `[skip ci]`, so the workflow doesn't loop on itself.)

---

## Further reading

- [**White paper**](https://github.com/6yte96/grapheway/blob/main/docs/whitepaper.md) — the architecture, why graphs beat static files, the provenance model
- [**Contributing**](https://github.com/6yte96/grapheway/blob/main/CONTRIBUTING.md) — development workflow, project structure, code conventions
- [**Changelog**](https://github.com/6yte96/grapheway/blob/main/CHANGELOG.md) — version history and what's new
- [**Landing page**](https://6yte96.github.io/grapheway/) — broadsheet site built from `website/` (GitHub Pages)

---

## License

GPL-3.0
