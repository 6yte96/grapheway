# Grapheway protocol, 0.3 draft

Status: draft, published with 0.3.0. The shapes below are stable for the
0.3 line. Breaking changes require a minor version and a migration note.

A Grapheway site exposes one knowledge graph and one action surface over
plain HTTP and MCP. Nothing here is proprietary: any server that answers
these routes conforms.

Schemas:

- [discovery.schema.json](./schemas/discovery.schema.json)
- [manifest.schema.json](./schemas/manifest.schema.json)
- [graph.schema.json](./schemas/graph.schema.json)

Conformance:

```bash
npm run conformance -- https://your-site.com
```

The script checks every public route below and exits non-zero on failure.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/.well-known/agent` | Discovery document |
| GET | `/agent` | Full manifest |
| GET | `/agent/info` | Site block of the manifest |
| GET | `/agent/sections` | Curated sections |
| GET | `/agent/actions` | Declared actions |
| POST | `/agent/action` | Run one action |
| GET | `/graph/v1` | Graph summary |
| GET | `/graph/v1/graph` | Full graph |
| GET | `/graph/v1/node?id=` | One node with its edges |
| GET | `/graph/v1/edges?id=` | Edges touching a node |
| GET | `/graph/v1/search?q=&limit=` | Ranked search |
| GET | `/graph/v1/path?from=&to=` | Shortest path |
| GET | `/graph/v1/events` | SSE graph patches |
| GET, POST | `/mcp` | MCP over streamable HTTP |

Paths are relative to the site root. A custom `prefix` shifts all of them.

## Discovery

`GET /.well-known/agent` returns the protocol name, package version, site
identity, graph counts, endpoint URLs and an `auth` field.

`auth` is `open` when actions are available to every caller. It is `custom`
when the site installed an `authorize` hook. It is not a claim that every
action is public.

## Manifest

`GET /agent` returns `version`, `generatedAt`, `site`, `endpoints`,
`sections`, `actions`, `capabilities` and `geo`. `actions` entries carry a
name, a description, an optional JSON Schema and MCP annotations
(`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`).

## Graph

A graph is `{ nodes, edges, meta? }`. Nodes have a stable `id`, a `type`
(`page`, `section`, `entity`, `concept`, `api`), a `label` and optional
`props`. Edges have an `id`, `source`, `target`, a `type` (`links_to`,
`is_part_of`, `related`, `mentions`, `exposes`) and optional `props`.

`meta` records provenance for probed graphs: `sourceUrl`, `capturedAt` and
`snapshot: true`. Agents should disclose when they quote a snapshot.

All graph responses include `_meta` when the graph has metadata.

## Actions

`POST /agent/action` takes `{ name, arguments }` and returns
`{ action, ok, result }` on success. Errors return
`{ action, ok: false, error }` with a 4xx or 5xx status.

Status codes:

| Status | Meaning |
|---|---|
| 400 | Unknown action, bad arguments or handler error |
| 401 | Authorization requires credentials |
| 403 | Authorization refused |
| 404 | Unknown route or node |
| 413 | Body larger than the configured limit |
| 429 | Rate limit exceeded, see `retry-after` |
| 504 | Action exceeded its timeout |

## MCP

`/mcp` supports `initialize`, `ping`, `tools/list`, `tools/call`,
`resources/list`, `resources/read` and `prompts/list` over streamable
HTTP, plus an SSE announcement on GET.

Every built-in tool declares all four behavior hints. Action failures are
returned as `isError: true` tool results, not protocol errors.

## Production controls

These are runtime options, not protocol fields.

```ts
import { createGrapheway } from "grapheway/web";

const agent = createGrapheway(config, {
  authorize: async (action, args, ctx) => {
    if (action === "delete_page") return { allowed: false, status: 401, reason: "Sign in" };
    return true;
  },
  rateLimit: { windowMs: 60_000, max: 120 },
  maxBodyBytes: 256 * 1024,
  actionTimeoutMs: 5_000,
  onAction: (event) => console.log(event.action, event.status, event.durationMs),
});
```

- `authorize` runs before every action. Return `false`, return
  `{ allowed: false, status, reason }`, or throw.
- `rateLimit` is an in-process token bucket. Default 600 requests per
  minute per client key. Pass `false` to disable it when a proxy already
  limits traffic. The default key is the first `x-forwarded-for` hop, then
  `x-real-ip`, then `local`.
- `maxBodyBytes` defaults to 1 MiB. The Node and Fetch adapters reject
  larger bodies with 413 before parsing.
- `actionTimeoutMs` defaults to 10 seconds. Overruns return 504. The
  handler cannot cancel work that ignores the response, so actions should
  still bound their own I/O.
- `onAction` receives `{ action, ok, status, durationMs, clientKey,
  readOnly, destructive, error? }`. Grapheway stores nothing.

## Compatibility

- Additive fields are allowed in any minor release. Clients must ignore
  unknown fields.
- Removing or renaming a field requires a minor version and a migration
  note in `CHANGELOG.md`.
- The `0.x` line may still change behavior between minors. `1.0` freezes
  the shapes above.
