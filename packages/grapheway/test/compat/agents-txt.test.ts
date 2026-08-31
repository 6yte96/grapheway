import { describe, expect, test } from "bun:test";
import { buildAgentsJson, buildAgentsTxt } from "../../src/compat/agents-txt.ts";
import { generateAll } from "../../src/compat/generate-all.ts";
import type { GraphewayConfig } from "../../src/core/index.js";

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

describe("buildAgentsTxt", () => {
  test("declares endpoints and actions", () => {
    const out = buildAgentsTxt(config);
    expect(out).toContain("## MCP");
    expect(out).toContain("Server: https://acme.example/mcp");
    expect(out).toContain("## API");
    expect(out).toContain("## Actions");
    expect(out).toContain("`search_content`: Search docs");
    expect(out).toContain("CORS: Access-Control-Allow-Origin: *");
  });
});

describe("buildAgentsJson / generateAll", () => {
  test("agents.json parses to a manifest", () => {
    const parsed = JSON.parse(buildAgentsJson(config)) as { site: { name: string }; endpoints: { mcp: string } };
    expect(parsed.site.name).toBe("Acme");
    expect(parsed.endpoints.mcp).toContain("/mcp");
  });

  test("generateAll returns all legacy static artifacts", () => {
    const all = generateAll(config);
    expect(Object.keys(all).sort()).toEqual(
      ["agents.json", "agents.txt", "llms.txt", "robots.txt", "sitemap.xml"].sort(),
    );
    expect(all["llms.txt"]).toContain("# Acme");
    expect(all["sitemap.xml"]).toContain("<urlset");
  });
});
