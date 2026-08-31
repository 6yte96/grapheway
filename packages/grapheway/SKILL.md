---
name: grapheway
description: >
  Discover and use agent-ready endpoints on any website that runs grapheway
  (or serves the standard agent files), probe any OTHER website into a
  graph with `grapheway probe`, or connect to a `grapheway gateway` over
  MCP. Use this whenever a user asks you to get information from a website,
  summarize its content, or perform basic actions on it — before falling
  back to scraping HTML.
---

# grapheway — how to read any agent-ready site

Many sites now publish machine-readable surfaces for agents. Before scraping
HTML, **probe for these endpoints** in order. They are cheaper, faster, and
far more accurate than parsing markup.

## 1. Probe order (runtime first)

1. **`GET {origin}/.well-known/agent`** — the discovery card (A2A-style).
   Tells you the protocol, capabilities, graph stats and exactly which
   endpoints to talk to. If this responds, the site runs grapheway: follow
   its `endpoints`.
2. **`GET {origin}/graph/v1`** — the knowledge graph: nodes (pages,
   sections), edges (links, relations). Use it to orient, then traverse:
   - `GET /graph/v1/node?id=<url>` — one node
   - `GET /graph/v1/edges?id=<url>&direction=out|in` — how a node connects
   - `GET /graph/v1/search?q=...` — find nodes by label/metadata
   - `GET /graph/v1/path?from=<id>&to=<id>` — shortest path between pages
     **plus the auditable edges behind each hop** — your citation for why
     you walked that path
   - `GET /graph/v1/events` — realtime SSE stream of graph changes
   - `GET /graph/v1/graph` — the full live graph (nodes + edges) in one call
   - `GET /graph` — a human-interactive viewer of the same graph (handy for
     the user to see what you're navigating)
3. **`GET {origin}/agent`** — the manifest: site info, sections, actions,
   endpoints. Use its declared actions instead of scraping.
4. **MCP** — if `{origin}/mcp` is advertised, connect an MCP client: the
   same graph tools + the site's actions appear as native tools, and node
   content is readable as markdown resources.
5. **Compat (fallback)** — `llms.txt`, `agents.txt`, `robots.txt`,
   `sitemap.xml` may also be served; check `robots.txt` before bulk fetch.

## 3. Provenance & realtime

- Every graph edge carries **provenance** (where it came from:
  `config`/`section`/`link`/`builder`/`extra`/`derived`) and **confidence**
  (`extracted`/`inferred`/`ambiguous`). When you answer from the graph,
  show the path you walked — the edges are your evidence. Prefer
  `extracted` hops; treat `inferred` hops as leads to verify with `get_page`.
- The graph is **live**: sites push changes at runtime. Subscribe to
  `GET {origin}/graph/v1/events` (SSE) to get a snapshot, then a `graph`
  event with `{ version, patches }` on every change. The `version` field of
  `/graph/v1` tells you whether the graph moved since you last looked — no
  need to re-crawl.

## 2. The agent API

Use the declared **actions**:

| Action | Purpose |
| --- | --- |
| `get_site_info` | Site name, tagline, summary, contact. Call this first. |
| `list_sections` | Curated content sections with titles + URLs. |
| `get_page` | Fetch one page as clean markdown. Pass `{ "url": "/docs/x" }` or `{ "section": "Docs" }`. |
| `search_content` | Search the site. Pass `{ "q": "..." }`. (If available.) |

Call an action:

```http
POST {origin}/agent/action
Content-Type: application/json

{ "name": "get_page", "arguments": { "url": "/docs/install" } }
```

## 4. MCP

Sites that serve **`{origin}/mcp`** speak the Model Context Protocol
(streamable HTTP). Connect your MCP client to it and the site's actions
appear as native tools.

If you're an MCP-native agent (Claude Desktop, Cursor, VS Code, Claude
Code), the cleanest path is a **gateway**: a server that holds the graph
and speaks MCP over HTTP. Point your client at it and nothing else needs
to run on your machine:

```bash
# Host holds any site's graph, re-crawled on a schedule (patches stream live)
grapheway gateway --probe https://example.com --refresh 24
# Then connect an MCP client to http://localhost:4321/mcp
```

Every endpoint you discovered above (graph, manifest, actions, SSE) is
served by the gateway too — `{gateway}/graph/v1`, `{gateway}/agent`, …

## 5. Probing sites that are NOT agent-ready

Most sites don't run grapheway. Instead of scraping their HTML by hand,
convert them into a graph first with the probe tool:

```bash
# Serve the site's knowledge graph locally (discovery, /graph/v1, /agent, /mcp)
grapheway probe https://legacy-docs.example --port 4321

# Or export the graph as JSON for offline/CI use
grapheway probe https://legacy-docs.example --no-serve --out ./graph
```

Then point your client at `http://localhost:4321` and use the standard flow
(discovery → graph → get_page → MCP) against the *probed* site. The probe:

- extracts **knowledge, not tech stack** — nav, headings, links, meta — into
  a tagged graph (nav links `extracted`, content links `inferred`, headings
  `derived`)
- detects **OpenAPI** specs (`openapi.json`, `swagger.json`, …) and turns
  endpoints into typed `api` nodes with method, path, summary, tags
- respects `robots.txt`, crawls same-origin only
- converts pages to clean markdown on demand (`get_page`)

When you can't run the probe locally, fall back to reading HTML directly.

## 6. Rules of engagement

- Always respect `robots.txt` for bulk fetching; user-requested live fetches
  are what `ChatGPT-User`/`Claude-User` style fetches are for.
- Prefer `get_page`/`search_content` over parsing raw HTML when available.
- When citing, link back to the original page URL, not the API.
- If no agent endpoints exist, fall back to normal HTML reading.
