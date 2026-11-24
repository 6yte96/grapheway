# Turn Any Website Into an MCP Server in One Command

MCP — the Model Context Protocol — is becoming the standard way AI assistants
use tools. Claude Desktop, Cursor, VS Code and a growing list of clients can
connect to an MCP server and call its tools like native functions.

The problem is simple: most websites do not have an MCP server.

That means when you ask an assistant to “read the Express docs” or “find the
pricing page on this site,” it often falls back to scraping HTML. It downloads
the page, strips the markup, guesses the structure, and repeats the whole
process for every page.

There is a better way. You can turn any public website into an MCP server
without asking the site owner to change anything.

I built [grapheway](https://github.com/6yte96/grapheway) to do exactly that.
Here are three ways to use it, from zero-install to fully native.

## What you get

Once a site is exposed over MCP, an agent gets tools such as:

| Tool | What it does |
|---|---|
| `graph_search` | Search the site's knowledge graph |
| `graph_node` | Read one page or section |
| `graph_neighbors` | Follow links and relationships |
| `graph_path` | Find an auditable route between two pages |
| `get_page` | Read a page as clean markdown |
| `get_site_info` | Get the site's name, summary and contact |
| `list_sections` | See the curated sections |

The same server can also expose the site's own actions — “check status,”
“search,” “get a quote” — so the agent can do something, not just read.

## Option 1: the zero-install hosted demo

The fastest way to see it work is the hosted MCP endpoint:

```text
https://grapheway-mcp.usmani3923.workers.dev/mcp?url=https://expressjs.com
```

Paste this into Cursor, Claude Desktop, VS Code or any MCP client:

```json
{
  "mcpServers": {
    "grapheway-express": {
      "url": "https://grapheway-mcp.usmani3923.workers.dev/mcp?url=https://expressjs.com"
    }
  }
}
```

Change the `url` parameter to any public site. The Worker probes up to 12 pages,
builds the knowledge graph, and serves the full MCP surface for that site.

No install. No account. No API key.

This is a demo endpoint, not a production service. It is rate-limited and
caches each site for ten minutes. The code is in
[`deploy/cloudflare-worker`](https://github.com/6yte96/grapheway/tree/main/deploy/cloudflare-worker)
if you want to run your own.

## Option 2: run it locally over stdio

Most local MCP clients can launch a command and speak JSON-RPC over
stdin/stdout. Grapheway ships that transport too:

```bash
npx -y grapheway@latest mcp --probe https://expressjs.com
```

To print the exact client snippet:

```bash
npx -y grapheway@latest mcp-config --stdio --probe https://expressjs.com
```

The output is a standard `mcpServers` block:

```json
{
  "mcpServers": {
    "grapheway-express": {
      "command": "npx",
      "args": ["-y", "grapheway", "mcp", "--probe", "https://expressjs.com"]
    }
  }
}
```

This is useful when you want the graph on your machine, not on someone else's
server. Protocol messages go to stdout; logs go to stderr, so the client never
sees a corrupted stream.

## Option 3: make your own site native

If you control the site, you can skip the probe and mount the surface directly:

```bash
npx -y grapheway@latest init
```

It detects Next.js, Express, Hono, plain Node or a static host, writes a
config, and mounts the agent surface. The result is a permanent, live graph
served by your own site:

```text
/.well-known/agent   discovery
/graph/v1            knowledge graph, search and paths
/agent               manifest and actions
/mcp                 MCP endpoint
/graph               interactive viewer
```

On Next.js, the command writes a small middleware and one route handler. On
Express, Hono and Node, it prints the exact mount snippet. Static hosts get
`llms.txt`, `agents.txt`, `agents.json`, `robots.txt` and `sitemap.xml`.

Then audit the result:

```bash
npx -y grapheway@latest audit https://your-site.com
```

## What it looks like in practice

Ask your assistant:

> “How does routing work in Express, and where is the middleware guide?”

A well-behaved agent can:

1. call `graph_search` for “routing”,
2. call `graph_neighbors` on the best node,
3. call `get_page` for the guide,
4. answer with a link to the source.

There is no HTML scraping and no guessing. The graph gives the agent a route,
and the path response shows which links it followed.

That last part matters. When an agent says “according to the docs,” you want to
know which page it actually read. A graph path is evidence.

## How it works under the hood

The probe does four things:

1. **Crawls the site** — same-origin, robots-aware, with a page budget.
2. **Extracts knowledge** — titles, navigation, headings, links and OpenAPI
   endpoints.
3. **Builds a typed graph** — pages and sections become nodes, links become
   edges, each edge tagged with where it came from.
4. **Serves MCP** — graph tools, the site's actions and pages as markdown
   resources.

The result is the same surface whether the site opted in or was probed. That
is the point: one protocol, every site.

## Guardrails

The hosted demo and the probe are deliberately conservative:

- public `http(s)` URLs only,
- localhost, private ranges and metadata hosts rejected,
- same-origin crawl only,
- `robots.txt` respected,
- a page budget per site,
- a short cache,
- rate limiting at the edge,
- no accounts, cookies or visitor tracking.

For production, run your own gateway or mount the runtime in your own site.
You control the graph, the actions and the limits.

## When not to use this

The probe reads server-rendered HTML. It is not a browser.

- **JavaScript-only sites** may return an empty shell. Use a rendering layer or
  ask the site owner to publish the graph.
- **Login-walled content** is not public; do not expect the hosted demo to read
  it.
- **High-stakes actions** should not be exposed without authentication and
  approval. Actions are opt-in for a reason.

If the content is public and server-rendered, the probe usually works. If it is
not, the native runtime is the better path.

## Frequently asked questions

### Is this safe to point at someone else's site?

The probe respects `robots.txt`, fetches same-origin pages and uses a small
page budget. Treat it like a polite crawler. Do not point it at sites you do
not have permission to read.

### Does the site owner need to install anything?

No. That is the point of the probe. The runtime makes the surface permanent,
but the probe works today.

### Which clients support MCP over HTTP?

Claude Desktop, Cursor, VS Code and most modern MCP clients support the
streamable HTTP transport. Local clients also work through stdio.

### Can I use this with my own tools?

Yes. The graph tools are standard MCP tools, and your own actions are exposed
the same way. You can also use the typed client in `grapheway/agent`.

### Is it production-ready?

It is beta. The core is small, tested and dependency-free, but you should read
the [technical reference](https://github.com/6yte96/grapheway/blob/main/docs/technical-reference.md)
before a large rollout.

## Try it now

Zero install:

```text
https://grapheway-mcp.usmani3923.workers.dev/mcp?url=https://expressjs.com
```

Local:

```bash
npx -y grapheway@latest mcp --probe https://expressjs.com
```

Your own site:

```bash
npx -y grapheway@latest init
```

The code, docs and launch notes are at
[github.com/6yte96/grapheway](https://github.com/6yte96/grapheway). If this
saves you a crawler, star the repo — it helps the next builder find it.

---

*I built grapheway, an open protocol for agent-ready websites. It is free,
open source and in beta. The hosted endpoint is a demo; run your own for
production.*
