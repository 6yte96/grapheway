# @grapheway/web

**Drop-in agent endpoint for any web server — makes your site agent-accessible in one function call.**

Framework-agnostic, zero dependencies. Works with Express, Hono, Next.js, plain `node:http`, or any framework.

## What it does

Mount the Grapheway runtime on your existing server and your site immediately exposes:

| Endpoint | Purpose |
|---|---|
| `/.well-known/agent` | Agent discovery (A2A-style card) |
| `/graph/v1` | Knowledge graph summary |
| `/graph/v1/node?id=` | Node detail |
| `/graph/v1/edges?id=` | Edge detail |
| `/graph/v1/search?q=` | Full-text search |
| `/graph/v1/path?from=&to=` | Auditable pathfinding |
| `/graph/v1/graph` | Full graph dump |
| `/graph/v1/events` | Realtime SSE stream |
| `/graph` | **Interactive graph viewer** (self-contained UI) |
| `/agent` | JSON API + actions |
| `/mcp` | Model Context Protocol (streamable HTTP) |

## Install

```bash
npm install grapheway @grapheway/web
# or: bun add grapheway @grapheway/web
```

## Quick start

```ts
import { createGrapheway, toNodeHandler, injectHead } from "@grapheway/web";

const agent = createGrapheway(config, {
  search: (q) => searchYourSite(q),
  getPageMarkdown: (path) => markdownFor(path),
  actions: {
    check_device_status: async ({ serial }) => queryDevice(serial),
  },
});

// Mount with any framework
const server = createServer(async (req, res) => {
  if (isPage(req.url)) {
    res.end(injectHead(renderPage(req.url), config));
    return;
  }
  await toNodeHandler(agent.handler)(req, res);
});
```

## Framework adapters

```ts
// Express
app.use(toExpressHandler(agent.handler));

// Hono
app.all("*", toHonoHandler(agent.handler));

// Plain node:http
const handler = toNodeHandler(agent.handler);
```

Writing your own adapter is ~10 lines — the handler only needs `{ method, url, headers, body }` in and `{ status, headers, body, contentType }` out.

## Live graph updates

```ts
// Push changes from your app code
agent.patchGraph([
  { type: "add_node", node: { id: "/products/neo", type: "page", label: "NEO" } },
  { type: "add_edge", edge: { id: "e1", source: "/", target: "/products/neo", type: "links_to" } },
]);
// Subscribers at /graph/v1/events receive the patch in real time
```

## MCP endpoint

The `/mcp` endpoint is a spec-aligned Model Context Protocol server over streamable HTTP. Any MCP client (Claude Desktop, Cursor, VS Code, Claude Code) can connect and get your graph tools + actions as native tools.

```bash
curl -X POST http://localhost:3000/mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Interactive viewer

Open `http://localhost:3000/graph` to see a self-contained, zero-dependency interactive map of your knowledge graph — force layout, search, path inspector, realtime SSE, filters.

## API

```ts
createGrapheway(config, options): GraphewayAgent
toNodeHandler(agent): (req, res) => Promise<void>
toExpressHandler(agent): (req, res, next) => void
toHonoHandler(agent): (c) => Promise<Response>
injectHead(html, config): string
```

## License

GPL-3.0
