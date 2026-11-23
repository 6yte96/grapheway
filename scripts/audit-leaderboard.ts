/**
 * Build the public Agent Readiness Index.
 *
 * Runs the same live audit as `grapheway audit <url>` against a curated list
 * of high-traffic documentation sites, then writes the dataset used by
 * /readiness/ and /readiness/<slug>/.
 *
 *   bun run scripts/audit-leaderboard.ts
 *
 * Public endpoints only. No visitor data, no tracking.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { auditUrl } from "../packages/grapheway/src/cli/commands.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outJson = join(root, "website", "src", "data", "agent-readiness.json");
const publicJson = join(root, "website", "public", "agent-readiness.json");

const SITES = [
  { name: "Stripe Docs", url: "https://docs.stripe.com" },
  { name: "GitHub Docs", url: "https://docs.github.com" },
  { name: "Supabase Docs", url: "https://supabase.com/docs" },
  { name: "Vercel Docs", url: "https://vercel.com/docs" },
  { name: "Next.js Docs", url: "https://nextjs.org/docs" },
  { name: "React Docs", url: "https://react.dev" },
  { name: "Node.js Docs", url: "https://nodejs.org/docs" },
  { name: "Express Docs", url: "https://expressjs.com" },
  { name: "Tailwind CSS Docs", url: "https://tailwindcss.com/docs" },
  { name: "AWS Docs", url: "https://docs.aws.amazon.com" },
  { name: "Google Cloud Docs", url: "https://cloud.google.com/docs" },
  { name: "Microsoft Learn", url: "https://learn.microsoft.com" },
  { name: "Docker Docs", url: "https://docs.docker.com" },
  { name: "Kubernetes Docs", url: "https://kubernetes.io/docs" },
  { name: "Python Docs", url: "https://docs.python.org" },
  { name: "MDN", url: "https://developer.mozilla.org" },
  { name: "Playwright Docs", url: "https://playwright.dev/docs" },
  { name: "Anthropic Docs", url: "https://docs.anthropic.com" },
  { name: "OpenAI Platform Docs", url: "https://platform.openai.com/docs" },
  { name: "Docusaurus Docs", url: "https://docusaurus.io/docs" },
  { name: "Vite Docs", url: "https://vitejs.dev/guide" },
  { name: "Svelte Docs", url: "https://svelte.dev/docs" },
  { name: "Astro Docs", url: "https://docs.astro.build" },
  { name: "Prisma Docs", url: "https://www.prisma.io/docs" },
  { name: "MongoDB Docs", url: "https://www.mongodb.com/docs" },
  { name: "Redis Docs", url: "https://redis.io/docs" },
  { name: "PostgreSQL Docs", url: "https://www.postgresql.org/docs" },
  { name: "Twilio Docs", url: "https://www.twilio.com/docs" },
  { name: "Shopify Docs", url: "https://shopify.dev/docs" },
  { name: "WordPress Docs", url: "https://wordpress.org/documentation" },
];

function slugFor(url: string): string {
  return new URL(url).hostname.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "");
}

async function main() {
  const results = [];
  for (const site of SITES) {
    const audit = await auditUrl(site.url);
    const gaps = audit.checks.filter((c) => !c.ok);
    results.push({
      name: site.name,
      url: site.url,
      slug: slugFor(site.url),
      score: audit.score,
      grade: audit.grade,
      checks: audit.checks.map((c) => ({
        id: c.id,
        label: c.label,
        ok: c.ok,
        detail: c.detail ?? null,
      })),
      gaps: gaps.map((c) => c.label),
    });
    console.log(`${String(audit.score).padStart(3)} ${audit.grade.padEnd(2)} ${site.name} — ${gaps.length} gaps`);
  }

  results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const average = Math.round(results.reduce((sum, r) => sum + r.score, 0) / (results.length || 1));
  const passing = results.filter((r) => r.score >= 70).length;
  const payload = {
    updatedAt: new Date().toISOString(),
    methodology:
      "Live audit of public endpoints: discovery card, knowledge graph, /agent API, MCP, robots.txt AI policy, llms.txt, agents.json, JSON-LD, sitemap. No visitor data.",
    total: results.length,
    average,
    passing,
    results,
  };

  await mkdir(dirname(outJson), { recursive: true });
  await mkdir(dirname(publicJson), { recursive: true });
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(outJson, json, "utf-8");
  await writeFile(publicJson, json, "utf-8");
  console.log(`\nWrote ${results.length} sites · average ${average}/100 · ${passing} at B or better`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
