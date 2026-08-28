# Contributing to Grapheway

Thanks for your interest in contributing! This guide covers the development workflow.

## Prerequisites

- [Bun](https://bun.sh) (used for install, build, and test)
- [Node.js](https://nodejs.org) 18+ (for compatibility testing)
- [GitHub CLI](https://cli.github.com) (optional, for CI verification)

## Getting started

```bash
git clone https://github.com/6yte96/grapheway.git
cd grapheway
bun install
bun run build
bun test
```

## Project structure

```
grapheway/
├─ packages/
│  ├─ core/       grapheway           — graph model, discovery, manifest (zero deps)
│  ├─ web/        @grapheway/web      — runtime endpoint + adapters + MCP
│  ├─ probe/      @grapheway/probe    — convert any site into a graph
│  ├─ compat/     @grapheway/compat   — optional legacy files
│  ├─ agent/      @grapheway/agent    — typed client + skill
│  └─ cli/        @grapheway/cli      — gateway / probe / mcp-config / serve / audit / generate
├─ examples/
│  └─ simple-site/                    — runnable demo
├─ scripts/
│  └─ build.mjs                       — esbuild bundle script
└─ .github/workflows/
   ├─ build-dev.yml                   — dev branch: build + test + commit artifacts
   └─ publish.yml                     — main branch: build + test + publish to npm
```

## Development workflow

### Making changes

1. Create a branch from `dev`:
   ```bash
   git checkout -b feature/my-change dev
   ```

2. Make your changes. The source is in `packages/*/src/`.

3. Build and test:
   ```bash
   bun run build
   bun test
   npx tsc --noEmit
   ```

4. Push to your branch. The `build-dev` workflow runs automatically on `dev`.

### Running tests

```bash
bun test                    # all tests
bun test packages/core      # one package
```

### Building

```bash
bun run build               # all packages
```

This compiles each package's `src/` to `dist/` (JS bundles + `.d.ts` declarations) using esbuild.

### Type checking

```bash
npx tsc --noEmit
```

## Package conventions

- **Zero dependencies** for `grapheway` (core). Other packages may depend on core.
- **Framework adapters** go in `@grapheway/web` — each adapter is ~10 lines.
- **Tests** live in `packages/*/test/` alongside the source.
- **No external runtime dependencies** in the agent-facing packages (`@grapheway/agent`, `@grapheway/probe`).
- All packages compile to `dist/` with both JS bundles and TypeScript declarations.

## Code style

- TypeScript strict mode
- No external runtime dependencies in core
- Named exports (no default exports)
- Tests use `bun:test` (`describe`, `it`, `expect`)

## Submitting changes

1. Push your branch
2. Open a PR against `dev`
3. The CI runs build + typecheck + tests automatically
4. After review and merge to `dev`, the build pipeline commits tarballs to `artifacts/`
5. After merge to `main`, packages are published to npm

## License

By contributing, you agree that your contributions will be licensed under the GPL-3.0 license.
