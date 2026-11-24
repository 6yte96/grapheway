# AI Agents Can't Read Your Website: The 2026 Checklist

Your next visitor may not be a person.

It may be an AI assistant trying to answer a question about your product, your
pricing, your documentation or your availability. And there is a good chance
it is failing.

Most websites were built for people and search engines. An AI agent gets the
same HTML, strips the navigation, guesses which parts matter, and repeats the
process for every page. That is slow, expensive and easy to get wrong.

The fix is not another redesign. It is **agent readiness**: publishing your
site in a form AI agents can actually use.

I built [grapheway](https://github.com/6yte96/grapheway) around this idea. We
audited 30 of the documentation sites AI assistants read most. The average
score was **28/100**. **None** scored B or better. The problem was not the
quality of their content. It was that the content was not published in a form
agents could discover, read and act on.

Here is the checklist we use.

## What “agent readiness” actually means

An agent needs to do three things with your site:

1. **Find** the machine-readable surface.
2. **Read** the content without scraping HTML.
3. **Act** on the site when the user asks for something.

Most sites fail at all three. A sitemap helps search engines find pages, but it
does not tell an agent what the pages mean. A clean HTML page helps a human
read, but it still forces an agent to parse markup. A contact form lets a human
act, but it gives an agent nothing callable.

Agent readiness closes those gaps.

## The 7-point agent-readiness checklist

### 1. Publish a discovery card

Agents should not have to guess where your machine-readable surface lives.
Publish a small JSON document at:

```text
/.well-known/agent
```

It should say who you are, what the site exposes, and where the endpoints are.
Think of it as a business card for your website.

A useful card answers:

- What is this site?
- What can an agent do here?
- Where is the knowledge graph?
- Where is the MCP endpoint?
- Is authentication required?

If an agent has to read your homepage HTML to answer those questions, you have
already lost time and accuracy.

### 2. Publish a live map, not just a sitemap

A sitemap is a list of URLs. A knowledge graph is a map of meaning.

Pages become nodes. Sections become nodes. Links become edges. An agent can
search the graph, follow a link, and show the path it took to reach an answer.
That path is the citation.

At minimum, expose:

- a list of nodes and edges,
- search over node labels and metadata,
- a way to fetch one node,
- a way to fetch its neighbors,
- a shortest path between two nodes.

The difference matters. A sitemap tells an agent that `/pricing` exists. A
graph tells it that `/pricing` is connected to the Enterprise plan, the billing
FAQ and the contact action.

### 3. Serve clean markdown for important pages

Agents should be able to fetch a page as clean markdown, not as a wall of
navigation, cookie banners and scripts.

Expose a page endpoint that accepts a URL or a section name and returns the
content. Keep the original page as the source of truth. The markdown is a
reading view, not a second copy that drifts.

This one change removes most of the token cost and error rate of scraping.

### 4. Publish a manifest of what the site offers

A manifest tells an agent what exists before it starts clicking:

- site name and summary,
- contact details,
- curated sections,
- available actions,
- endpoint URLs.

This is also where you declare **actions**: things the agent can do, not just
read. “Check order status.” “Search the docs.” “Get a quote.” “Book a demo.”

Declare the action once. Expose it over HTTP and over MCP from the same
implementation. Do not build two versions that drift.

### 5. Open an MCP endpoint

MCP — the Model Context Protocol — is the common way AI clients connect to
tools. Claude Desktop, Cursor, VS Code and other clients can connect to a
single URL and see your graph tools and actions as native tools.

One endpoint. No custom integration for every assistant.

If you are not ready to host one, you can still give agents a local path:

```bash
npx -y grapheway@latest mcp --probe https://your-site.com
```

That runs a local MCP server for the site without changing the site.

### 6. Publish a clear AI crawler policy

Decide what AI crawlers may do, and say it in `robots.txt`.

A safe default is:

- allow search and retrieval crawlers,
- decide separately whether to allow training crawlers,
- keep the policy visible and easy to change.

Blocking every AI crawler removes you from AI answers. Allowing every crawler
may be wrong for your content. The important thing is that the decision is
explicit, not accidental.

### 7. Keep the basics: structured data and semantic HTML

Agents and search engines share some fundamentals:

- one clear H1,
- descriptive page titles and meta descriptions,
- Schema.org JSON-LD for the organization, website and key pages,
- server-rendered content rather than a blank JavaScript shell,
- internal links with useful anchor text.

These do not replace the graph and MCP layers, but they make everything else
more reliable.

## Score your site in 60 seconds

You can run the same audit we used for the 30-site study:

```bash
npx -y grapheway@latest audit https://your-site.com
```

You will get a score from 0 to 100, a grade, and the exact failed checks.

A rough reading:

| Score | Grade | What it means |
|---:|---|---|
| 90–100 | A+ | Fully agent-ready; agents can discover, read and act |
| 70–89 | B/A | Strong; a few gaps remain |
| 50–69 | C/D | Partial; agents fall back to scraping |
| 0–49 | F | Invisible to structured agents |

The score is not a judgment of your content. It measures whether the
agent-native surface exists.

## The 30-site reality check

We published the full results at
[the Agent Readiness Index](https://6yte96.github.io/grapheway/readiness/).
A few patterns stood out:

- The average score was **28/100**.
- **Zero** sites scored B or better.
- The best result was **54/100**.
- Many large, well-funded docs sites scored below 40.

These are not bad websites. They are good websites built for a web that did
not have agents as first-class readers. The gap is structural, not editorial.

## The 30-minute fix

If you maintain a Next.js, Express, Hono, Node or static site, start with:

```bash
npx -y grapheway@latest init
```

The command detects the framework, writes one config file, and mounts the
agent surface. Then:

```bash
npx -y grapheway@latest audit https://your-site.com
npx -y grapheway@latest badge --url https://your-site.com --out badge.svg
```

The badge is optional, but it is a useful signal: it tells visitors and other
teams that the site is agent-ready.

If you want to see the result first, connect an agent to the hosted demo:

```text
https://grapheway-mcp.usmani3923.workers.dev/mcp?url=https://expressjs.com
```

Swap the `url` parameter for your own site.

## Frequently asked questions

### Is this just SEO?

No. SEO helps a page rank in a search engine. Agent readiness helps an AI
assistant find, read and use the page while answering a question. The two
overlap, but they are not the same job.

### Is `llms.txt` enough?

`llms.txt` is a good start, but it is a static, hand-maintained file. It does
not support search, links between pages, actions or live updates. Use it as a
compatibility layer, not the whole strategy.

### Should I block AI crawlers?

That depends on your content and business model. Blocking training crawlers is
a common choice. Blocking search and retrieval crawlers usually removes you
from AI answers. Make the decision explicit in `robots.txt`.

### Will this expose private content?

No. The runtime only serves what you configure. Actions are opt-in. The probe
tool respects `robots.txt`, stays same-origin and rejects private addresses in
the hosted demo.

### Is it free?

Yes. Grapheway is GPL-3.0, with no account, API key or paid crawler.

## The takeaway

Agents are becoming a real audience. They do not browse the way people do, and
they should not have to scrape the way crawlers did.

Publish the map. Open the door. Then measure what agents can actually do.

Run the audit on your site today:

```bash
npx -y grapheway@latest audit https://your-site.com
```

If you want the full reports, start with the
[Agent Readiness Index](https://6yte96.github.io/grapheway/readiness/). If you
build this into your site, add it to the
[live adoption index](https://6yte96.github.io/grapheway/adopters/) so other
teams can see what good looks like.

---

*I built [grapheway](https://github.com/6yte96/grapheway), an open protocol
for agent-ready websites. It is free, open source and in beta. If this
checklist helped, star the repo — it helps the next team find it.*
