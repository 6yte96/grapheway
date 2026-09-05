/**
 * ============================================================================
 * GRAPHEWAY LANDING PAGE CONFIGURATION
 * All content verified against the repository (v0.2.2).
 * See CONTENT_RULES.md: no dummy data, human phrasing, no chrome.
 * ============================================================================
 */

export interface ProjectConfig {
  meta: {
    title: string;
    description: string;
    keywords: string[];
    url: string;
    author: string;
    version: string;
  };
  brand: {
    name: string;
    domainSuffix: string;
    tagline: string;
    handle: string;
  };
  nav: { id: string; label: string }[];
  hero: {
    issueBadge: string;
    titleLines: { before: string; highlight: string; after: string };
    description: string;
    primaryCta: { text: string; href: string };
    secondaryCta: { text: string; href: string };
  };
  install: {
    defaultManager: string;
    managers: Record<string, string>;
  };
  telemetry: {
    label: string;
    updatedText: string;
    stats: { number: string; label: string }[];
  };
  features: {
    id: string;
    bentoClass: string;
    category: string;
    tech: string;
    title: string;
    description: string;
    repoLinkText?: string;
    repoHref?: string;
    stamp: { label: string; value: string };
    meta: string;
    tilt: "tilt-up" | "tilt-down";
  }[];
  codePlayground: {
    title: string;
    filename: string;
    language: string;
    tabs: { id: string; label: string; filename: string; code: string }[];
  };
  benchmarks: {
    title: string;
    subtitle: string;
    headers: string[];
    rows: {
      name: string;
      isTarget?: boolean;
      metrics: string[];
      highlight?: boolean;
    }[];
  };
  architecture: {
    title: string;
    subtitle: string;
    layers: { tag: string; name: string; role: string }[];
  };
  support: {
    heading: string;
    text: string;
    license: string;
    year: string;
    starLabel: string;
    sponsorLabel: string;
    shareTitle: string;
  };
  community: {
    contributingText: string;
    dispatches: { title: string; tag: string; component: string; href: string }[];
  };
  links: {
    github: string;
    docs: string;
    discord?: string;
    twitter?: string;
    npm?: string;
    sponsor?: string;
  };
}

export const PROJECT_CONFIG: ProjectConfig = {
  meta: {
    title: "Grapheway: Native Agent Access for Your Web App",
    description:
      "Turn your website into a live, typed knowledge graph that AI agents discover, search, and act on. No paid crawlers, no scraping, no fees. Zero dependencies.",
    keywords: [
      "grapheway",
      "mcp",
      "model context protocol",
      "knowledge graph",
      "ai agents",
      "llms.txt",
      "agent protocol",
      "typescript",
      "web agents",
      "a2a",
    ],
    url: "https://6yte96.github.io/grapheway/",
    author: "6yte96",
    version: "v0.2.2",
  },
  brand: {
    name: "grapheway",
    domainSuffix: ".io",
    tagline: "Your site opens its own door to AI agents",
    handle: "6yte96",
  },
  nav: [
    { id: "playground", label: "Probe" },
    { id: "features", label: "Surface" },
    { id: "benchmarks", label: "Numbers" },
    { id: "architecture", label: "Source" },
  ],
  hero: {
    issueBadge: "v0.2.2",
    titleLines: {
      before: "Agents Stop",
      highlight: "Scraping",
      after: "Your Site",
    },
    description:
      "Grapheway turns your website into a live, typed knowledge graph that AI agents discover, traverse, search, and act on. One package, zero dependencies, no paid crawlers. Your site opens its own door.",
    primaryCta: {
      text: "See a Probe Run",
      href: "#session",
    },
    secondaryCta: {
      text: "View GitHub Repo",
      href: "https://github.com/6yte96/grapheway",
    },
  },
  install: {
    defaultManager: "npm",
    managers: {
      npm: "npm install grapheway",
      bun: "bun add grapheway",
      probe: "bunx grapheway probe https://your-site.com",
      gateway: "bunx grapheway gateway --probe https://your-site.com",
    },
  },
  telemetry: {
    label: "Registry Facts",
    updatedText: "Verified against packages/grapheway, v0.2.2",
    stats: [
      { number: "0", label: "Runtime Dependencies" },
      { number: "14", label: "Agent Routes" },
      { number: "6", label: "Subpath Exports" },
      { number: "111", label: "Passing Tests" },
    ],
  },
  features: [
    {
      id: "knowledge-graph",
      bentoClass: "bento-xl",
      category: "GRAPH",
      tech: "TYPED NODES / EDGES",
      title: "A Live Knowledge Graph of Your Site",
      description:
        "Pages and sections become typed nodes, links become edges with provenance. Agents call graph_node, graph_neighbors, graph_search, and graph_path instead of scraping HTML.",
      repoLinkText: "src/core/graph.ts",
      repoHref: "https://github.com/6yte96/grapheway/tree/main/packages/grapheway/src/core",
      stamp: { label: "GRAPH OPS", value: "4" },
      meta: "node, neighbors, search, path",
      tilt: "tilt-up",
    },
    {
      id: "mcp",
      bentoClass: "bento-tall",
      category: "MCP",
      tech: "STREAMABLE HTTP",
      title: "Open MCP, No API Key",
      description:
        "The /mcp endpoint is a spec-aligned Model Context Protocol server. Claude Desktop, Cursor, VS Code, and any MCP client get your graph tools and actions as native tools, plus pages as markdown resources. No key, no account.",
      repoLinkText: "src/web/mcp.ts",
      repoHref: "https://github.com/6yte96/grapheway/tree/main/packages/grapheway/src/web",
      stamp: { label: "MCP METHODS", value: "7" },
      meta: "initialize, tools, resources",
      tilt: "tilt-down",
    },
    {
      id: "probe",
      bentoClass: "bento-md",
      category: "PROBE",
      tech: "ANY LEGACY SITE",
      title: "Probe Any Website Into a Graph",
      description:
        "Point grapheway probe at any URL, no site involvement needed. It extracts the site's own knowledge, title, navigation, headings, links, and OpenAPI endpoints, then serves the same agent surface locally or exports it as JSON.",
      repoLinkText: "src/probe/",
      repoHref: "https://github.com/6yte96/grapheway/tree/main/packages/grapheway/src/probe",
      stamp: { label: "CRAWL BUDGET", value: "50p" },
      meta: "robots.txt respected, same-origin only",
      tilt: "tilt-up",
    },
    {
      id: "discovery",
      bentoClass: "bento-wide",
      category: "DISCOVERY",
      tech: "A2A-STYLE CARD",
      title: "Agents Find You at /.well-known/agent",
      description:
        "An A2A-style agent card tells any agent exactly what your site exposes, how, and where. Discovery is a URL, not a partnership negotiation.",
      repoLinkText: "src/core/manifest.ts",
      repoHref: "https://github.com/6yte96/grapheway/tree/main/packages/grapheway/src/core",
      stamp: { label: "DISCOVERY", value: "1 URL" },
      meta: "capabilities, endpoints, contact",
      tilt: "tilt-down",
    },
    {
      id: "actions",
      bentoClass: "bento-sm",
      category: "ACTIONS",
      tech: "HTTP + MCP",
      title: "Let Agents Do Things",
      description:
        "Your basic actions, like check status or query, become callable tools over HTTP and MCP. Same implementation, both surfaces.",
      repoLinkText: "src/web/actions.ts",
      repoHref: "httpsgithub.com/6yte96/grapheway/tree/main/packages/grapheway/src/web",
      stamp: { label: "BUILT-IN", value: "4" },
      meta: "get_site_info, get_page, search",
      tilt: "tilt-up",
    },
    {
      id: "compat",
      bentoClass: "bento-lg",
      category: "COMPAT",
      tech: "LLMS.TXT / SITEMAP",
      title: "Legacy Files, Decoupled",
      description:
        "grapheway/compat optionally serves llms.txt, agents.txt, robots.txt, and sitemap.xml at runtime, for the agents that still probe them. Fully decoupled: mount it or do not.",
      repoLinkText: "src/compat/",
      repoHref: "https://github.com/6yte96/grapheway/tree/main/packages/grapheway/src/compat",
      stamp: { label: "LEGACY FILES", value: "5" },
      meta: "optional module",
      tilt: "tilt-down",
    },
    {
      id: "adapters",
      bentoClass: "bento-wide",
      category: "RUNTIME",
      tech: "NODE / EXPRESS / HONO",
      title: "Runs Anywhere, Zero Deps",
      description:
        "The core is framework agnostic and dependency free. It runs in Node, Bun, and Deno, works with Express, Hono, Next.js, plain node:http, or static hosts. The handler interface is four fields in, four fields out.",
      repoLinkText: "src/web/adapters.ts",
      repoHref: "https://github.com/6yte96/grapheway/tree/main/packages/grapheway/src/web",
      stamp: { label: "RUNTIME DEPS", value: "0" },
      meta: "10-line custom adapter",
      tilt: "tilt-up",
    },
  ],
  codePlayground: {
    title: "One Probe, a Whole Agent Surface",
    filename: "probe.sh",
    language: "shell",
    tabs: [
      {
        id: "probe",
        label: "Probe",
        filename: "terminal, grapheway probe",
        code: `$ bunx grapheway probe https://expressjs.com

  Probed Express.js (https://expressjs.com)
    pages:    25
    headings: 521
    edges:    1927  (1361 extracted, 566 inferred)
    api:      12 endpoints (https://expressjs.com/openapi.json)

  Serving "Express.js" as an agent surface:
    discovery    http://localhost:4321/.well-known/agent
    graph        http://localhost:4321/graph/v1
    events       http://localhost:4321/graph/v1/events (realtime SSE)
    MCP          http://localhost:4321/mcp

# That legacy site is now an MCP server. Point Claude Desktop
# or Cursor at localhost:4321/mcp and its docs become tools.`,
      },
      {
        id: "config",
        label: "Site Config",
        filename: "grapheway.config.ts",
        code: `import type { GraphewayConfig } from "grapheway";

export const graphewayConfig: GraphewayConfig = {
  name: "Acme Gadgets",
  url: "https://acme.example",
  tagline: "API-powered gadgets for everyone",
  summary: "Acme Gadgets sells small, API-powered devices.",
  contact: { email: "hello@acme.example", protocol: "email" },
  capabilities: ["search", "mcp"],

  sections: [
    {
      title: "Getting Started",
      items: [
        { title: "Install the SDK", url: "/docs/install" },
        { title: "Quickstart", url: "/docs/quickstart" },
      ],
    },
  ],

  actions: [
    {
      name: "check_device_status",
      description: "Checks the online status of a device by serial.",
      inputSchema: {
        type: "object",
        properties: { serial: { type: "string" } },
        required: ["serial"],
      },
    },
  ],
};`,
      },
      {
        id: "mount",
        label: "Mount",
        filename: "server.ts",
        code: `import { createServer } from "node:http";
import { createGrapheway, toNodeHandler, injectHead } from "grapheway/web";
import { graphewayConfig } from "./grapheway.config.ts";

const agent = createGrapheway(graphewayConfig, {
  search: (q) => searchYourSite(q),
  getPageMarkdown: (path) => markdownFor(path),
  actions: {
    check_device_status: async (args) =>
      queryDevice(args.serial),
  },
});

const server = createServer(async (req, res) => {
  // 1. Your normal pages, with GEO tags injected into <head>.
  if (isPage(req.url)) {
    res.end(injectHead(renderPage(req.url), graphewayConfig));
    return;
  }
  // 2. Everything else goes to grapheway.
  await toNodeHandler(agent.handler)(req, res);
});

server.listen(3000);`,
      },
      {
        id: "mcp",
        label: "MCP",
        filename: "tools/list",
        code: `curl -X POST https://acme.example/mcp \\
  -H 'content-type: application/json' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

// Claude Desktop, Cursor, VS Code: paste this into your
// MCP client config and the site becomes native tools:
{
  "mcpServers": {
    "grapheway": { "url": "http://localhost:4321/mcp" }
  }
}

// tools you get:  graph_node · graph_neighbors
//                graph_search · graph_path
//                your actions (check_device_status, ...)`,
      },
    ],
  },
  benchmarks: {
    title: "One Probe of Express.js",
    subtitle:
      "Real numbers from running grapheway probe against expressjs.com with default settings. Your numbers will differ per site.",
    headers: ["Surface", "What agents got", "Provenance", "Freshness"],
    rows: [
      {
        name: "grapheway probe",
        isTarget: true,
        metrics: [
          "25 pages, 1,927 edges",
          "extracted + inferred",
          "live, re-crawl on demand",
        ],
        highlight: true,
      },
      {
        name: "Scraping HTML",
        metrics: [
          "25 downloads per agent",
          "markup, untyped",
          "stale on next change",
        ],
      },
      {
        name: "llms.txt snapshot",
        metrics: [
          "one flat file",
          "hand maintained",
          "static until edited",
        ],
      },
      {
        name: "Paid crawler API",
        metrics: [
          "same pages",
          "third party",
          "on their schedule",
        ],
      },
    ],
  },
  architecture: {
    title: "Under the Hood",
    subtitle:
      "Six subpath exports, about 6,000 lines of TypeScript, zero dependencies. Where the code lives.",
    layers: [
      {
        tag: "MODULE 1",
        name: "core",
        role: "1,336 lines. The graph model: typed nodes, typed edges, properties, versioning. Graph operations, live patching with structural validation, diff between snapshots, the discovery manifest, and Schema.org JSON-LD serialization.",
      },
      {
        tag: "MODULE 2",
        name: "web",
        role: "2,154 lines. The drop-in agent endpoint: createGrapheway, 14 routes across discovery, graph, viewer, agent API, and MCP. Framework adapters for node:http, Express, and Hono. Live SSE events, patchGraph, and GEO head injection.",
      },
      {
        tag: "MODULE 3",
        name: "probe",
        role: "985 lines. The agent-side crawler: fetches any site same-origin only, respects robots.txt, extracts nav, headings, links, and OpenAPI specs into tagged edges, then serves or exports the result.",
      },
      {
        tag: "MODULE 4",
        name: "compat",
        role: "540 lines. The optional legacy module: llms.txt, agents.txt, agents.json, robots.txt, and sitemap.xml served at runtime. Fully decoupled from the core.",
      },
      {
        tag: "MODULE 5",
        name: "agent",
        role: "385 lines. The typed GraphewayClient for agents: discovery, graph summary, node, edges, search, path, native traverse, manifest, pages as markdown, and action calls.",
      },
      {
        tag: "MODULE 6",
        name: "cli",
        role: "661 lines. The grapheway command: probe, gateway, serve, mcp-config, audit, and generate. mcp-config prints the exact client snippet to paste.",
      },
    ],
  },
  support: {
    heading: "Keep the Gateway Open",
    text: "Grapheway is GPL-3.0 and built in the open, with a white paper and a public changelog. If your agents stopped scraping today, star the repo or pass it to another web team.",
    license: "GPL-3.0",
    year: "2026",
    starLabel: "Star on GitHub",
    sponsorLabel: "Sponsor",
    shareTitle: "Grapheway, native agent access for your web app",
  },
  community: {
    contributingText:
      "All development happens publicly on GitHub. The white paper in docs/whitepaper.md explains the architecture, and examples/simple-site is a working site you can run in one command. Contributions follow the guide in CONTRIBUTING.md.",
    dispatches: [
      {
        title: "Read the white paper: the problem, the insight, the architecture",
        tag: "DOCS",
        component: "docs/whitepaper.md",
        href: "https://github.com/6yte96/grapheway/blob/main/docs/whitepaper.md",
      },
      {
        title: "Run the example site: one bun command, full agent surface",
        tag: "EXAMPLE",
        component: "examples/simple-site",
        href: "https://github.com/6yte96/grapheway/tree/main/examples/simple-site",
      },
      {
        title: "The agent skill: SKILL.md ships in the package",
        tag: "AGENT",
        component: "packages/grapheway/SKILL.md",
        href: "https://github.com/6yte96/grapheway/blob/main/packages/grapheway/SKILL.md",
      },
      {
        title: "Changelog follows Keep a Changelog with public history",
        tag: "CHANGELOG",
        component: "CHANGELOG.md",
        href: "https://github.com/6yte96/grapheway/blob/main/CHANGELOG.md",
      },
    ],
  },
  links: {
    github: "https://github.com/6yte96/grapheway",
    docs: "https://github.com/6yte96/grapheway#readme",
    npm: "https://www.npmjs.com/package/grapheway",
  },
};
