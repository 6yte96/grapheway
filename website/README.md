# Grapheway Landing Page

Static site for Grapheway, built on the [Broadsheet editorial template](https://github.com/6yte96/minimalism) (Next.js 15 App Router + Paper & Ink design system).

**Live at:** `https://6yte96.github.io/grapheway/`

## Content sources (all real, v0.2.2 Beta)

| Claim on page | Source |
|---------------|--------|
| 0 runtime dependencies | packages/grapheway/package.json |
| 14 agent routes | README route table |
| 6 subpath exports | packages/grapheway/package.json exports |
| 111 passing tests | bun test (13 files, 345 assertions) |
| 25 pages / 521 headings / 1,927 edges | real probe of expressjs.com |
| 6,061 lines, per-module counts | src/ tree |
| GPL-3.0 | LICENSE |

## Structure (reader's question order)

| Section | Answers |
|---------|---------|
| Hero | What is it, how do I run it |
| `#playground` Probe | What happens when I run it (real probe output) |
| `#features` Surface | What the agent surface exposes |
| `#benchmarks` Numbers | Probe vs scraping vs llms.txt |
| `#architecture` Source | The six modules, how to contribute |
| `#support` | Star, share, sponsor |

## Editing

All copy lives in [`project.config.ts`](./project.config.ts). Content rules in
[`CONTENT_RULES.md`](./CONTENT_RULES.md) (no dummy data, human phrasing,
no decorative chrome).

## Commands

```sh
bun run dev        # http://localhost:3000/grapheway
bun run build      # static export to out/
bun run type-check
```

## Deploy

`.github/workflows/pages.yml` builds and deploys on push to main touching
`website/**`. Pages must be set to Source: GitHub Actions (one-time repo setting).
The previous landing page lives in `docs/index.html` and stays in the repo as
the whitepaper companion page.
