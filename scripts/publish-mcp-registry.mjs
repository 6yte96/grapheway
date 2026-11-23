#!/usr/bin/env node
/**
 * Validate and publish `server.json` to the Official MCP Registry.
 *
 * Auth: uses `GITHUB_TOKEN` or the local `gh auth token`. The token is
 * exchanged for a short-lived registry token; it is never printed or stored.
 *
 *   node scripts/publish-mcp-registry.mjs --validate
 *   node scripts/publish-mcp-registry.mjs --publish
 */

import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_JSON = join(__dirname, "..", "server.json");
const REGISTRY = "https://registry.modelcontextprotocol.io";

const args = new Set(process.argv.slice(2));
const doValidate = args.has("--validate") || args.size === 0;
const doPublish = args.has("--publish");

function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  try {
    return execSync("gh auth token", { encoding: "utf-8" }).trim();
  } catch {
    throw new Error("Set GITHUB_TOKEN or run `gh auth login` first.");
  }
}

async function main() {
  const body = await readFile(SERVER_JSON, "utf-8");
  JSON.parse(body); // fail fast on malformed JSON

  if (doValidate) {
    const res = await fetch(`${REGISTRY}/v0/validate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const data = await res.json();
    console.log(`validate: ${res.status}`, JSON.stringify(data));
    if (!res.ok) process.exit(1);
  }

  if (doPublish) {
    const auth = await fetch(`${REGISTRY}/v0/auth/github-at`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ github_token: githubToken() }),
    });
    const authData = await auth.json();
    if (!auth.ok || !authData.registry_token) {
      console.error("auth failed", auth.status, authData);
      process.exit(1);
    }

    const res = await fetch(`${REGISTRY}/v0/publish`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${authData.registry_token}`,
      },
      body,
    });
    const data = await res.json();
    console.log(`publish: ${res.status}`, JSON.stringify(data, null, 2));
    if (!res.ok) process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
