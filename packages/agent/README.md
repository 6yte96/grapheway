# @grapheway/agent

**Typed client for AI agents to consume Grapheway-enabled sites and gateways.**

Zero dependencies. Works in Node, Bun, Deno, and the browser.

## What it does

Provides a typed `GraphewayClient` that talks to any Grapheway surface — a site running `@grapheway/web`, a `grapheway gateway`, or a `@grapheway/probe` server. Agents use this to read, search, and act on websites through their knowledge graph instead of scraping HTML.

## Install

```bash
npm install @grapheway/agent
# or: bun add @grapheway/agent
```

## Quick start

```ts
import { GraphewayClient } from "@grapheway/agent";

const site = new GraphewayClient("https://acme.example");

// Discover what the site exposes
const discovery = await site.getDiscovery();

// Walk the knowledge graph
const graph = await site.graphSummary();
const node = await site.graphNode("/docs/install");
const neighbors = await site.graphEdges(node.id, "both");
const hits = await site.graphSearch("weather");
const path = await site.graphPath("https://acme.example", node.id);
const walked = await site.traverse("https://acme.example", 2);

// Read content
const manifest = await site.getManifest();
const page = await site.getPage("Install the SDK");

// Call actions
const status = await site.callAction("check_device_status", { serial: "WB-0001" });

// Subscribe to live graph changes
const unsub = site.subscribeGraph((patch) => {
  console.log("graph changed:", patch.addEdges?.length ?? 0, "new edges");
});

// Get the full graph
const fullGraph = await site.getGraph();
```

## API

```ts
class GraphewayClient {
  constructor(baseUrl: string);

  // Discovery
  getDiscovery(): Promise<DiscoveryCard>
  getManifest(): Promise<Manifest>

  // Graph
  graphSummary(): Promise<GraphSummary>
  graphNode(id: string): Promise<Node>
  graphEdges(id: string, direction?: "in" | "out" | "both"): Promise<Edge[]>
  graphSearch(query: string): Promise<Node[]>
  graphPath(from: string, to: string): Promise<PathResult>
  traverse(startId: string, maxDepth?: number): Promise<KnowledgeGraph>
  getGraph(): Promise<KnowledgeGraph>

  // Content
  getPage(titleOrUrl: string): Promise<string>

  // Actions
  callAction(name: string, args?: Record<string, unknown>): Promise<unknown>

  // Realtime
  subscribeGraph(callback: (patch: GraphPatch) => void): () => void
}
```

## Connecting via MCP

The primary way agents consume Grapheway is over MCP. Point any MCP client at the gateway:

```bash
bunx grapheway gateway --probe https://acme.example --refresh 24
bunx grapheway mcp-config --port 4321
```

```json
{
  "mcpServers": {
    "grapheway": { "url": "http://localhost:4321/mcp" }
  }
}
```

Paste that into Claude Desktop / Cursor / VS Code / Claude Code. The graph tools and the site's actions become native MCP tools.

## Skill for agents

The included `SKILL.md` teaches any AI agent how to discover and use Grapheway endpoints — probe `/.well-known/agent`, traverse the graph, call actions, use MCP — so agents use your structured surface before scraping HTML.

## License

GPL-3.0
