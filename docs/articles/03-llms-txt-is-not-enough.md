# llms.txt Is Not Enough: AI Search Needs a Live Graph

`llms.txt` was a useful first step.

It gave websites a simple, human-readable file that told AI tools what the site
was about and where the important pages lived. Many teams added one.
Many still maintain one today.

But a static file is not a strategy.

AI search is moving from "read a page" to "use the site." Assistants are not
just summarizing content; they are searching, comparing, following links and
taking actions. A flat text file cannot keep up with that.

This is the gap that **generative engine optimization (GEO)** has to close, and
why a live knowledge graph matters more than another checklist item.

## What `llms.txt` does well

Credit where it is due. `llms.txt` is:

- **simple**: one file, plain markdown, easy to write;
- **cheap**: no server, no runtime, no build step;
- **readable**: both humans and models can parse it;
- **a good fallback**: clients that do not support anything else can still
  find the important pages.

If your site has no machine-readable surface at all, adding `llms.txt` is a
clear improvement. Keep it.

But it is a snapshot, not a system.

## The three limits of a static file

### 1. It goes stale

A human edits `llms.txt` when they remember. The site changes every day:
pricing pages, docs, changelogs, new products, new locations. The file drifts.

An agent that trusts a stale file gives a stale answer. That is worse than
scraping, because the error is harder to notice.

### 2. It is flat

`llms.txt` is a list of links with notes. It does not encode relationships.

It cannot tell an agent that the Enterprise plan is connected to the billing
FAQ, the security page and the contact action. It cannot rank a page for a
query. It cannot show a path from "pricing" to "refund policy."

A sitemap has the same problem: it knows URLs, not meaning.

### 3. It is passive

The best agent experience is not just reading. It is doing.

"Check if this order shipped." "Search the docs for a migration guide." "Get a
quote for 50 seats." A text file cannot expose an action. An agent has to find
a form, guess the fields and hope the site allows it.

## The difference in one table

| Approach | Fresh | Searchable | Relationships | Actions | Auditable |
|---|---|---|---|---|---|
| HTML scraping | Live | No | Guessed | No | No |
| `sitemap.xml` | Live | No | No | No | No |
| `llms.txt` | Manual | No | No | No | No |
| Knowledge graph + MCP | Live | Yes | Yes | Yes | Yes |

This is not an argument for deleting `llms.txt`. It is an argument for adding
the layer above it.

## What AI search actually needs

If you want AI assistants to find, cite and use your site, give them six
things:

### 1. Discovery

A predictable place that says what the site exposes:

```text
/.well-known/agent
```

No guessing. No reading the homepage HTML to infer the API.

### 2. Structure

A typed map of pages, sections and links. Pages become nodes. Links become
edges. The agent can search the map and follow a route.

This is the difference between "here is a list of URLs" and "here is how the
site is put together."

### 3. Search

An agent should be able to ask "where is the refund policy?" without crawling
every page. A graph search endpoint returns ranked nodes, not a pile of HTML.

### 4. Trust

Every edge should say where it came from and how confident it is.

- **Extracted**: the site declared it or a page linked it directly.
- **Inferred**: computed with clear evidence.
- **Ambiguous**: best-effort; verify before relying on it.

When an agent answers from the graph, it can show the path and the evidence.
That is a citation, not a guess.

### 5. Actions

Content answers questions. Actions complete tasks.

Expose the actions you already have, such as status, search, booking, or a quote.
Expose them once, over both HTTP and MCP. Do not build a separate integration for every
assistant.

### 6. Freshness

When the site changes, the graph should change with it. A live endpoint can
push updates to subscribers instead of waiting for the next crawl.

A static file cannot do that. A graph can.

## Keep `llms.txt`. Add the graph.

The migration is additive, not a rewrite:

1. **Keep your existing `llms.txt`.** It is a useful compatibility layer.
2. **Add discovery.** Publish `/.well-known/agent` with your endpoints.
3. **Publish the graph.** Expose nodes, edges, search and paths.
4. **Add MCP.** Let clients call the graph tools and your actions directly.
5. **Audit and iterate.** Measure which pages agents actually use.

If you run a modern framework, the first three steps can be one command:

```bash
npx -y grapheway@latest init
```

If you do not control the site, you can still build the graph locally:

```bash
npx -y grapheway@latest probe https://expressjs.com
```

Then audit the result:

```bash
npx -y grapheway@latest audit https://your-site.com
```

## The data: good sites still fail

We audited 30 of the documentation sites AI assistants read most. These are
well-funded, well-written, high-traffic sites.

- Average score: **28/100**
- Sites graded B or better: **0**
- Best score: **54/100**

The gap is not content quality. It is the absence of an agent-native layer:
discovery, graph, actions and MCP.

The full reports are public at
[the Agent Readiness Index](https://6yte96.github.io/grapheway/readiness/).
If your site is not listed, run the audit and see your own gaps.

## Frequently asked questions

### Is `llms.txt` dead?

No. It is still a useful, low-cost fallback. The mistake is treating it as the
whole strategy.

### Does a knowledge graph replace SEO?

No. SEO helps pages rank in search engines. A graph helps agents find, read and
use the site while answering a question. They complement each other.

### Do I need MCP?

If you want assistants to call tools and actions, yes. If you only need them to
read content, a graph plus clean markdown is already a big improvement.

### Will this help me appear in AI answers?

It makes your site easier for agents to discover, read and cite. That is a
necessary condition, not a guarantee. No honest tool can promise a specific
placement in an AI answer.

### Is it free?

Grapheway is GPL-3.0, with no account, API key or paid crawler. The hosted demo
is rate-limited; run your own for production.

## The bottom line

`llms.txt` told agents that your site exists. A live graph tells them what it
means, how it connects, and what they can do with it.

Keep the file. Add the map. Then measure what agents can actually accomplish.

```bash
npx -y grapheway@latest audit https://your-site.com
```

Start with the [readiness report](https://6yte96.github.io/grapheway/readiness/),
then add your site to the
[live adoption index](https://6yte96.github.io/grapheway/adopters/) when it is
ready.

---

*I built [grapheway](https://github.com/6yte96/grapheway), an open protocol
for agent-ready websites. It is free, open source and in beta. If this was
useful, star the repo. It helps the next team find it.*
