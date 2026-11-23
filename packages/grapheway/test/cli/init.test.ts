import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectFramework, scaffoldProject } from "../../src/cli/init.ts";

async function tempProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), "grapheway-init-"));
}

describe("detectFramework", () => {
  test("detects Next.js from next.config.ts", async () => {
    const dir = await tempProject();
    try {
      await writeFile(join(dir, "next.config.ts"), "export default {};\n");
      expect(await detectFramework(dir)).toBe("next");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("detects Express, Hono and static projects", async () => {
    for (const [dep, expected] of [
      ["express", "express"],
      ["hono", "hono"],
    ] as const) {
      const dir = await tempProject();
      try {
        await writeFile(
          join(dir, "package.json"),
          JSON.stringify({ dependencies: { [dep]: "1.0.0" } }),
        );
        expect(await detectFramework(dir)).toBe(expected);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }

    const staticDir = await tempProject();
    try {
      await mkdir(join(staticDir, "public"));
      expect(await detectFramework(staticDir)).toBe("static");
    } finally {
      await rm(staticDir, { recursive: true, force: true });
    }
  });
});

describe("scaffoldProject", () => {
  test("Next.js: writes config, middleware and a fetch route handler", async () => {
    const dir = await tempProject();
    try {
      await writeFile(
        join(dir, "package.json"),
        JSON.stringify({ dependencies: { next: "15.0.0" } }),
      );
      await mkdir(join(dir, "app"));

      const result = await scaffoldProject({ dir, name: "Acme", framework: "next" });

      expect(result.framework).toBe("next");
      expect(result.files).toContain("grapheway.config.ts");
      expect(result.files).toContain("middleware.ts");
      expect(result.files).toContain(join("app", "api", "grapheway", "route.ts"));
      expect(result.nextSteps.join("\n")).toContain("http://localhost:3000/mcp");

      const configSource = await readFile(join(dir, "grapheway.config.ts"), "utf-8");
      expect(configSource).toContain('"name": "Acme"');
      expect(configSource).toContain("GraphewayConfig");

      const route = await readFile(join(dir, "app", "api", "grapheway", "route.ts"), "utf-8");
      expect(route).toContain("toFetchHandler");
      expect(route).toContain("../../../grapheway.config");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("static: writes the legacy compat files into public/", async () => {
    const dir = await tempProject();
    try {
      const result = await scaffoldProject({ dir, name: "Static Site", framework: "static" });
      expect(result.files).toEqual(
        expect.arrayContaining([
          "public/llms.txt",
          "public/agents.txt",
          "public/agents.json",
          "public/robots.txt",
          "public/sitemap.xml",
        ]),
      );
      const llms = await readFile(join(dir, "public", "llms.txt"), "utf-8");
      expect(llms).toContain("# Static Site");
      expect(llms).toContain("npx grapheway init");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("never clobbers an existing middleware; writes a merge file", async () => {
    const dir = await tempProject();
    try {
      await mkdir(join(dir, "app"));
      await writeFile(join(dir, "middleware.ts"), "// my auth middleware\n");
      const result = await scaffoldProject({ dir, framework: "next", force: true });
      expect(result.files).toContain("middleware.grapheway.ts");
      expect(result.skipped).toContain("middleware.ts");
      expect(await readFile(join(dir, "middleware.ts"), "utf-8")).toBe("// my auth middleware\n");
      expect(result.nextSteps.join("\n")).toContain("merge the rewrite");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("never overwrites an existing config without --force", async () => {
    const dir = await tempProject();
    try {
      await writeFile(join(dir, "grapheway.config.ts"), "// keep me\n");
      const result = await scaffoldProject({ dir, framework: "node" });
      expect(result.skipped).toContain("grapheway.config.ts");
      expect(await readFile(join(dir, "grapheway.config.ts"), "utf-8")).toBe("// keep me\n");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
