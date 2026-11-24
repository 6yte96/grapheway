# Release policy

Hard rules for releasing grapheway. This document exists because releases were
being cut too often. A release is a deliberate event, not a side effect of a
finished local change.

Read [`AGENTS.md`](../AGENTS.md) first. For the repository and process, read
[`PROJECT.md`](../PROJECT.md).

## The rules

1. **One release per completed batch.** Do not publish a new version for every
   fix, doc change or small feature. Batch the work.
2. **Development happens on `dev` or `beta/*`.** `main` is release-only.
3. **Version changes only on `release/x.y.z`.** A feature, fix, docs or chore
   branch must never change the version.
4. **Only `main` can release.** `dev` and `beta/*` may publish prereleases to a
   non-`latest` tag only with explicit approval.
5. **The release gate decides, not a human memory.** A push to `main` publishes
   only when the package version changed in that push and the version is
   internally consistent.
6. **Every release needs notes.** Changelog, GitHub release and website release
   notes must all describe the same version.
7. **No release without verification.** npm, the MCP registry, the GitHub
   release and the website must be checked after publishing.
8. **No direct pushes to `main`.** Pull requests only.
9. **No force-pushes to `main` or release tags.** No rewriting published
   history.
10. **No silent releases.** The maintainer approves the release PR in writing.

## Branch model

```text
feature/*, fix/*, docs/*, chore/*  ->  PR to dev  ->  merge
dev (code freeze)  ->  release/x.y.z  ->  PR to main  ->  merge  ->  one release
```

| Branch | Purpose | Rules |
|---|---|---|
| `main` | Released code | Protected, PR only, release PRs only |
| `dev` | Integration | All feature/fix/docs PRs land here |
| `beta/*` | Stabilization | Optional, for larger releases |
| `release/x.y.z` | Release batch | Only version, changelog, notes, release fixes |
| `feature/*`, `fix/*`, `docs/*`, `chore/*` | Short-lived work | Branch from `dev`, PR back to `dev` |

## Versioning

Semantic versioning.

- `0.x.y` is beta. Breaking changes are possible but must be documented.
- Patch: fixes, docs, small internal changes.
- Minor: new capabilities.
- Major: breaking protocol or API changes.
- Pre-release: `x.y.z-beta.N`. Pre-releases must not move the `latest` tag
  without approval.

The version must match in all of these files:

- `packages/grapheway/package.json`
- `packages/grapheway/src/core/types.ts` (`GRAPHEWAY_VERSION`)
- `server.json`
- `README.md` and `packages/grapheway/README.md`
- `website/project.config.ts`
- `website/public/.well-known/agent`
- `CHANGELOG.md`
- `deploy/cloudflare-worker/src/index.ts` (hosted demo version)

The release gate fails if the versions disagree.

## Release checklist

Only start this checklist when the maintainer says the batch is complete.

### 1. Code freeze

- [ ] All intended PRs are merged to `dev`.
- [ ] `dev` is green: typecheck, tests, build.
- [ ] No new features are being added to the batch.
- [ ] The website builds if it changed.

### 2. Cut the release branch

```bash
git checkout dev
git pull --ff-only
git checkout -b release/x.y.z
```

### 3. Bump the version once

Update every file in the version list above. Add the `CHANGELOG.md` entry with
the date, the added/changed/fixed sections and any migration notes.

Do not bump the version again during the same batch.

### 4. Add release notes

- Add the release to `website/src/app/releases/page.tsx`.
- Keep the notes short: what changed, who it is for, any breaking change.
- Link the GitHub release after it exists.

### 5. Verify locally

```bash
npx tsc --noEmit
bun test
bun run build
node packages/grapheway/dist/cli/cli.js --help
cd website
bun run type-check
bun run build
```

Optionally pack and install the tarball in a temp project:

```bash
cd packages/grapheway
npm pack --pack-destination /tmp/grapheway-release
```

### 6. Open the release PR

- Base: `main`
- Head: `release/x.y.z`
- Rebase the release branch on `main`, or merge `main` into it, before
  opening the PR. `main` uses strict status checks, so the head branch must be
  up to date.
- Title: `release: vX.Y.Z`
- Label: `release`
- Include the changelog and the verification output.

The `Release guard` must pass. It rejects version changes on non-release
branches and requires the `release` label.

### 7. Merge and publish

- Merge only after explicit maintainer approval.
- The push to `main` triggers the release gate.
- The gate publishes only when the version changed in that push.
- If the version did not change, the gate skips publishing. That is correct.

### 8. Verify the release

- [ ] `npm view grapheway version` matches the release.
- [ ] The tarball returns HTTP 200.
- [ ] `npx -y grapheway@X.Y.Z --help` works.
- [ ] The MCP registry shows the new version.
- [ ] The GitHub release exists and is latest.
- [ ] The website shows the new version.
- [ ] The release notes page is live.
- [ ] The discussion announcement is posted.

### 9. Announce

- Comment on the relevant discussion.
- Create or update the release announcement.
- Do not claim metrics that are not verified.

## What the release gate checks

The `publish.yml` workflow has a `Release gate` job. It runs on every push to
`main` and every PR to `main`.

On a PR:

- runs typecheck and tests;
- does not publish.

On a push to `main`:

- compares `packages/grapheway/package.json` in the pushed range;
- if the version did not change, skips publishing;
- if the version changed, verifies:
  - `package.json` version;
  - `GRAPHEWAY_VERSION`;
  - `server.json` version;
  - `CHANGELOG.md` has an entry for the version;
  - the version is not already on npm;
  - the version is greater than the current `latest`.
- publishes exactly once.

On a manual dispatch:

- requires the `confirm` input to equal `publish`;
- still runs the version checks;
- is reserved for recovery, not routine releases.

## Protection rules in force

The repository enforces the policy, not just the docs:

- **`main` branch:** pull request required, required checks are `test`,
  `Release guard`, `Release gate` and `Typecheck & tests`, admins are subject to
  the rules, force pushes and deletions are blocked, and conversations must be
  resolved before merging.
- **`npm-release` environment:** the npm publish job requires approval from
  `@6yte96` and only runs for protected branches.
- **`v*` tags:** a repository ruleset blocks deletion and update of release
  tags.
- **`release` label:** required on any pull request to `main` that changes the
  version.
- **`automation` label:** used for the daily adopter index PR.

If a rule is changed, update this section in the same pull request.

## Hotfixes

A hotfix still follows the release process, but it may be a single patch.

1. Branch `fix/...` from `dev`.
2. Fix, test, PR to `dev`.
3. Cut `release/x.y.(z+1)` from `dev`.
4. Bump once, changelog, notes.
5. PR to `main` with the `release` label.
6. Merge after approval.
7. Verify and announce.

Do not publish from a feature branch. Do not bypass the release gate.

## Rollback

- Never unpublish a version that users may depend on.
- If a release is broken, publish a patch.
- Document the incident in the changelog.
- If npm is in a bad state, stop and ask the maintainer before trying again.

## Beta and prerelease policy

- `beta/*` branches may produce `x.y.z-beta.N` builds.
- Pre-releases go to the `next` dist-tag, never `latest`, and only with explicit
  approval.
- A pre-release is not a substitute for the release checklist.
- The hosted demo may run a newer build than npm only if the website says so.

## Approval gates

Explicit maintainer approval is required before:

- publishing to npm;
- creating a GitHub release or tag;
- publishing to the MCP registry;
- deploying the Cloudflare Worker;
- changing branch protection;
- changing the release policy;
- making a public announcement in the maintainer's name.

## Prohibited

- Bumping the version on a feature, fix, docs or chore branch.
- Publishing on every push to `dev`.
- Creating a release for a single small fix.
- Force-pushing `main`.
- Moving or deleting a release tag.
- Publishing with mismatched versions.
- Shipping without a changelog entry.
- Claiming a release is live before verification.
- Buying or faking stars, downloads or usage.

## Responsibilities

The maintainer owns the release decision. Agents and contributors prepare the
release, run the checks and provide evidence. An agent may not decide that a
batch is complete.
