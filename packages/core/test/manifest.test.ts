import { describe, expect, test } from "bun:test";
import { buildManifest } from "../src/manifest.ts";
import type { GraphewayConfig } from "../src/types.ts";

const config: GraphewayConfig = {
  name: "Acme",
  url: "https://acme.example/",
  tagline: "API for everything",
  summary: "Acme is an API platform.",
  contact: { name: "Acme Support", email: "support@acme.example", protocol: "email" },
  sections: [{ title: "Docs", items: [{ title: "Install", url: "/docs/install" }] }],
  actions: [
    {
      name: "search_content",
      description: "Search docs",
      inputSchema: {
        type: "object",
        properties: { q: { type: "string" } },
        required: ["q"],
      },
    },
  ],
  capabilities: ["search", "mcp"],
};

describe("buildManifest", () => {
  test("produces absolute endpoint URLs from trailing-slash base", () => {
    const m = buildManifest(config);
    expect(m.site.name).toBe("Acme");
    expect(m.endpoints.manifest).toBe("https://acme.example/agent");
    expect(m.endpoints.llmsTxt).toBe("https://acme.example/llms.txt");
    expect(m.endpoints.mcp).toBe("https://acme.example/mcp");
    expect(m.endpoints.sitemap).toBe("https://acme.example/sitemap.xml");
  });

  test("includes built-in + declared actions without duplicates", () => {
    const m = buildManifest(config);
    const names = m.actions.map((a) => a.name);
    expect(names).toContain("get_site_info");
    expect(names).toContain("list_sections");
    expect(names).toContain("get_page");
    expect(names.filter((n) => n === "search_content")).toHaveLength(1);
  });
});
