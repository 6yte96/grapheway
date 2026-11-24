#!/usr/bin/env node
/**
 * Generate public/sitemap.xml from the real route list.
 *
 * Runs before `next dev` and `next build`. It includes every readiness report
 * so the 30 detail pages are crawlable, not just the ten linked on the index.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const base = "https://6yte96.github.io/grapheway";
const today = new Date().toISOString().slice(0, 10);

const data = JSON.parse(
  await readFile(join(root, "src", "data", "agent-readiness.json"), "utf-8"),
);
const articles = JSON.parse(
  await readFile(join(root, "src", "data", "articles.json"), "utf-8"),
);

const pages = [
  { path: "", changefreq: "weekly", priority: "1.0" },
  { path: "docs", changefreq: "weekly", priority: "0.9" },
  { path: "setup", changefreq: "weekly", priority: "0.9" },
  { path: "readiness", changefreq: "weekly", priority: "0.9" },
  { path: "adopters", changefreq: "daily", priority: "0.8" },
  { path: "releases", changefreq: "weekly", priority: "0.8" },
  { path: "blog", changefreq: "weekly", priority: "0.9" },
  ...articles.map((article) => ({
    path: `blog/${article.slug}`,
    changefreq: "monthly",
    priority: "0.7",
  })),
  ...data.results.map((site) => ({
    path: `readiness/${site.slug}`,
    changefreq: "monthly",
    priority: "0.6",
  })),
];

const entries = pages
  .map((page) => {
    const loc = page.path ? `${base}/${page.path}/` : `${base}/`;
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  })
  .join("\n");

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

await writeFile(join(root, "public", "sitemap.xml"), xml, "utf-8");
console.log(`sitemap: ${pages.length} URLs`);
