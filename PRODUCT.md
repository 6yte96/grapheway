# PRODUCT.md

The product definition for grapheway. For the repository and process, read
[`PROJECT.md`](./PROJECT.md). For the operating rules for agents, read
[`AGENTS.md`](./AGENTS.md).

## Vision

**Every website should have an open door for AI agents.**

Today, an assistant that needs an answer from a site usually downloads HTML,
strips the markup, guesses what matters and repeats the process for every page.
That is slow, expensive and fragile. The site knows its own structure. It should
be able to publish it.

Grapheway is that open door: a live, typed map of the site, plus the tools an
agent needs to read and act on it.

## The problem

### For site owners

AI assistants are becoming a real audience. They cite pages, answer questions
and recommend products. But most sites are invisible to them in a structured
way. The site has a sitemap for search engines and nothing for agents.

### For AI builders

Every agent needs to read the web. Every team rebuilds the same crawler,
markdown converter and retry logic. The result is inconsistent, expensive and
hard to cite.

### For the web

The default is scraping. Scraping is brittle, ignores the site's intent and
gives agents no reliable way to say where an answer came from.

## Users

### 1. Documentation and content teams

They want their content to be read correctly by AI assistants, cited in AI
answers and kept fresh. They care about structured data, `llms.txt`, MCP and
agent traffic.

### 2. SaaS and API companies

They want agents to use their product without a custom integration per
assistant. They care about actions, authentication, reliability and control.

### 3. Agencies and platform teams

They want a repeatable "make this site agent-ready" service. They care about
audits, badges, reports and a clear before/after.

### 4. AI builders and agent platforms

They want a clean, permission-friendly way to read public web content. They
care about speed, token cost, graph traversal and citations.

## Jobs to be done

- "Help me find out whether my site is readable by AI agents."
- "Make my site readable and actionable without a six-month project."
- "Let an assistant read this site without scraping it."
- "Show me where an answer came from."
- "Let an agent do something on the site, not just read it."
- "Keep the agent's view fresh when the site changes."

## Value proposition

**One command to make a website agent-ready. One endpoint for any agent to
read it.**

- `npx grapheway init` mounts the surface on your site.
- `npx grapheway probe <url>` converts any public site without opt-in.
- `npx grapheway mcp --probe <url>` gives local agents an MCP server.
- `npx grapheway audit <url>` scores a deployed site from 0 to 100.
- `npx grapheway badge --url <url>` gives an embeddable signal.

No account. No API key. No paid crawler. No telemetry.

## Principles

1. **Open by default.** An open protocol and an open-source runtime. No gatekeeper
   between a site and an agent.
2. **The site owns the truth.** The site decides every node, edge, page and
   action. Grapheway does not invent content behind the owner's back.
3. **Readable is not enough.** Agents need to act. Actions are first-class.
4. **Show the work.** Paths, provenance and snapshot metadata make answers
   auditable.
5. **Progressive adoption.** Start with an audit, then a probe, then a runtime.
   No big-bang migration.
6. **Honest snapshots.** A probe is a copy. The product says when it was
   captured and where it came from.
7. **No surveillance.** No telemetry, no visitor tracking, no hidden
   instructions to agents.
8. **Small surface, small dependencies.** Zero runtime dependencies in the core.
   The code should be easy to read and easy to leave.

## Scope

### In scope

- site discovery, knowledge graph, search and paths;
- MCP over HTTP and stdio;
- page content as markdown;
- site actions over HTTP and MCP;
- a probe for public sites;
- audits, badges and readiness reports;
- an adoption index and a public readiness index;
- framework adapters and static-host compatibility;
- release and launch documentation.

### Out of scope

- a general-purpose web crawler at scale;
- bypassing paywalls, logins or `robots.txt`;
- training models;
- selling or sharing visitor data;
- a hosted analytics product that tracks users;
- replacing a site's existing search, CMS or auth;
- guaranteeing rankings in AI answers.

## Current stage

Public beta. The current release is in
`packages/grapheway/package.json`. Adoption is early. Do not use invented
traction numbers in public copy. The public indexes are the source of truth.

## Metrics

**North star:** weekly agent requests to grapheway-enabled surfaces.

Supporting metrics:

- active sites with a working discovery card;
- `grapheway init` and `probe` usage;
- MCP connections;
- npm downloads;
- GitHub stars;
- adopter index submissions;
- readiness score distribution;
- design partners and case studies.

Guardrail metrics:

- audit false positives;
- crawl failures;
- security reports;
- time to first successful probe;
- time to first successful `init`.

Do not buy, fake or automate any of these metrics.

## Roadmap

### Now

- stabilize `init`, `probe`, `mcp`, `audit` and `badge`;
- keep the hosted demo reliable and rate-limited;
- improve snapshot and provenance metadata;
- grow the readiness and adoption indexes;
- publish the three launch articles and the 7-day plan.

### Next

- docs-platform plugins: Docusaurus, Mintlify, Fumadocs, Nextra, VitePress;
- optional auth and rate limits for production actions;
- a multi-site gateway with namespaced tools;
- a hosted adoption index with claimable listings;
- a real conformance suite for the protocol;
- a public specification and versioning policy.

### Later

- partner integrations with MCP clients and agent frameworks;
- agency certification;
- hosted services that do not require visitor tracking;
- a sustainable funding model for the protocol and hosted pieces.

## Positioning

**Category:** agent readiness, agent experience (AX), the agent-native web.

**One line:** Turn any website into a live knowledge graph and MCP server.

**For site owners:** Make your site native to every AI agent.

**For AI builders:** Read the web as a graph, not a pile of HTML.

**Against `llms.txt`:** `llms.txt` is a static file. Grapheway is a live map
with search, paths, actions and snapshot provenance.

**Against scraping:** Scraping guesses. A graph cites.

## Licensing and business model

- Core and runtime: GPL-3.0.
- No account, no API key, no paid crawler.
- The hosted demo is free and rate-limited.
- Future hosted services may be paid, but the protocol and core stay open.
- No selling or sharing of visitor data.

## Risks

- **Cold start:** sites need a reason to publish; agents need sites to publish.
  The probe and hosted demo reduce this by working without opt-in.
- **Standards drift:** MCP and agent discovery are moving targets. Keep the
  surface versioned and small.
- **Trust:** actions can be dangerous. Default to read-only, opt-in actions and
  clear limits.
- **License:** GPL-3.0 limits some commercial adoption. Revisit only with a
  deliberate, documented decision.
- **Hype:** do not promise rankings, traffic or "AI SEO" miracles. Publish
  what the audit can prove.

## Decision principles

When two options are close:

1. Choose the one that keeps the site in control.
2. Choose the one that makes the agent's answer more auditable.
3. Choose the one that works without an account.
4. Choose the smaller surface.
5. Choose the one we can explain in one sentence.
