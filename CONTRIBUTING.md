# Contributing to grapheway

Thanks for your interest. This guide covers the day-to-day workflow.

Before your first change, read:

1. [`AGENTS.md`](./AGENTS.md) for the hard rules, including the release rules.
2. [`PROJECT.md`](./PROJECT.md) for the layout, commands and quality gates.
3. [`PRODUCT.md`](./PRODUCT.md) for the product and scope.
4. [`docs/RELEASE_POLICY.md`](./docs/RELEASE_POLICY.md) for how releases work.

## The most important rule

**A local change is not a release.**

Do not bump the version. Do not publish. Do not create a release. Development
happens on `dev`. Releases happen from `release/x.y.z` to `main`, one batch at a
time, with maintainer approval.

## Prerequisites

- [Bun](https://bun.sh) for install, build and tests.
- Node.js 20 or newer for compatibility checks.
- Git.
- Optional: [GitHub CLI](https://cli.github.com) for CI checks.

## Setup

```bash
git clone https://github.com/6yte96/grapheway.git
cd grapheway
git checkout dev
bun install
bun run build
bun test
```

## Project structure

```text
grapheway/
├─ packages/grapheway/
│  ├─ src/core/      graph model, discovery, manifest, JSON-LD
│  ├─ src/web/       handler, adapters, MCP, actions, viewer
│  ├─ src/probe/     crawler, graph builder, local server, export
│  ├─ src/compat/    llms.txt, agents.txt, robots.txt, sitemap
│  ├─ src/agent/     typed client
│  ├─ src/cli/       init, probe, mcp, gateway, audit, badge, serve
│  └─ test/          tests
├─ website/          Next.js landing page, docs, readiness, releases
├─ examples/         runnable example site
├─ deploy/           hosted MCP Worker
├─ docs/             whitepaper, technical reference, launch, articles
└─ scripts/          build and maintenance scripts
```

## Making a change

1. Branch from `dev`:

   ```bash
   git checkout dev
   git pull --ff-only
   git checkout -b feature/my-change
   ```

2. Make the change. Keep it focused.
3. Run the checks:

   ```bash
   npx tsc --noEmit
   bun test
   bun run build
   ```

4. If you changed the website:

   ```bash
   cd website
   bun run type-check
   bun run build
   ```

5. Commit with a clear message. Conventional prefixes are welcome:
   `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`.
6. Push your branch and open a pull request against `dev`.

Do not open a pull request against `main` unless it is a release PR from
`release/x.y.z`.

## Tests and build

```bash
bun test
bun test packages/grapheway/test/core
npx tsc --noEmit
bun run build
```

The build writes `dist/` bundles and type declarations. The CLI smoke test is:

```bash
node packages/grapheway/dist/cli/cli.js --help
```

## Code conventions

- TypeScript strict mode.
- Zero runtime dependencies in the core.
- Named exports.
- Tests use `bun:test`.
- No telemetry, no visitor tracking, no hidden agent instructions.
- No AI co-author trailers unless the maintainer asks.
- Keep public behavior documented in the README or technical reference.

## Pull request checklist

- [ ] The change is based on `dev`.
- [ ] No version bump.
- [ ] Typecheck, tests and build pass.
- [ ] The website builds if it changed.
- [ ] Docs and examples are updated if behavior changed.
- [ ] No telemetry or hidden prompt instructions were added.
- [ ] The PR explains what changed and how it was tested.

Use the pull request template for the full checklist.

## Releases

Releases are handled by the maintainer. The short version:

```text
dev  ->  release/x.y.z  ->  PR to main  ->  merge  ->  one release
```

A release PR:

- bumps the version exactly once;
- updates the changelog and release notes;
- carries the `release` label;
- passes the `Release guard`;
- is merged only with explicit approval.

See [`docs/RELEASE_POLICY.md`](./docs/RELEASE_POLICY.md) for the full checklist.

## License

By contributing, you agree that your contributions are licensed under GPL-3.0.
