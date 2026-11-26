# Migrating to Grapheway 0.3

0.3 is additive. Existing mounts, actions, tool names and graph shapes keep
working. The new options are opt-in, and the new files are documentation and
tests.

## From 0.2.x

Nothing is required. To use the new controls:

```ts
const agent = createGrapheway(config, {
  authorize: (action) => action !== "delete_page",
  rateLimit: { windowMs: 60_000, max: 120 },
  maxBodyBytes: 256 * 1024,
  actionTimeoutMs: 5_000,
  maxConcurrentActions: 4,
  onAction: (event) => console.log(event.action, event.status, event.durationMs),
});
```

Behavior changes to be aware of:

- A rate limit is on by default: 600 requests per minute per client key. Pass
  `rateLimit: false` if a proxy already limits traffic.
- Action timeouts are on by default: 10 seconds, returning 504.
- MCP tool failures now return `isError: true` in the tool result instead of
  a JSON-RPC error.
- Unknown actions still return 400. Denials return 401 or 403, timeouts 504,
  oversized bodies 413, and concurrency over the limit 503.
- Discovery reports `auth: "custom"` when an `authorize` hook is present.

## From `llms.txt` and a sitemap

`llms.txt` is a flat list of links for a language model. A Grapheway graph is
the same content with types, edges and actions, served over MCP.

| You have | Grapheway equivalent |
|---|---|
| H1 title | Site name and graph root |
| `## Section` blocks | Sections and `is_part_of` edges |
| `- [Title](url)` entries | Page and section nodes with `links_to` edges |
| `llms-full.txt` | Markdown resources over MCP `resources/read` |
| `sitemap.xml` | Page nodes discovered by the probe |
| `agents.txt` | Manifest, capabilities and discovery document |
| A search box | `search_content` and `/graph/v1/search` |

Suggested order:

1. Run `npx -y grapheway@latest audit https://your-site.com` to see what the
   runtime can already read.
2. Run `npx -y grapheway@latest probe https://your-site.com --max-pages 20
   --no-serve` to check extraction quality.
3. Mount the runtime with `init`, or serve a probed graph with `gateway`.
4. Keep `llms.txt` and `sitemap.xml` if you already publish them. The compat
   layer still generates them, and they do not conflict.
5. Add actions only after the read surface works. Every action is a new
   permission you have to gate.

## Framework matrix

| Runtime | Mount | Notes |
|---|---|---|
| Next.js App Router | `toFetchHandler(agent.handler)` in a route handler | Set `dynamic = "force-dynamic"` |
| Next.js middleware | `toFetchHandler(agent.handler, { pathHeader })` | Rewrites need the original path header |
| Express / Connect | `toExpressHandler(agent.handler)` | Body parsing must run before the handler |
| Hono | `toHonoHandler(agent.handler)` | Handles SSE on runtimes that support streaming |
| `node:http` | `toNodeHandler(agent.handler)` | Includes the 1 MiB body cap |
| Bun.serve | `toFetchHandler(agent.handler)` | Same as fetch |
| Deno / edge | `toFetchHandler(agent.handler)` | No Node APIs required in the core |
| Static hosts | `grapheway generate` | Compat files only, no runtime |

Pass the same `maxBodyBytes` to the adapter when you change it in
`createGrapheway`, since the adapter rejects before the handler sees the body:

```ts
createServer(toNodeHandler(agent.handler, { maxBodyBytes: 256 * 1024 }));
```

## What is not stable yet

- Action names you invent are yours; the four built-in names are stable.
- The `props` object on nodes and edges is free-form.
- Discovery `auth` values may gain more states before 1.0.
- The viewer, badge and readiness index are convenience surfaces, not the
  protocol.
- Anything in `docs/spec` marked draft can change in a minor release with a
  note in `CHANGELOG.md`.
