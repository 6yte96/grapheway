import { describe, expect, test } from "bun:test";
import { escapeHtml, generateJsonLd, renderJsonLdHtml, renderMetaTags } from "../src/jsonld.ts";
import type { GraphewayConfig } from "../src/types.ts";

const config: GraphewayConfig = {
  name: "Acme",
  url: "https://acme.example",
  tagline: "API for everything",
  summary: "Acme <is> the API platform & more.",
  sections: [{ title: "Docs", url: "/docs", items: [{ title: "Install", url: "/docs/install" }] }],
  actions: [
    {
      name: "search_content",
      description: "Search",
      inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
    },
  ],
};

describe("generateJsonLd", () => {
  test("emits Organization, WebSite and WebPage graph entries", () => {
    const graph = generateJsonLd(config);
    expect(graph.some((o) => o["@type"] === "Organization")).toBe(true);
    expect(graph.some((o) => o["@type"] === "WebSite")).toBe(true);
    expect(graph.some((o) => o["@type"] === "WebPage" && o["url"] === "https://acme.example/docs")).toBe(true);
  });

  test("adds SearchAction when search_content is declared", () => {
    const graph = generateJsonLd(config);
    const website = graph.find((o) => o["@type"] === "WebSite") as Record<string, unknown>;
    expect(website["potentialAction"]).toBeTruthy();
  });
});

describe("renderJsonLdHtml / renderMetaTags / escapeHtml", () => {
  test("renders ld+json script tags", () => {
    const html = renderJsonLdHtml(config);
    expect(html).toContain('<script type="application/ld+json">');
  });

  test("meta tags include OG + description and escape HTML", () => {
    const html = renderMetaTags(config);
    expect(html).toContain("og:title");
    expect(html).toContain("twitter:card");
    expect(html).not.toContain("<is");
    expect(html).toContain("&lt;is");
    expect(html).toContain("&amp;");
  });

  test("escapeHtml escapes the five dangerous characters", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  });
});
