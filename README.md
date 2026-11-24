# grapheway

**AI assistants should read your website like a map, not guess at a pile of HTML.**

[![npm version](https://img.shields.io/npm/v/grapheway?color=0b0e15)](https://www.npmjs.com/package/grapheway)
[![npm downloads](https://img.shields.io/npm/dm/grapheway?color=0b0e15)](https://www.npmjs.com/package/grapheway)
[![agent-ready sites](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2F6yte96.github.io%2Fgrapheway%2Fadopters.json&query=%24.total&label=agent-ready%20sites&color=0b0e15)](https://6yte96.github.io/grapheway/adopters/)
[![license](https://img.shields.io/badge/license-GPL--3.0-0b0e15)](https://github.com/6yte96/grapheway/blob/main/LICENSE)

Grapheway is an open, free way for a website to describe itself to AI agents.

Think of it as a **sitemap for AI agents** — except the map is live, searchable, and can do things.

Instead of scraping pages, an assistant asks the site for its **knowledge graph**: pages, sections, links and actions. The site answers in a clean, typed format, and the same content is available through **MCP** — the tool protocol used by Claude, Cursor, VS Code and other assistants.

No account. No API key. No paid crawler. No data collection.

---

## Why this exists

Today, an AI assistant that needs an answer from a website usually:

1. downloads the HTML,
2. strips out the navigation, ads and scripts,
3. guesses which parts matter,
4. repeats the whole process for every page.

That is slow, expensive and easy to get wrong. Grapheway flips it: **the site publishes its own map, and the assistant walks it.**

---

## What you get

- **A live map of your content.** Pages and sections become connected nodes. Agents can search the map, follow it, and show the path they took.
- **One open door.** `/.well-known/agent` tells any agent what the site offers and where to find it.
- **MCP, for free.** Claude Desktop, Cursor, VS Code and other clients can use the site's map and actions as native tools.
- **Actions, not just pages.** "Check status", "search", "get a quote" — anything the site can already do can be offered to agents.
- **Fresh, not stale.** When the site changes, the map can update live instead of waiting for the next crawl.
- **Honest snapshots.** A probed map carries its source URL and capture time, so an agent can tell the user it read a copy, not the live site.
- **Your rules.** You decide every node, edge, page and action.

---

## Try it in 60 seconds

> Run these from your own project. If you are working inside the grapheway
> repository, use `bun run grapheway -- <command>` — `npx` resolves the local
> workspace there. If `npx` ever picks a stale cache, add `@latest`.

### If you run a website

```bash
npx grapheway init
```

It detects your framework, writes one config file, and mounts the agent surface. Then:

```bash
npx grapheway audit https://your-site.com
npx grapheway badge --url https://your-site.com --out badge.svg
```

`npx grapheway init --url https://your-site.com` builds the config from your existing site.

Works with Next.js, Express, Hono, plain Node, static hosts, Cloudflare Workers, Deno and Bun.

### If you just want to read a site

```bash
npx grapheway probe https://docs.example.com
```

That turns any public site into the same map and serves it locally — no involvement from the site required. Add `--no-serve --out ./graph` to export it instead.

### If you use an AI assistant

Use the hosted demo. No install:

```text
https://grapheway-mcp.usmani3923.workers.dev/mcp?url=https://expressjs.com
```

Paste this into Cursor, Claude Desktop, VS Code or any MCP client:

```json
{
  "mcpServers": {
    "grapheway": {
      "url": "https://grapheway-mcp.usmani3923.workers.dev/mcp?url=https://expressjs.com"
    }
  }
}
```

Change the `url` parameter to any public site. Or run it locally:

```bash
npx grapheway mcp --probe https://expressjs.com
```

---

## See the web as it is

We audited 30 of the documentation sites AI assistants read most.

- Average score: **28/100**
- Sites graded B or better: **0**
- Full reports: **[Agent Readiness Index](https://6yte96.github.io/grapheway/readiness/)**

The **[live adoption index](https://6yte96.github.io/grapheway/adopters/)** shows which sites have opened their door.

---

## How it works

```text
Your website / app
        │  one config
        ▼
┌─────────────────────────────────────┐
│  discovery  /.well-known/agent      │
│  map        /graph/v1               │
│  manifest   /agent                  │
│  tools      /mcp                    │
│  viewer     /graph                  │
└─────────────────────────────────────┘
        ▲                       ▲
   people / search        AI assistants
```

1. Describe your site once.
2. Grapheway serves the map and the tools.
3. Agents read the map instead of scraping.

---

## Who it is for

- **Docs and content teams** who want their site to show up correctly in AI answers.
- **SaaS and API companies** who want agents to use their product without a custom integration.
- **Agencies** who want a repeatable "make this site agent-ready" service.
- **AI builders** who want a clean way to read public web content without building a custom crawler.

---

## Questions people ask

**What is MCP?**
The Model Context Protocol is a common way for AI assistants to use tools and read content. Think of it as a standard port that lets Claude, Cursor, VS Code and other assistants plug into a site.

**What is a knowledge graph?**
A map of the site: pages and sections are the places, links are the roads between them. Agents can search the map and follow a route instead of guessing from raw HTML.

**Is it free?**
Yes. GPL-3.0. No account, no key, no paid crawler.

**Does the site owner have to install it?**
No. `grapheway probe` works on any public site. The runtime makes the map permanent and live.

**Is this just `llms.txt`?**
No. `llms.txt` is a static, hand-written file. Grapheway is a live map with search, links, actions and updates.

**Does it collect data?**
No. There is no telemetry. The adoption index is self-submitted and only checks each site's public agent card.

**What about security?**
The runtime is yours to control, and actions are opt-in. The hosted demo rejects private addresses, respects `robots.txt`, caps the number of pages and rate-limits requests.

**Is it ready for production?**
It is beta (`v0.2.8`). The core is small, tested and dependency-free. Read the [technical reference](https://github.com/6yte96/grapheway/blob/main/docs/technical-reference.md) before a large rollout.

---

## Learn more

- [Documentation](https://6yte96.github.io/grapheway/docs/)
- [Technical reference](https://github.com/6yte96/grapheway/blob/main/docs/technical-reference.md)
- [White paper](https://github.com/6yte96/grapheway/blob/main/docs/whitepaper.md)
- [Live adoption index](https://6yte96.github.io/grapheway/adopters/)
- [Agent Readiness Index](https://6yte96.github.io/grapheway/readiness/)
- [Launch notes and articles](https://github.com/6yte96/grapheway/tree/main/docs/launch)
- [Publishing pack](https://github.com/6yte96/grapheway/tree/main/docs/articles)
- [npm package](https://www.npmjs.com/package/grapheway)
- [Release notes](https://6yte96.github.io/grapheway/releases/)
- [GitHub releases](https://github.com/6yte96/grapheway/releases)
- [Contributing](https://github.com/6yte96/grapheway/blob/main/CONTRIBUTING.md)
- [Project and architecture](https://github.com/6yte96/grapheway/blob/main/PROJECT.md)
- [Product definition](https://github.com/6yte96/grapheway/blob/main/PRODUCT.md)
- [Release policy](https://github.com/6yte96/grapheway/blob/main/docs/RELEASE_POLICY.md)
- [Rules for AI agents](https://github.com/6yte96/grapheway/blob/main/AGENTS.md)

If this saves you a crawler, [star the repo](https://github.com/6yte96/grapheway) — it helps the next team find it.

---

## License

GPL-3.0.
