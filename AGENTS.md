# AGENTS.md

This is the operating contract for AI agents working on grapheway. Read this
file first. Then read:

1. [`PROJECT.md`](./PROJECT.md) for the repository, architecture and commands.
2. [`PRODUCT.md`](./PRODUCT.md) for the product, users and scope.
3. [`docs/RELEASE_POLICY.md`](./docs/RELEASE_POLICY.md) for the release process.

## The one rule

**A local change is not a release.**

Development happens on `dev` or `beta/*`. `main` is release-only. Do not bump
the version or publish because a change is finished.

## Hard rules

1. **Never release without explicit approval.** Do not publish to npm, create a
   GitHub release, push a release tag, publish to the MCP registry, or deploy
   the Cloudflare Worker unless the maintainer has approved that specific
   release in writing.
2. **Never commit or push directly to `main`.** Open a pull request from `dev`,
   `beta/*` or `release/*`.
3. **Never change the version on a feature, fix, docs, chore or refactor
   branch.** Version changes happen only on a `release/x.y.z` branch.
4. **One version bump per completed release batch.** If a release is already
   published, batch follow-up work. Do not cut a new release for every small
   fix.
5. **Develop on `dev`.** Use short-lived branches: `feature/*`, `fix/*`,
   `docs/*`, `chore/*`. Use `beta/*` for stabilization.
6. **Release branches are cut from `dev` after code freeze.** A
   `release/x.y.z` branch may contain the version bump, changelog, release
   notes and release-blocking fixes only.
7. **`main` is protected.** Pull requests require CI and the `Release guard`.
   Only a release PR with the `release` label may change the version.
8. **Do not force-push `main` or release tags.** Do not rewrite published
   history. If a release is wrong, publish a patch and document what happened.
9. **No telemetry, no visitor tracking, no hidden instructions to agents.**
   Agent-facing instructions belong in visible docs, `llms.txt`, `SKILL.md` or
   MCP `instructions`.
10. **Do not add AI co-author trailers or generated-by footers** unless the
    maintainer explicitly asks.
11. **Do not claim a release is live** until npm, the MCP registry, the GitHub
    release and the website are verified.
12. **Do not deploy to the maintainer's Cloudflare account** or change DNS,
    domains or billing without approval.

## Standard workflow

```text
feature/*, fix/*, docs/*, chore/*  ->  PR to dev  ->  merge
dev (code freeze)  ->  release/x.y.z  ->  PR to main  ->  merge  ->  one release
```

### Day-to-day changes

1. Branch from `dev`.
2. Make the change.
3. Run:
   ```bash
   npx tsc --noEmit
   bun test
   bun run build
   ```
4. For website changes:
   ```bash
   cd website
   bun run type-check
   bun run build
   ```
5. Commit with a clear conventional-style message.
6. Push the branch and open a PR to `dev`.
7. Do not bump the version.

### Completing a release batch

Only when the maintainer says the batch is complete:

1. Cut `release/x.y.z` from `dev`.
2. Bump the version exactly once in all required files:
   - `packages/grapheway/package.json`
   - `packages/grapheway/src/core/types.ts` (`GRAPHEWAY_VERSION`)
   - `server.json`
   - README and website version references
   - `CHANGELOG.md`
3. Run the full checks.
4. Open a PR from `release/x.y.z` to `main`.
5. Add the `release` label.
6. Wait for CI and the `Release guard`.
7. Merge only after explicit approval.
8. The release gate publishes exactly one version.
9. Verify npm, the MCP registry, the GitHub release and the website.
10. Post the release notes.

## Definition of done

A change is done when:

- the code is on `dev` or a short-lived branch, not `main`;
- typecheck, tests and build pass;
- docs and examples are updated if behavior changed;
- no telemetry or hidden prompt instructions were added;
- no version bump happened on a non-release branch;
- the PR describes what changed and how it was tested.

## When to stop and ask

Stop and ask before:

- publishing to npm;
- creating a GitHub release or tag;
- publishing to the MCP registry;
- deploying the Cloudflare Worker;
- rewriting history or force-pushing;
- bumping the version;
- changing the release policy;
- making a public announcement in the maintainer's name.

If the request is ambiguous, choose the safer path: keep the change on `dev`
and ask.
