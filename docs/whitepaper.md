# Grapheway: Native Agent Access for the Web

**A technical white paper on making websites machine-readable without paid crawlers, scraping, or API gates.**

---

## The problem

AI agents need to understand websites. Today, they have three options — all broken:

1. **Scrape HTML.** Fragile, wasteful, and hostile. Every agent independently downloads every page, parses inconsistent markup, and rebuilds a model the site already has. Sites block scrapers; agents waste tokens on boilerplate.

2. **Pay for structured APIs.** Works if you control the API. Doesn't work for the 99% of the web that isn't yours — documentation sites, legacy apps, third-party docs.

3. **Static files (llms.txt, sitemap.xml).** A step forward, but static. No runtime freshness, no actions, no provenance. Agents read a snapshot and hope it's current.

None of these give agents what they actually need: **a live, typed, auditable map of a website's content that updates in real time and supports actions — without the site owner doing anything special.**

## The insight

Every website already *has* a knowledge graph. Its navigation is a tree of typed nodes. Its links are edges with provenance (declared in config, found in a section, discovered by crawling). Its content is node metadata. Its API endpoints are typed operations.

The web is already a graph. Agents just can't see it that way — because no one exposes it.

## The architecture

Grapheway makes the graph visible. Two tools, one protocol:

### For webservers: `@grapheway/web`

The site owner installs one package, writes one config, and mounts one handler. Instantly, the site exposes:

- **A knowledge graph** (`/graph/v1`) — pages as typed nodes, links as typed edges, with provenance and confidence on every edge
- **Discovery** (`/.well-known/agent`) — an A2A-style card that tells agents exactly what the site exposes, how, and where
- **Actions** (`/agent/action`) — the site's real capabilities (check status, query data, place orders) exposed as callable tools
- **MCP** (`/mcp`) — a spec-aligned Model Context Protocol server over streamable HTTP, so any MCP client gets the graph + actions as native tools
- **Realtime** (`/graph/v1/events`) — SSE stream of graph patches as the site evolves
- **A viewer** (`/graph`) — a self-contained interactive map of the graph for humans

No CDN, no build step, no external service. The graph lives on the site's own server.

### For agents: `@grapheway/probe`

Most of the web isn't Grapheway-enabled. The probe crawls any website — legacy docs, old frameworks, static sites — and extracts its *knowledge* (not its tech stack) into the same graph format. The same runtime surface, the same MCP endpoint, the same tools. Agents point at `localhost:PORT` and all their existing tooling works.

### The gateway

`grapheway gateway` is a lightweight server that **holds** a graph and answers agents. With `--refresh`, it re-crawls on a schedule, diffs the new graph against the old one, and pushes minimal patches through the live graph — so SSE subscribers and MCP clients always see the site fresh. One server, many agents, always current.

## Why graphs beat static files

| | Static files (llms.txt, sitemap) | Grapheway |
|---|---|---|
| **Freshness** | Snapshot at generation time | Live, versioned, SSE-streamed |
| **Structure** | Flat text or XML | Typed nodes + edges with properties |
| **Trust** | None | Provenance + confidence on every edge |
| **Actions** | None | Callable tools over HTTP + MCP |
| **Search** | None | Full-text ranked search |
| **Pathfinding** | None | Auditable shortest path between any two nodes |
| **Realtime** | Re-generate and re-serve | Patch-based, streamed to subscribers |
| **Discovery** | Hope the agent finds the file | `/.well-known/agent` (standard location) |

## The provenance model

Every edge in a Grapheway graph carries two signals:

### Provenance (where it came from)

| Source | Meaning |
|---|---|
| `config` | The site owner declared it in the config file |
| `section` | Found in a curated section of the config |
| `link` | Read from a page's actual links |
| `builder` | Computed by a user-provided builder function |
| `derived` | Computed at runtime (e.g. by the probe) |

### Confidence (how much to trust it)

| Level | Meaning |
|---|---|
| `extracted` | Ground truth — declared or read directly from the page |
| `inferred` | Computed with clear evidence |
| `ambiguous` | Best-effort — worth verifying |

This matters because agents make decisions based on the graph. If an agent follows an edge from `/docs` to `/docs/install`, it should know whether that link was declared by the site owner (`extracted`) or guessed by a crawler (`inferred`). The `graph_path` endpoint doesn't just return a path — it returns every edge with its provenance and confidence, so the agent can decide how much to trust the route.

## Why MCP over HTTP

The MCP spec's modern transport is streamable HTTP. Claude Desktop, Cursor, VS Code, and Claude Code all support pointing at `http://host/mcp`. This means:

- **No client shims.** Agents connect directly to the server.
- **One server, many agents.** The graph is shared, not per-process.
- **Standard protocol.** Any MCP-compatible tool works out of the box.
- **No API keys for local use.** Open to every agent that speaks MCP.

Grapheway supports the full MCP tool surface: `tools/list`, `tools/call`, `resources/list`, `resources/read`, plus graph-specific tools (`graph_node`, `graph_neighbors`, `graph_search`, `graph_path`) and the site's own actions as tools.

## The economics

Traditional agent access to the web costs money:

- Crawling APIs: $0.01–$0.10 per page
- Structured data services: $50–$500/month
- Custom scrapers: developer time + maintenance + legal risk

Grapheway is free and open source (GPL-3.0). The graph lives on the site's own infrastructure. There's no central service, no API key, no usage metering. The cost is the same as serving any other HTTP endpoint.

For the agent side: no paid crawlers needed. The probe converts any site into a graph for free. The gateway holds it for free. The MCP connection is standard HTTP.

## The product shape

```
AGENT SIDE                          SERVER SIDE
┌──────────────────────┐           ┌─────────────────────────────┐
│ MCP client           │ ──HTTP──► │ @grapheway/web runtime      │
│ (Claude, Cursor,     │           │   /.well-known/agent        │
│  VS Code, custom)    │           │   /graph/v1  /agent  /mcp   │
│                      │           │   SSE /graph/v1/events      │
│ or:                  │           │   /graph (viewer UI)        │
│ GraphewayClient SDK  │           └─────────────────────────────┘
└──────────────────────┘
         OR
┌──────────────────────┐           ┌─────────────────────────────┐
│ MCP client           │ ──HTTP──► │ grapheway gateway           │
│                      │           │   --probe <url> --refresh N │
│                      │           │   holds graph, re-crawls,   │
│                      │           │   serves agents via MCP      │
└──────────────────────┘           └─────────────────────────────┘
```

## What's next

- **Agent analytics** — see which agents visit, what they query, where they spend time
- **Auth and rate limiting** — control gates for remote access
- **Probe v2** — deeper framework extraction (Docusaurus, GitBook), OpenAPI → callable actions
- **Community** — skills, adapters, integrations

## Links

- **GitHub**: [github.com/6yte96/grapheway](https://github.com/6yte96/grapheway)
- **npm**: `grapheway`, `@grapheway/web`, `@grapheway/probe`, `@grapheway/agent`, `@grapheway/cli`, `@grapheway/compat`
- **License**: GPL-3.0

---

*Grapheway is built by [Operivora](https://github.com/operivora). The web is already a graph. Agents just need to see it.*
