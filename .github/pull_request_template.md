## Summary

What changed and why?

## Type

- [ ] Feature
- [ ] Fix
- [ ] Docs
- [ ] Chore / refactor
- [ ] Release (only from `release/x.y.z`)

## Release impact

- [ ] No version change. This is day-to-day work.
- [ ] Version change. This PR is from `release/x.y.z`, has the `release` label,
      and is the only version bump in this batch.

## Testing

What did you run?

- [ ] `npx tsc --noEmit`
- [ ] `bun test`
- [ ] `bun run build`
- [ ] `node packages/grapheway/dist/cli/cli.js --help`
- [ ] Website typecheck and build, if `website/` changed

## Checklist

- [ ] The change is based on `dev`.
- [ ] No version bump outside a release branch.
- [ ] Docs and examples are updated if behavior changed.
- [ ] No telemetry, visitor tracking or hidden agent instructions.
- [ ] I read `AGENTS.md`, `PROJECT.md`, `PRODUCT.md` and
      `docs/RELEASE_POLICY.md`.
- [ ] This PR does not publish, tag or announce a release.
