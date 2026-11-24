# PROJECT.md

Technical overview of the grapheway repository. For the product story, read
[`PRODUCT.md`](./PRODUCT.md). For the operating rules for AI agents, read
[`AGENTS.md`](./AGENTS.md). For releases, read
[`docs/RELEASE_POLICY.md`](./docs/RELEASE_POLICY.md).

## What this repository is

Grapheway is an open protocol and runtime that lets a website publish its
content as a live, typed knowledge graph for AI agents. The same content is
served over HTTP, MCP, JSON and SSE. Agents can search it, walk it, read pages
as markdown and call site actions.

The repository contains:

- the npm package `grapheway`, with six subpath exports;
- a CLI: `init`, `probe`, `mcp`, `gateway`, `mcp-config`, `audit`, `badge`,
  `serve`, `generate`;
- a runnable example site;
- the landing page and docs site;
- a hosted MCP demo on Cloudflare Workers;
- the launch, article and release documentation.

**Status:** public beta. The current version is in
`packages/grapheway/package.json`. Do not assume production readiness.

## Stack

| Layer | Choice |
|---|---|
| Language | TypeScript, strict mode |
| Runtime | Node 20+, Bun, Deno, edge runtimes |
| Package manager | Bun workspaces |
| Tests | `bun:test` |
| Website | Next.js 15 static export |
| Hosting | GitHub Pages for the site, Cloudflare Workers for the hosted demo |
| License | GPL-3.0 |
| Runtime dependencies | Zero |

## Repository layout

```text
grapheway/
├─ packages/grapheway/
│  ├─ src/core/      graph model, discovery, manifest, JSON-LD
│  ├─ src/web/       runtime handler, adapters, MCP, viewer, actions
│  ├─ src/probe/     crawler, graph builder, local server, export
│  ├─ src/compat/    llms.txt, agents.txt, robots.txt, sitemap
│  ├─ src/agent/     typed client
│  ├─ src/cli/       init, probe, mcp, gateway, audit, badge, serve
│  ├─ test/          130 tests across 17 files
│  └─ SKILL.md       instructions for AI agents that consume a site
├─ website/          Next.js landing page, docs, readiness index, releases
├─ examples/         runnable example site
├─ deploy/           Cloudflare Worker for the hosted MCP demo
├─ docs/             whitepaper, technical reference, launch, articles
├─ scripts/          build, adopter checks, MCP registry publisher
├─ AGENTS.md         operating contract for AI agents
├─ PROJECT.md        this file
├─ PRODUCT.md        product definition
└─ CHANGELOG.md      release history
```

## Architecture

```text
config  ->  graph model  ->  runtime handler
                               ├─ /.well-known/agent  discovery
                               ├─ /graph/v1           graph, search, paths, SSE
                               ├─ /agent              manifest + actions
                               ├─ /mcp                MCP tools + resources
                               └─ /graph              interactive viewer
```

### Core

Pure data and pure functions. The graph model, discovery card, manifest,
JSON-LD, graph queries, patching and diffing. No Node APIs. Runs anywhere.

### Web

The framework-agnostic handler and adapters for `node:http`, Express, Hono and
the Web-standard Fetch API (Next.js App Router, Cloudflare Workers, Deno, Bun,
Vercel Edge). The MCP endpoint is a spec-aligned streamable HTTP server. The
viewer is a self-contained HTML page.

### Probe

A robots-aware, same-origin crawler that extracts titles, navigation,
headings, links and OpenAPI endpoints into a tagged graph. It can serve the
result locally or export `graph.json` and `config.json`. Probed graphs carry
snapshot metadata: `sourceUrl`, `capturedAt`, `snapshot`.

### Compat

Optional legacy files served at runtime: `llms.txt`, `agents.txt`,
`agents.json`, `robots.txt`, `sitemap.xml`. Used by the runtime and by static
hosts.

### Agent

A typed client for agents and tooling. It wraps discovery, graph queries,
actions, pages and realtime subscriptions.

### CLI

The main adoption path. `init` detects the framework and mounts the surface.
`probe` converts any public site. `mcp` runs a stdio server. `gateway` holds a
graph for many agents. `audit` scores a deployed site. `badge` emits an SVG.

## Commands

```bash
bun install
npx tsc --noEmit
bun test
bun run build
bun run example

bun run grapheway -- --help
bun run grapheway -- init
bun run grapheway -- probe https://expressjs.com --max-pages 5 --no-serve
bun run grapheway -- audit https://expressjs.com
bun run grapheway -- badge --score 92 --out badge.svg

cd website
bun run type-check
bun run build
```

Do not run `npx grapheway` inside the monorepo root. It resolves the local
workspace package. Use `bun run grapheway -- ...` or `npx -y grapheway@latest`.

## Quality gates

Every change must pass:

1. `npx tsc --noEmit`
2. `bun test`
3. `bun run build`
4. `node packages/grapheway/dist/cli/cli.js --help`
5. website typecheck and build when `website/` changed

CI runs the core checks on every push and pull request. The `Release guard`
runs on pull requests to `main`. The npm release job runs only when a version
change reaches `main`.

## Branch and release model

```text
feature/*, fix/*, docs/*, chore/*  ->  PR to dev  ->  merge
dev (code freeze)  ->  release/x.y.z  ->  PR to main  ->  merge  ->  one release
```

- `main` is the release branch and is protected.
- `dev` is the integration branch.
- `beta/*` is for stabilization when needed.
- `release/x.y.z` contains only the version bump, changelog, release notes and
  release-blocking fixes.
- Exactly one version bump per completed release batch.
- Do not publish from `dev` or `beta/*` to `latest`.
- See [`docs/RELEASE_POLICY.md`](./docs/RELEASE_POLICY.md) for the checklist.

## Environments and external systems

| System | Purpose | Who can change it |
|---|---|---|
| GitHub Actions | CI, release gate, Pages deploy | maintainer |
| npm | `grapheway` package | release gate only |
| Official MCP Registry | `io.github.6yte96/grapheway` | maintainer, after npm release |
| Cloudflare Workers | hosted MCP demo | maintainer |
| GitHub Pages | website | Pages workflow |

Secrets live in GitHub Actions secrets. Never print, commit or share them.

## Versioning

Semantic versioning.

- `0.x` means beta. Breaking changes are still possible, but they must be
  documented.
- Patch releases are fixes and docs.
- Minor releases are new capabilities.
- Pre-releases use `x.y.z-beta.N` and must not move the `latest` tag without
  approval.

The version must match in:

- `packages/grapheway/package.json`
- `packages/grapheway/src/core/types.ts`
- `server.json`
- website and README references
- `CHANGELOG.md`

## Definition of done

- Code is on `dev` or a short-lived branch off `dev`.
- Typecheck, tests and build pass.
- The website builds if it changed.
- Documentation and examples match the behavior.
- No telemetry or hidden agent instructions were added.
- No version bump happened outside a `release/*` branch.
- The pull request explains what changed and how it was tested.

## Documentation map

| Document | Purpose |
|---|---|
| `README.md` | Plain-English overview and quick start |
| `AGENTS.md` | Hard rules for AI agents |
| `PROJECT.md` | Repository, architecture and process |
| `PRODUCT.md` | Product vision, users and scope |
| `docs/RELEASE_POLICY.md` | Release rules and checklist |
| `docs/technical-reference.md` | Deep technical reference |
| `docs/whitepaper.md` | Architecture and rationale |
| `docs/launch/` | Launch, articles and content plan |
| `packages/grapheway/SKILL.md` | Instructions for agents consuming a site |
| `CHANGELOG.md` | Release history |

## Ownership

The repository is maintained by `@6yte96`. Changes to the release policy,
branch protection, npm publishing, the MCP registry or hosted infrastructure
require explicit maintainer approval.
