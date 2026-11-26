# Contributing to grapheway

Thanks for your interest. This guide covers the public contribution workflow.

## The most important rule

**A local change is not a release.**

Do not bump the version. Do not publish. Do not create a release. Development
happens on `dev`. Releases are handled by the maintainer from a
`release/x.y.z` branch to the protected `main` branch.

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
├─ docs/             whitepaper and technical reference
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

Do not open a pull request against `main` unless the maintainer asked you to
prepare a release.

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

## Out of scope

Unsolicited paid-integration, referral, crypto-settlement and third-party badge
pitches are not accepted. Do not add a paid upstream, wallet address, referral
tracking or a third-party vendor badge to the project.

## Release rules for contributors

- Do not change the version in `package.json`, `server.json`,
  `GRAPHEWAY_VERSION` or the changelog.
- Do not publish to npm or create a GitHub release.
- Do not push to `main`.
- `main` is protected and only accepts release pull requests from
  `release/x.y.z` with the `release` label.
- The maintainer decides when a batch is complete.

## Pull request checklist

- [ ] The change is based on `dev`.
- [ ] No version bump.
- [ ] Typecheck, tests and build pass.
- [ ] The website builds if it changed.
- [ ] Docs and examples are updated if behavior changed.
- [ ] No telemetry or hidden prompt instructions were added.
- [ ] The PR explains what changed and how it was tested.

## License

By contributing, you agree that your contributions are licensed under GPL-3.0.
