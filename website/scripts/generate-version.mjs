/**
 * Publish the package version at /version.json.
 *
 * Search engines cache the GitHub README and the npm page independently. This
 * file gives them, and any agent, one canonical URL for the current release.
 * It is generated from packages/grapheway/package.json at build time.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const website = path.resolve(here, "..");
const repoRoot = path.resolve(website, "..");

const pkg = JSON.parse(
  await readFile(path.join(repoRoot, "packages/grapheway/package.json"), "utf8"),
);

const version = pkg.version;
const repo = "https://github.com/6yte96/grapheway";
const data = {
  name: "grapheway",
  version,
  status: version.split(".")[0] === "0" ? "beta" : "stable",
  npm: "https://www.npmjs.com/package/grapheway",
  repository: repo,
  release: `${repo}/releases/tag/v${version}`,
  changelog: `${repo}/blob/main/CHANGELOG.md`,
  website: "https://6yte96.github.io/grapheway/",
};

await writeFile(
  path.join(website, "public/version.json"),
  `${JSON.stringify(data, null, 2)}\n`,
);

console.log(`version: ${version}`);
