import { describe, expect, test } from "bun:test";
import { escapeXml, generateSitemapXml } from "../../src/compat/sitemap.ts";
import type { GraphewayConfig } from "../../src/core/index.js";

const config: GraphewayConfig = {
  name: "Acme",
  url: "https://acme.example",
  tagline: "API for everything",
  summary: "Acme is an API platform.",
  sections: [
    {
      title: "Docs",
      items: [
        { title: "Install", url: "/docs/install" },
        { title: "Quickstart", url: "https://acme.example/docs/quickstart" },
      ],
    },
    {
      title: "Blog",
      url: "/blog",
      items: [{ title: "Hello", url: "/blog/hello?from=home&ref=1" }],
    },
  ],
  links: [{ title: "GitHub", url: "https://github.com/acme" }],
};

describe("generateSitemapXml", () => {
  test("emits a valid urlset with the site root and item URLs", () => {
    const xml = generateSitemapXml(config);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://acme.example/</loc>");
    expect(xml).toContain("<loc>https://acme.example/docs/install</loc>");
    expect(xml).toContain("<loc>https://acme.example/docs/quickstart</loc>");
    expect(xml).toContain("<loc>https://acme.example/blog</loc>");
  });

  test("resolves root-relative URLs against the site origin", () => {
    const xml = generateSitemapXml(config);
    expect(xml).not.toContain('<loc>/docs/install</loc>');
  });

  test("escapes special characters in URLs", () => {
    const xml = generateSitemapXml(config);
    expect(xml).toContain("<loc>https://acme.example/blog/hello?from=home&amp;ref=1</loc>");
  });

  test("excludes external links and cross-origin items from the sitemap", () => {
    const cfg: GraphewayConfig = {
      name: "X",
      url: "https://x.example",
      links: [{ title: "GitHub", url: "https://github.com/acme" }],
      sections: [{ title: "Ext", items: [{ title: "Other", url: "https://other.example/page" }] }],
    };
    const xml = generateSitemapXml(cfg);
    expect(xml).not.toContain("github.com/acme");
    expect(xml).not.toContain("other.example");
  });

  test('a "/" section URL dedupes with the site root', () => {
    const cfg: GraphewayConfig = {
      name: "X",
      url: "https://x.example",
      sections: [{ title: "Home", url: "/", items: [{ title: "Home", url: "/" }] }],
    };
    const xml = generateSitemapXml(cfg);
    const count = xml.match(/<loc>https:\/\/x\.example\/<\/loc>/g)?.length ?? 0;
    expect(count).toBe(1);
  });

  test("dedupes repeated URLs", () => {
    const cfg: GraphewayConfig = {
      name: "X",
      url: "https://x.example",
      sections: [
        { title: "A", items: [{ title: "P", url: "/p" }] },
        { title: "B", items: [{ title: "P again", url: "/p" }] },
      ],
    };
    const xml = generateSitemapXml(cfg);
    const count = xml.match(/<loc>https:\/\/x\.example\/p<\/loc>/g)?.length ?? 0;
    expect(count).toBe(1);
  });
});

describe("escapeXml", () => {
  test("escapes the five XML-sensitive characters", () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe("a&amp;b&lt;c&gt;d&quot;e&apos;f");
  });
});
