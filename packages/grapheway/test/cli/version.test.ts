import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { GRAPHEWAY_VERSION } from "../../src/core/index.ts";

const cli = join(import.meta.dir, "../../src/cli/cli.ts");

function run(args: string[]): { code: number; stdout: string; stderr: string } {
  const result = Bun.spawnSync([process.execPath, cli, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode ?? 1,
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
  };
}

describe("cli version", () => {
  for (const flag of ["--version", "-v", "version"]) {
    test(`\`grapheway ${flag}\` prints the version and exits 0`, () => {
      const result = run([flag]);
      expect(result.code).toBe(0);
      expect(result.stdout).toBe(GRAPHEWAY_VERSION);
      expect(result.stderr).toBe("");
    });
  }

  test("no arguments still prints help", () => {
    const result = run([]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Usage:");
  });

  test("an unknown command still fails", () => {
    const result = run(["nope"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('unknown command "nope"');
  });
});
