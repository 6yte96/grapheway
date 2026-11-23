# Grapheway Hosted MCP (Cloudflare Worker)

A zero-install remote MCP endpoint:

```
POST https://grapheway-mcp.<account>.workers.dev/mcp?url=https://docs.example.com
```

The Worker probes the target site (same-origin, robots-aware, 12 pages),
builds its knowledge graph, and serves the full grapheway MCP surface:
`graph_node`, `graph_neighbors`, `graph_search`, `graph_path`, the site's
actions, and pages as markdown resources.

## Deploy

```bash
cd deploy/cloudflare-worker
wrangler deploy
```

Requires a Cloudflare account and `wrangler login`. The free Workers plan is
enough for the demo.

## Client config

Cursor / Claude Desktop / VS Code (streamable HTTP):

```json
{
  "mcpServers": {
    "grapheway-express": {
      "url": "https://grapheway-mcp.<account>.workers.dev/mcp?url=https://expressjs.com"
    }
  }
}
```

Each site gets its own URL — one Worker, any website.

## Guardrails

- Public `http(s)` URLs only; localhost, private ranges and metadata hosts are rejected.
- 12-page crawl budget, same-origin only, `robots.txt` respected.
- 10-minute in-memory cache.
- 30 requests/minute per IP (best effort at the edge).
- No accounts, no cookies, no visitor tracking.

This is a demo/distribution surface. For production, run `grapheway gateway`
under your own control or mount `grapheway/web` into your site.
