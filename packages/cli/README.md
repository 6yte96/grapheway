# @grapheway/cli

**Command-line interface for Grapheway — the knowledge graph gateway for AI agents.**

## Install

```bash
npm install -g @grapheway/cli
# or: bunx grapheway <command>
```

## Commands

### `grapheway gateway` — the flagship

A lightweight server that **holds** a knowledge graph and answers agents over MCP (streamable HTTP).

```bash
# Crawl any legacy site → hold the graph → serve agents, re-crawl every 24h
grapheway gateway --probe https://legacy-docs.example --refresh 24

# Config-defined graph (+ compat files)
grapheway gateway --config grapheway.config.ts

# Pre-exported graph.json (no network)
grapheway gateway --graph graph.json
```

| Flag | Default | Description |
|---|---|---|
| `--probe <url>` | — | Crawl a site and hold its graph |
| `--config <file>` | — | Serve from a config file |
| `--graph <file>` | — | Serve from an exported graph.json |
| `--refresh <hours>` | — | Re-crawl on a schedule (probe mode only) |
| `--port` | 4321 | Server port |
| `--host` | localhost | Bind host |
| `--depth` | 3 | Crawl link depth (probe mode) |
| `--max-pages` | 50 | Max pages to crawl (probe mode) |

Exactly one of `--probe`, `--config`, or `--graph` is required.

### `grapheway mcp-config` — connect your agent

Prints the exact `mcpServers` JSON to paste into Claude Desktop, Cursor, VS Code, or Claude Code.

```bash
grapheway mcp-config --port 4321
```

```json
{
  "mcpServers": {
    "grapheway": { "url": "http://localhost:4321/mcp" }
  }
}
```

### `grapheway probe` — convert any website

Crawls any legacy site and converts it into an agent-native knowledge graph. Serves locally or exports.

```bash
grapheway probe https://expressjs.com --port 4321
grapheway probe https://expressjs.com --no-serve --out ./graph
```

### `grapheway serve` — serve from config

Serves the runtime agent surface + optional compat files from a config file.

```bash
grapheway serve --config grapheway.config.ts --port 3000
```

### `grapheway audit` — agent-readiness check

Live audit of any deployed site. Scores 0–100 based on 14 signals.

```bash
grapheway audit https://acme.example
# Score: 92/100  Grade: A
# ✓ discovery (.well-known/agent)
# ✓ knowledge graph (/graph/v1)
# ✓ open MCP endpoint (/mcp)
# ...
```

### `grapheway generate` — legacy static files

Generates `llms.txt`, `agents.txt`, `robots.txt`, `sitemap.xml` for static hosts.

```bash
grapheway generate --config grapheway.config.ts --out public
```

## License

GPL-3.0
