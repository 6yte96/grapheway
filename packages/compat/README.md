# @grapheway/compat

**Optional legacy compatibility files for Grapheway — llms.txt, robots.txt, sitemap.xml, agents.txt.**

Decoupled from the core runtime. Mount it if you want your site to also serve the static files that older AI crawlers still probe.

## What it does

Generates and serves at runtime:

| File | Purpose |
|---|---|
| `llms.txt` | LLM-friendly site summary (per llms.txt spec) |
| `agents.txt` | Agent discovery (human-readable) |
| `agents.json` | Agent discovery (machine-readable) |
| `robots.txt` | Standard robots.txt with AI policy |
| `sitemap.xml` | Standard XML sitemap |

## Install

```bash
npm install @grapheway/compat
# or: bun add @grapheway/compat
```

## Usage

```ts
import { compatHandler } from "@grapheway/compat";

// Mount alongside your grapheway handler
const server = createServer(async (req, res) => {
  // Try compat routes first (llms.txt, robots.txt, etc.)
  const compatResponse = await compatHandler(config, req.url, req.method);
  if (compatResponse) {
    res.writeHead(compatResponse.status, compatResponse.headers);
    res.end(compatResponse.body);
    return;
  }
  // Then grapheway routes
  await toNodeHandler(agent.handler)(req, res);
});
```

Or use the CLI to generate static files:

```bash
grapheway generate --config grapheway.config.ts --out public
```

## Why decoupled?

Most Grapheway sites don't need these files — the knowledge graph and MCP endpoint replace them entirely. This package exists for backward compatibility with agents that still look for `llms.txt` or `robots.txt` before trying structured endpoints.

## License

GPL-3.0
