/**
 * Acme Gadgets — a tiny agent-ready site built on grapheway.
 *
 * Run:  bun run examples/simple-site/server.ts
 * Then: curl localhost:4321/.well-known/agent | jq   (discovery)
 *       curl localhost:4321/graph/v1 | jq            (knowledge graph)
 *       curl localhost:4321/llms.txt                  (compat file)
 *       bun run examples/simple-site/demo.ts          (agent client demo)
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createGrapheway, injectHead, toNodeHandler } from "@grapheway/web";
import { compatHandler } from "@grapheway/compat";
import { graphewayConfig } from "./grapheway.config.ts";
import { markdownDocs, pages } from "./pages.ts";

const PORT = 4321;

// Simulated device registry for the custom action.
const devices: Record<string, { name: string; status: "online" | "offline"; temp?: number }> = {
  "WB-0001": { name: "Weather Beacon", status: "online", temp: 21 },
  "CB-0001": { name: "Coffee Bot", status: "offline" },
  "LP-0001": { name: "Light Portal", status: "online" },
};

const agent = createGrapheway(graphewayConfig, {
  search: (q, ctx) => {
    const query = q.toLowerCase();
    const hits = Object.values(ctx.manifest.sections)
      .flatMap((s) => s.items ?? [])
      .filter((item) => `${item.title} ${item.notes ?? ""}`.toLowerCase().includes(query))
      .map((item) => ({ title: item.title, url: item.url, notes: item.notes }));
    return hits.length > 0 ? hits : { error: `No results for "${q}".`, sections: ctx.manifest.sections.map((s) => s.title) };
  },
  getPageMarkdown: (path) => markdownDocs[path] ?? null,
  actions: {
    check_device_status: async (args) => {
      const device = devices[String(args.serial ?? "")];
      if (!device) return { error: `Unknown serial "${args.serial}". Known: ${Object.keys(devices).join(", ")}` };
      return { serial: args.serial, ...device, checkedAt: new Date().toISOString() };
    },
  },
});

const compat = compatHandler(graphewayConfig, { getPageMarkdown: (path) => markdownDocs[path] ?? null });
const agentNodeHandler = toNodeHandler(agent.handler);

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  // Serve rendered HTML pages (with injected GEO meta tags + JSON-LD).
  const page = pages[path];
  if (page) {
    const html = injectHead(page, graphewayConfig);
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html);
    return;
  }

  // Legacy compat files first (llms.txt, robots.txt, sitemap.xml, …).
  const compatRes = await compat({ path });
  if (compatRes) {
    res.statusCode = compatRes.status;
    for (const [k, v] of Object.entries(compatRes.headers)) res.setHeader(k, v);
    res.setHeader("content-type", compatRes.contentType);
    res.end(compatRes.body);
    return;
  }

  // Everything else goes to the runtime agent handler (graph, /agent, /mcp).
  await agentNodeHandler(req, res);
});

server.listen(PORT, () => {
  console.log(`
  Acme Gadgets — agent-ready demo site
  ------------------------------------
  Site:        http://localhost:${PORT}/
  Discovery:   http://localhost:${PORT}/.well-known/agent
  Graph:       http://localhost:${PORT}/graph/v1
  Manifest:    http://localhost:${PORT}/agent
  MCP:         http://localhost:${PORT}/mcp
  Custom tool: check_device_status (e.g. serial WB-0001)
  Compat:      http://localhost:${PORT}/llms.txt · robots.txt · sitemap.xml
  `);
});
