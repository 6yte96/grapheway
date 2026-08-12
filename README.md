# grapheway

**Native agent access for your web app — no paid crawlers, no scraping, no
fees.** Your site opens its own door: its content becomes a live, typed
knowledge graph that agents discover, traverse, search and act on — over
open protocols, at runtime, for free.

`grapheway` gives your site a runtime agent surface in one drop-in package:

- **Knowledge graph** — your pages/sections become typed nodes, your links
  become edges. Agents `graph_node`, `graph_neighbors`, `graph_search` and
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

## Packages (monorepo)

| Package | What it is |
| --- | --- |
| [`grapheway`](./packages/core) | Runtime core: graph model, discovery, manifest, JSON-LD. Zero deps. |
| [`@grapheway/web`](./packages/web) | Drop-in agent endpoint for any Node app: graph, `/agent`, `/mcp` + framework adapters. |
| [`@grapheway/compat`](./packages/compat) | Optional legacy files (llms.txt, agents.txt, robots.txt, sitemap.xml) — decoupled. |
| [`@grapheway/agent`](./packages/agent) | The agent side: typed client, runnable stdio MCP server, and a `SKILL.md` for AI agents. |
| [`@grapheway/cli`](./packages/cli) | `grapheway serve`, `grapheway audit <url>`, `grapheway generate`. |
| [`examples/simple-site`](./examples/simple-site) | A complete demo site with a custom action. |

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
│  + @grapheway/compat → llms.txt · robots.txt · sitemap.xml      │
└─────────────────────────────────────────────────────────────────┘
      ▲                                        ▲
  humans / search                     agents (Claude, Cursor, …)
                                      via @grapheway/agent or MCP
```

---

## Quick start (app side)

**1. Install**

```bash
bun add grapheway @grapheway/web
# or: npm i grapheway @grapheway/web
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
import { createGrapheway, toNodeHandler, injectHead } from "@grapheway/web";
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
GET  /graph/v1/path       shortest path between two nodes
GET  /agent               full manifest
GET  /agent/info          site info          GET  /agent/sections   curated sections
GET  /agent/actions       declared actions   POST /agent/action     run an action
POST /mcp                 Model Context Protocol (streamable HTTP)
GET  /mcp                 MCP SSE announcement

# Optional (mount @grapheway/compat): llms.txt, agents.txt, agents.json,
# robots.txt, sitemap.xml — served at runtime for agents that probe them.
```

> Every route sends `Access-Control-Allow-Origin: *`, so any agent anywhere
> can call your endpoints cross-origin — free, global, open by design.

### Framework adapters

`@grapheway/web` ships adapters for `node:http`, Express, and Hono:

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

## The agent side — `@grapheway/agent`

Everything above makes **your site** agent-ready. This package is for the
**agent** (or the tooling around it) that wants to consume it.

### 1. Typed client

```ts
import { GraphewayClient } from "@grapheway/agent";

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

### 2. Runnable stdio MCP server

Turn any grapheway site into local MCP tools for your agent:

```bash
bunx grapheway-mcp https://acme.example
```

Claude Desktop config:

```json
{
  "mcpServers": {
    "acme": { "command": "bunx", "args": ["grapheway-mcp", "https://acme.example"] }
  }
}
```

### 3. Skill for agents

[`packages/agent/skill/SKILL.md`](./packages/agent/skill/SKILL.md) teaches any
AI agent how to discover and use agent-ready endpoints (probe
`/.well-known/agent` → traverse the graph → call actions → MCP), so agents
know to use your structured surface before scraping HTML.

---

## CLI

```bash
# Serve the full runtime agent surface (discovery, graph, /agent, /mcp,
# + compat files) — the primary way to run grapheway
bunx grapheway serve --config grapheway.config.ts --port 3000

# Live agent-readiness audit of any deployed site
bunx grapheway audit https://acme.example
#   Score: 92/100  Grade: A
#   ✓ discovery (.well-known/agent)  ✓ knowledge graph (/graph/v1)
#   ✓ robots.txt AI policy           ✓ /agent API
#   ✓ open MCP endpoint (/mcp)       ✓ structured data (JSON-LD)
#   …

# Legacy static files for a plain static host (via @grapheway/compat)
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
├─ packages/
│  ├─ core/        grapheway          — graph model + discovery + manifest (zero deps)
│  ├─ web/         @grapheway/web   — universal endpoint + adapters + MCP
│  ├─ compat/      @grapheway/compat  — optional legacy files (llms.txt, robots, …)
│  ├─ agent/       @grapheway/agent   — client + stdio MCP + skill
│  └─ cli/         @grapheway/cli     — serve / audit / generate
├─ examples/simple-site/              — runnable demo (server + demo client)
└─ README.md
```

```bash
bun install          # install workspace deps
bun test             # 85+ tests across all packages
npx tsc --noEmit     # typecheck
bun run example      # start the demo site on :4321
bun run examples/simple-site/demo.ts  # run the agent client against it
```

---

## Publishing (npm)

Every push to `main` runs the quality gate (typecheck + full test suite) and
then publishes **every package whose version is not yet on npm** — bump the
version, push, and it ships. See `.github/workflows/publish.yml`.

1. **Bump the version** — keep all five packages in lockstep (they depend on
   each other via `workspace:*`): set the same new `"version"` (e.g. `0.2.0`)
   in `packages/{core,web,compat,agent,cli}/package.json`, commit, push to `main`.
2. **Add the npm token** — create an npm *automation* token
   (npmjs.com → Access Tokens → Generate new → *Automation*), then add it as a
   repository secret named `NPM_TOKEN`:
   GitHub → repo → **Settings → Secrets and variables → Actions**.
   (A local `.env` is never read — GitHub Actions uses repository secrets.)
3. Push to `main` — the workflow typechecks, runs the tests, then publishes
   each unpublished version in dependency order:
   `grapheway` → `@grapheway/compat` → `@grapheway/web` → `@grapheway/agent` → `@grapheway/cli`.
   Versions already on npm are skipped, so docs-only pushes are safe.

> Packages ship as TypeScript source (no build step) — install with **Bun** or
> **Node ≥ 22.18** (native type stripping). Binaries: `grapheway`, `grapheway-mcp`.

---

## License

GPL-3.0
