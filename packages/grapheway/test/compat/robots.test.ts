import { describe, expect, test } from "bun:test";
import { buildRobotsTxt } from "../../src/compat/robots.ts";
import type { GraphewayConfig } from "../../src/core/index.js";

const base: GraphewayConfig = {
  name: "Acme",
  url: "https://acme.example",
};

describe("buildRobotsTxt", () => {
  test("default: blocks training crawlers, allows search crawlers", () => {
    const out = buildRobotsTxt(base);
    expect(out).toContain("User-agent: GPTBot");
    expect(out).toContain("Disallow: /");
    expect(out).toContain("User-agent: ClaudeBot");
    // search crawlers should NOT have disallow groups by default
    const searchBotGroup = out.split("\n\n").find((g) => g.includes("User-agent: PerplexityBot"));
    expect(searchBotGroup ?? "none").toBe("none");
  });

  test("allowTraining=true keeps training crawlers unblocked", () => {
    const out = buildRobotsTxt({ ...base, robots: { allowTraining: true } });
    expect(out).not.toContain("User-agent: GPTBot");
  });

  test("allowSearch=false blocks retrieval bots", () => {
    const out = buildRobotsTxt({ ...base, robots: { allowSearch: false } });
    expect(out).toContain("User-agent: PerplexityBot");
    expect(out).toContain("User-agent: Claude-SearchBot");
  });

  test("includes sitemap line", () => {
    expect(buildRobotsTxt(base)).toContain("Sitemap: https://acme.example/sitemap.xml");
  });

  test("extra rules are applied", () => {
    const out = buildRobotsTxt({
      ...base,
      robots: { extraDisallow: ["Bytespider"], extraAllow: ["Bingbot"] },
    });
    expect(out).toContain("User-agent: Bytespider");
    expect(out).toContain("User-agent: Bingbot");
    expect(out).toContain("Allow: /");
  });

  test("blocking everything still dedupes overlapping user agents", () => {
    const out = buildRobotsTxt({ ...base, robots: { allowTraining: false, allowSearch: false } });
    const count = out.match(/User-agent: GPTBot/g)?.length ?? 0;
    expect(count).toBe(1);
  });
});
