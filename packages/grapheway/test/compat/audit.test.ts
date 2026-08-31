import { describe, expect, test } from "bun:test";
import { auditConfig, scoreChecks } from "../../src/compat/audit.ts";
import type { GraphewayConfig } from "../../src/core/index.js";

const good: GraphewayConfig = {
  name: "Acme",
  url: "https://acme.example",
  summary: "Acme is an API platform.",
  contact: { email: "hi@acme.example" },
  capabilities: ["search"],
  sections: [{ title: "Docs", items: [{ title: "Install", url: "/docs/install" }] }],
  actions: [{ name: "search_content", description: "Search" }],
};

describe("auditConfig", () => {
  test("a complete config passes every check", () => {
    const checks = auditConfig(good);
    const failed = checks.filter((c) => !c.ok);
    expect(failed).toEqual([]);
  });

  test("an empty config scores poorly with helpful hints", () => {
    const checks = auditConfig({ name: "x", url: "https://x.example" });
    expect(checks.some((c) => !c.ok && c.id === "llms-summary")).toBe(true);
    expect(checks.some((c) => !c.ok && c.id === "sections-urls")).toBe(false); // no sections → vacuous pass
  });

  test("scoreChecks returns A+ for full marks and F for none", () => {
    expect(scoreChecks(auditConfig(good)).score).toBeGreaterThanOrEqual(95);
    expect(scoreChecks(auditConfig({ name: "x", url: "https://x.example" })).score).toBeLessThan(60);
  });
});
