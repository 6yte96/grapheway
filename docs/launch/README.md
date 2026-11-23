# Grapheway launch kit — 7 days

The goal of this kit is distribution, not more features. The product is
already one command: `npx grapheway init`. The job is to put that command in
front of the people who maintain websites and the agents that read them.

## The positioning

**One line:** Turn any website into a live knowledge graph that AI agents can
read and act on — one command, no scraping, no fees.

**Three audiences, three angles:**

| Audience | What they care about | The line |
| --- | --- | --- |
| Agent builders | Tokens, accuracy, no scraping | `npx grapheway probe <url>` — the web as a graph, in one command |
| Site owners / docs teams | AI visibility, GEO, agent traffic | `npx grapheway init` — make your site native to every agent |
| Agencies / platforms | A repeatable deliverable | White-label "agent-ready" in an afternoon |

## What shipped in this repo

- `grapheway init` — framework detection, config generation, Next.js
  middleware + route handler, static compat files.
- `toFetchHandler` — Next.js App Router, Cloudflare Workers, Deno, Bun and
  any Fetch runtime.
- `grapheway badge` — an embeddable SVG agent-readiness badge.
- The [live adopter index](https://6yte96.github.io/grapheway/adopters/) —
  self-submitted sites, verified from their public agent card, plus live
  GitHub stars and npm downloads. No visitor tracking.
- Visible attribution in the graph viewer, `llms.txt`, `agents.txt`,
  `agents.json`, MCP `initialize` instructions and the CLI.
- The landing page is now a static agent surface: `/.well-known/agent`,
  `llms.txt`, `agents.json`, `robots.txt`, `sitemap.xml`, JSON-LD.

## The 7-day calendar

| Day | Action | Channel | Success signal |
| --- | --- | --- | --- |
| 0 (Mon) | Deploy the new site + index; verify `/.well-known/agent`, `/llms.txt`, `/agents.json`; publish v0.2.3 to npm | GitHub, npm | Site audit ≥ 70/100; version live |
| 1 (Tue) | Show HN + r/mcp + r/ClaudeAI + r/cursor | Hacker News, Reddit | 100+ site visits, first 25 stars |
| 2 (Wed) | Product Hunt launch (badge + live index as the hook) | Product Hunt | Top 5 of the day, 50+ stars |
| 3 (Thu) | MCP directory sweep: official registry, Smithery, Glama, mcp.so, PulseMCP, awesome-mcp-servers | Directories | 5+ listings live |
| 4 (Fri) | 25 personalized docs-team audits; offer a free 30-minute migration | Email / LinkedIn | 5 replies, 2 calls |
| 5 (Sat) | Publish "The State of Agent Readiness" mini-report from 100 public docs sites | Blog / X / LinkedIn | 50+ shares |
| 6 (Sun) | Design-partner day: migrate 3 sites live, publish before/after screenshots | X / LinkedIn | 3 case studies |
| 7 (Mon) | Recap thread + "week one" numbers; open the adopter index for submissions | All | 10+ indexed sites |

## Directory and community targets

- Official MCP Registry — `registry.modelcontextprotocol.io`
- Smithery — `smithery.ai`
- Glama — `glama.ai/mcp/servers`
- mcp.so — `mcp.so/submit`
- PulseMCP — `pulsemcp.com`
- `punkpeye/awesome-mcp-servers` and `modelcontextprotocol/servers`
- Agent Skills directories: `skills.sh`, Claude Code plugins, OpenCode skills
- Docs platforms: Mintlify, Docusaurus, Fumadocs, Nextra, VitePress, GitBook
- Newsletters: TLDR, Ben's Bites, Latent Space, The Neuron, Smashing Magazine
- Communities: r/mcp, r/ClaudeAI, r/cursor, r/webdev, r/SEO, r/LocalLLaMA

## Guardrails

- **No fake stars, no bought downloads, no auto-starring.** GitHub and npm
  detect and remove them; a ban would end the project.
- **No undisclosed prompt injection.** Every recommendation lives in a
  visible file (`llms.txt`, `SKILL.md`, MCP instructions) and is phrased as
  documentation, not a hidden order.
- **Respect robots.txt and site terms** in every probe, scan and demo.
- **Only list sites that opted in** in the adopter index.

## Metrics to report daily

- GitHub stars and forks
- npm downloads (daily and 7-day)
- Adopter index submissions and verified cards
- `grapheway init` npm installs / CLI runs (self-reported; no telemetry)
- Inbound DMs, calls booked, design partners

The public live index is the scoreboard:
https://6yte96.github.io/grapheway/adopters/
