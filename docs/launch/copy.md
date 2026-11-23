# Launch copy

Use these as starting points. Keep the numbers real and link the live index.

## Show HN

**Title:** Show HN: Turn any website into an MCP server in one command

**Body:**

Most AI agents still read the web by scraping HTML: download the page, strip
the markup, guess the structure, repeat. It is slow, expensive and brittle.

Grapheway is an open protocol that lets a site publish its content as a live,
typed knowledge graph instead. One install gives agents:

- `/.well-known/agent` — discovery
- `/graph/v1` — nodes, edges, search, paths, SSE updates
- `/agent` — manifest and actions
- `/mcp` — a real Model Context Protocol endpoint

For sites that have not opted in, `npx grapheway probe <url>` converts any
public site into the same graph locally — no site involvement. The probe
respects robots.txt and stays same-origin.

The new part is the 60-second path:

```bash
npx grapheway init
```

It detects Next.js / Express / Hono / static hosts, writes the config, and
mounts the surface. Next.js gets a middleware + route handler; static hosts
get `llms.txt`, `agents.txt`, `agents.json`, `robots.txt` and `sitemap.xml`.
There is also `grapheway audit <url>` for a 0–100 score and `grapheway badge`
for an embeddable SVG.

The core is zero-dependency TypeScript and runs on Node 20+, Bun, Deno and
edge runtimes. GPL-3.0. No account, no API key, no paid crawler.

Live index of sites that publish an agent surface:
https://6yte96.github.io/grapheway/adopters/

Repo: https://github.com/6yte96/grapheway

I would love feedback on the protocol shape, the Next.js adapter, and which
docs platform to support next.

## Product Hunt

**Tagline:** Make your website native to every AI agent.

**Description:**

Grapheway turns your site into a live knowledge graph with an open MCP
endpoint. Agents stop scraping HTML and start walking typed nodes. Run
`npx grapheway init` and your site exposes discovery, graph search, actions
and MCP in under a minute. Works with Next.js, Express, Hono and static hosts.

**First comment:**

We built this because every agent demo ends the same way: a pile of HTML
scraping. Grapheway flips it — the site publishes its own graph, and agents
read it. The probe works on any site today; the runtime makes it permanent.
The live index shows which sites are already agent-ready. Try the audit on
your own site and tell us what breaks.

## X / Twitter thread

1. AI agents still read the web by scraping HTML. We think sites should open
   their own door. Today we're launching grapheway: `npx grapheway init` turns
   any website into a live knowledge graph + MCP server. 🧵
2. The surface: `/.well-known/agent` for discovery, `/graph/v1` for typed
   nodes and auditable paths, `/agent` for actions, `/mcp` for Claude, Cursor
   and VS Code. One graph, every agent.
3. No opt-in? `npx grapheway probe https://any-site.com` converts the site
   locally, respects robots.txt, and serves the same surface on localhost.
4. The 60-second path: `npx grapheway init` detects Next.js / Express / Hono
   / static, writes the config, and mounts the handler. Static hosts get
   llms.txt, agents.txt, robots.txt and sitemap.xml for free.
5. Score any site: `npx grapheway audit https://your.site`. Embed the result:
   `npx grapheway badge --url https://your.site`. Watch the live index grow:
   https://6yte96.github.io/grapheway/adopters/
6. Zero dependencies, Node 20+, Bun, Deno, edge. GPL-3.0. No account, no API
   key, no paid crawler. If it saves you a crawler, star the repo:
   https://github.com/6yte96/grapheway

## Reddit (r/mcp)

**Title:** I built a protocol that turns any website into an MCP server (no scraping)

**Body:**

The MCP ecosystem has thousands of servers, but most are wrappers around one
API. The web itself is still unstructured. Grapheway makes the site publish a
graph: pages/sections are typed nodes, links are edges with provenance, and
the same graph is exposed over MCP.

- `npx grapheway probe <url>` — any public site, no opt-in
- `npx grapheway init` — mount it in your own site
- `npx grapheway audit <url>` — 0–100 agent-readiness score
- `npx grapheway badge --url <url>` — embeddable badge

I'd especially value feedback on the MCP tool names (`graph_node`,
`graph_neighbors`, `graph_search`, `graph_path`) and the discovery card.
Repo: https://github.com/6yte96/grapheway

## Cold email — docs teams

**Subject:** Your docs score 42/100 for AI agents — here's the 10-minute fix

Hi <name>,

I ran an agent-readiness audit on <site>: <score>/100. The gaps are usually
the same: no `llms.txt`, no structured graph, no MCP endpoint. Agents fall
back to scraping, which is slower and less accurate for your users.

Grapheway is open source and mounts in one command:

```bash
npx grapheway init --url https://<site>
```

It generates the config from your existing sitemap/nav and exposes discovery,
graph search and MCP. I can send the full audit or do a 20-minute migration
with you — no charge, I'm looking for three design partners and a public
before/after.

<name>

## Directory submission blurb

**Name:** Grapheway

**Short description:** Turn any website into a live knowledge graph and MCP
server. `npx grapheway probe <url>` for any site; `npx grapheway init` for
your own. Zero dependencies, no scraping, no fees.

**Categories:** developer tools, web, knowledge graph, MCP, agent infrastructure

**Links:** https://github.com/6yte96/grapheway · https://6yte96.github.io/grapheway/ · https://www.npmjs.com/package/grapheway
