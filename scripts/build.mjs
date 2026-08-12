#!/usr/bin/env bun
/**
 * Builds all five packages into their dist/ folder.
 *
 *   bun run build
 *
 * Per package:
 *   1. JS — Bun.build bundles src into a single ESM file per entry, targeting
 *      node. Relative imports are inlined; package deps (grapheway, node:…)
 *      stay external.
 *   2. Types — tsc emits declarations (emitDeclarationOnly lets the sources
 *      keep their ".ts" import specifiers). Those specifiers are then
 *      rewritten to ".js" so consumers' tsc resolves them to sibling .d.ts.
 *   3. Bins — bin entries get a `#!/usr/bin/env node` shebang if the bundler
 *      dropped it.
 *
 * Requires Bun (uses Bun.build). Run via `bun run build`.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PACKAGES = ["core", "web", "compat", "agent", "cli"];

/** Entry points (relative to each package dir). */
const ENTRIES = {
  core: ["src/index.ts"],
  web: ["src/index.ts"],
  compat: ["src/index.ts"],
  agent: ["src/index.ts", "src/mcp-stdio.ts"],
  cli: ["src/cli.ts"],
};

/** dist files that must be executable with a node shebang. */
const BIN_FILES = new Map([
  ["agent", ["mcp-stdio.js"]],
  ["cli", ["cli.js"]],
]);

/** Rewrite relative ".ts" specifiers to ".js" inside emitted .d.ts files. */
function rewriteSpecifiers(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      rewriteSpecifiers(path);
      continue;
    }
    if (!entry.name.endsWith(".d.ts")) continue;
    const text = readFileSync(path, "utf8").replace(/(["'])(\.\.?\/[^"']*?)\.ts\1/g, "$1$2.js$1");
    writeFileSync(path, text);
  }
}

for (const pkg of PACKAGES) {
  const pkgDir = join(root, "packages", pkg);
  const dist = join(pkgDir, "dist");

  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });

  // 1. Type declarations.
  execSync(`npx tsc -p packages/${pkg}/tsconfig.build.json`, { cwd: root, stdio: "inherit" });

  // 2. JavaScript bundles.
  const result = await Bun.build({
    entrypoints: ENTRIES[pkg].map((entry) => join(pkgDir, entry)),
    outdir: dist,
    target: "node",
    format: "esm",
    packages: "external",
  });
  if (!result.success) {
    console.error(`✗ ${pkg}: build failed`);
    for (const log of result.logs) console.error(String(log));
    process.exit(1);
  }

  // 3. Fix .ts specifiers in declarations.
  rewriteSpecifiers(dist);

  // 4. Guarantee bin entries are directly executable by node.
  for (const bin of BIN_FILES.get(pkg) ?? []) {
    const file = join(dist, bin);
    if (!existsSync(file)) {
      console.error(`✗ ${pkg}: expected bin output ${bin} missing`);
      process.exit(1);
    }
    const body = readFileSync(file, "utf8");
    if (!body.startsWith("#!")) writeFileSync(file, "#!/usr/bin/env node\n" + body);
  }

  // 5. Sanity: the package's main entry must exist.
  const entry = ENTRIES[pkg][0].replace("src/", "").replace(".ts", ".js");
  if (!existsSync(join(dist, entry))) {
    console.error(`✗ ${pkg}: expected ${entry} missing in dist/`);
    process.exit(1);
  }

  console.log(`✓ ${pkg} → dist/ (${result.outputs.length} js bundle${result.outputs.length === 1 ? "" : "s"} + declarations)`);
}
