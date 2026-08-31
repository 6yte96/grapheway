import { describe, expect, test } from "bun:test";
import {
  generateLlmsFullTxt,
  generateLlmsTxt,
  rootPath,
  validateLlmsTxt,
} from "../../src/compat/llms-txt.ts";
import type { GraphewayConfig } from "../../src/core/index.js";

const config: GraphewayConfig = {
  name: "Acme Docs",
  url: "https://acme.example",
  tagline: "The API for everything",
  summary: "Acme Docs is the reference for the Acme API.",
  sections: [
    {
      title: "Getting Started",
      description: "Setup guides",
      items: [
        { title: "Installation", url: "/docs/install", notes: "Install the SDK" },
        { title: "Quickstart", url: "/docs/quickstart", notes: "First API call" },
      ],
    },
    {
      title: "Reference",
      optional: true,
      items: [{ title: "Endpoints", url: "https://acme.example/docs/endpoints", notes: "All endpoints" }],
    },
  ],
};

describe("generateLlmsTxt", () => {
  test("starts with H1 title and tagline blockquote", () => {
    const out = generateLlmsTxt(config);
    const lines = out.split("\n");
    expect(lines[0]).toBe("# Acme Docs");
    expect(lines).toContain("> The API for everything");
  });

  test("renders sections with markdown links and absolute URLs", () => {
    const out = generateLlmsTxt(config);
    expect(out).toContain("## Getting Started");
    expect(out).toContain("- [Installation](https://acme.example/docs/install): Install the SDK");
    expect(out).toContain("## Optional");
  });

  test("passes validation", () => {
    const out = generateLlmsTxt(config);
    expect(validateLlmsTxt(out).valid).toBe(true);
  });

  test("validateLlmsTxt catches a missing H1", () => {
    const res = validateLlmsTxt("not a title\n## Section\n- [X](/x)");
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("H1"))).toBe(true);
  });
});

describe("generateLlmsFullTxt", () => {
  test("appends inline page markdown", () => {
    const out = generateLlmsFullTxt(config, {
      "/docs/install": "## Installation\nRun `npm i acme`.",
    });
    expect(out).toContain("# Installation");
    expect(out).toContain("Run `npm i acme`.");
    expect(out).toContain("> Source: https://acme.example/docs/install");
  });

  test("skips pages without markdown", () => {
    const out = generateLlmsFullTxt(config, {});
    expect(out).not.toContain("# Installation");
  });
});

describe("rootPath", () => {
  test("strips origin and query", () => {
    expect(rootPath("https://acme.example/docs/install?v=2")).toBe("/docs/install?v=2");
    expect(rootPath("/docs/install")).toBe("/docs/install");
  });
});
