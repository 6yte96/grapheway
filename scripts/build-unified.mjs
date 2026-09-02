#!/usr/bin/env bun
/**
 * Build the unified grapheway package.
 * Uses Bun.build — bundles each subpath entry separately.
 */
import { rm, readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = join(__dirname, "..", "packages", "grapheway");

const builds = [
  { name: "core", entry: "src/core/index.ts", outdir: "dist/core" },
  { name: "web", entry: "src/web/index.ts", outdir: "dist/web" },
  { name: "probe", entry: "src/probe/index.ts", outdir: "dist/probe" },
  { name: "agent", entry: "src/agent/index.ts", outdir: "dist/agent" },
  { name: "compat", entry: "src/compat/index.ts", outdir: "dist/compat" },
  { name: "cli", entry: "src/cli/cli.ts", outdir: "dist/cli" },
];

async function main() {
  await rm(join(pkg, "dist"), { recursive: true, force: true });

  let ok = 0;
  for (const { name, entry, outdir } of builds) {
    const result = await Bun.build({
      entrypoints: [join(pkg, entry)],
      outdir: join(pkg, outdir),
      format: "esm",
      target: "node",
      splitting: false,
      sourcemap: "none",
      minify: false,
      naming: "[name].[ext]",
    });

    if (!result.success) {
      console.error(`  ✗ ${name}:`, result.logs);
      process.exit(1);
    }

    // Add shebang to CLI
    if (name === "cli") {
      const cliPath = join(pkg, outdir, "cli.js");
      const content = await readFile(cliPath, "utf-8");
      await writeFile(cliPath, "#!/usr/bin/env node\n" + content);
    }

    // Generate .d.ts declarations
    const tsconfig = join(pkg, "tsconfig.json");
    const entryFile = join(pkg, entry);
    const outDir = join(pkg, outdir);
    try {
      execSync(
        `npx tsc --project ${tsconfig} --declaration --emitDeclarationOnly --outDir ${outDir} ${entryFile}`,
        { stdio: "pipe", cwd: pkg }
      );
    } catch {
      // Non-fatal — esbuild handles runtime, tsc is best-effort for types
    }

    console.log(`  ✓ ${name}`);
    ok++;
  }

  // Sync README.md and LICENSE to the package folder for npm publish
  const rootDir = join(__dirname, "..");
  await copyFile(join(rootDir, "README.md"), join(pkg, "README.md"));
  await copyFile(join(rootDir, "LICENSE"), join(pkg, "LICENSE"));
  console.log("  ✓ README.md & LICENSE synced to package");

  console.log(`\n  ${ok} bundles built ✓`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
