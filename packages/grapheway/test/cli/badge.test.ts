import { describe, expect, test } from "bun:test";
import { badgeMarkdown, generateBadgeSvg } from "../../src/cli/badge.ts";

describe("generateBadgeSvg", () => {
  test("renders label and value", () => {
    const svg = generateBadgeSvg({ label: "agent-ready", value: "92/100" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("agent-ready");
    expect(svg).toContain("92/100");
    expect(svg).toContain("</svg>");
  });

  test("escapes XML-sensitive characters", () => {
    const svg = generateBadgeSvg({ label: "a&b", value: "<x>" });
    expect(svg).toContain("a&amp;b");
    expect(svg).toContain("&lt;x&gt;");
    expect(svg).not.toContain("a&b");
  });

  test("markdown helper links back to the protocol", () => {
    expect(badgeMarkdown("badge.svg", "https://github.com/6yte96/grapheway")).toBe(
      "[![agent-ready](badge.svg)](https://github.com/6yte96/grapheway)",
    );
  });
});
