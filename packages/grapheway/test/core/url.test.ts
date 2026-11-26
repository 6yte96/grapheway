import { describe, expect, test } from "bun:test";
import { trimTrailingSlashes } from "../../src/core/url.ts";

describe("trimTrailingSlashes", () => {
  test("removes every trailing slash", () => {
    expect(trimTrailingSlashes("https://example.com///")).toBe("https://example.com");
    expect(trimTrailingSlashes("/")).toBe("");
    expect(trimTrailingSlashes("")).toBe("");
  });

  test("keeps inner slashes", () => {
    expect(trimTrailingSlashes("https://example.com/docs/v1")).toBe("https://example.com/docs/v1");
  });
});
