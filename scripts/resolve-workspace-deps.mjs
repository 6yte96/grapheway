#!/usr/bin/env node
/**
 * CI-only helper for .github/workflows/publish.yml.
 *
 * Rewrites `workspace:` protocol dependencies in every package.json under
 * packages/ to concrete versions, because npm (even 10.x) does NOT reliably
 * rewrite them
 * when packing/publishing a workspace — a published manifest that still says
 * `"grapheway": "workspace:*"` cannot be installed by consumers.
 *
 * Runs only on the ephemeral GitHub runner; the repo itself keeps
 * `workspace:*` so local development keeps working.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packagesDir = join(root, "packages");

// First pass: index every workspace package by name -> { dir, version }.
const workspaces = new Map();
for (const dir of readdirSync(packagesDir)) {
  const file = join(packagesDir, dir, "package.json");
  let json;
  try {
    json = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    continue; // no package.json (e.g. stray dir)
  }
  if (json.name && json.version) workspaces.set(json.name, { dir, version: json.version });
}

/** Map a workspace spec to a concrete semver range. */
function resolveSpec(spec, version) {
  if (spec === "workspace:*") return version;
  if (spec === "workspace:^") return `^${version}`;
  if (spec === "workspace:~") return `~${version}`;
  return spec; // already pinned, e.g. "workspace:0.1.0"
}

let changed = 0;
for (const { dir } of workspaces.values()) {
  const file = join(packagesDir, dir, "package.json");
  const json = JSON.parse(readFileSync(file, "utf8"));
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    const deps = json[field];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (typeof spec !== "string" || !spec.startsWith("workspace:")) continue;
      const target = workspaces.get(name);
      if (!target) {
        console.error(`✗ ${json.name}: workspace dep "${name}" has no matching package in packages/`);
        process.exit(1);
      }
      deps[name] = resolveSpec(spec, target.version);
      changed++;
    }
  }
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}

console.log(`✓ resolved ${changed} workspace: deps to concrete versions`);
