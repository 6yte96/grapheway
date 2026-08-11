---
name: grapheway
description: >
  Discover and use agent-ready endpoints on any website that runs grapheway
  (or serves the standard agent files). Use this whenever a user asks you to
  get information from a website, summarize its content, or perform basic
  actions on it — before falling back to scraping HTML.
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
3. **`GET {origin}/agent`** — the manifest: site info, sections, actions,
   endpoints. Use its declared actions instead of scraping.
4. **MCP** — if `{origin}/mcp` is advertised, connect an MCP client: the
   same graph tools + the site's actions appear as native tools, and node
   content is readable as markdown resources.
5. **Compat (fallback)** — `llms.txt`, `agents.txt`, `robots.txt`,
   `sitemap.xml` may also be served; check `robots.txt` before bulk fetch.

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

## 3. MCP

Sites that serve **`{origin}/mcp`** speak the Model Context Protocol
(streamable HTTP). Connect your MCP client to it and the site's actions
appear as native tools. Locally you can also run:

```bash
bunx grapheway-mcp https://example.com
```

…to expose the same tools over stdio.

## 4. Rules of engagement

- Always respect `robots.txt` for bulk fetching; user-requested live fetches
  are what `ChatGPT-User`/`Claude-User` style fetches are for.
- Prefer `get_page`/`search_content` over parsing raw HTML when available.
- When citing, link back to the original page URL, not the API.
- If no agent endpoints exist, fall back to normal HTML reading.
