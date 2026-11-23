#!/usr/bin/env node
/**
 * Refresh the public adopter index.
 *
 * Only checks sites that were submitted to the registry. It fetches each
 * site's own public `/.well-known/agent` card and records whether the card
 * answers. No personal data, no tracking, no third-party analytics.
 *
 * Run manually:  node scripts/check-adopters.mjs
 * Runs daily in .github/workflows/adopters.yml.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(__dirname, "..", "website", "public", "adopters.json");
const TIMEOUT_MS = 10_000;
const UA = "grapheway-adopter-check/1.0 (+https://github.com/6yte96/grapheway)";

/** @param {string} url */
async function check(url) {
  try {
    const res = await fetch(`${url.replace(/\/+$/, "")}/.well-known/agent`, {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "follow",
    });
    if (res.status !== 200) return { ok: false, detail: `HTTP ${res.status}` };
    const text = await res.text();
    const ok = text.includes('"protocol"') && text.toLowerCase().includes("grapheway");
    return { ok, detail: ok ? "agent card found" : "card is not a grapheway card" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const raw = await readFile(INDEX_PATH, "utf-8");
  const data = JSON.parse(raw);
  const sites = Array.isArray(data.sites) ? data.sites : [];
  const checkedAt = new Date().toISOString();
  let verified = 0;

  for (const site of sites) {
    // Demo / repository entries are intentionally not probed.
    if (!site || typeof site.url !== "string" || !/^https?:\/\//.test(site.url)) continue;
    if (site.verify === false || site.status === "demo") continue;

    const result = await check(site.url);
    site.lastChecked = checkedAt;
    site.verified = result.ok;
    site.status = result.ok ? "verified" : "listed";
    site.detail = result.detail;
    if (result.ok) verified++;
    console.log(`${result.ok ? "✓" : "·"} ${site.name} — ${result.detail}`);
  }

  data.updatedAt = checkedAt;
  data.total = sites.length;
  data.verified = verified;
  await writeFile(INDEX_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  console.log(`\nIndex refreshed: ${sites.length} listed, ${verified} verified.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
