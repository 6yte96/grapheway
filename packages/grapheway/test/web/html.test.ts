import { describe, expect, test } from "bun:test";
import {
  decodeHtmlEntities,
  getHtmlAttribute,
  htmlToMarkdown,
  stripHtmlBlocks,
  stripHtmlTags,
  tokenizeHtml,
} from "../../src/web/html.ts";

describe("decodeHtmlEntities", () => {
  test("decodes named and numeric entities once", () => {
    expect(decodeHtmlEntities("a &amp;lt; b &#x27;q&#39; &nbsp;c")).toBe("a &lt; b 'q'  c");
  });

  test("leaves unknown entities and bare ampersands alone", () => {
    expect(decodeHtmlEntities("a &bogus; b & c")).toBe("a &bogus; b & c");
  });

  test("ignores a distant semicolon", () => {
    expect(decodeHtmlEntities("&" + "x".repeat(40) + ";")).toBe("&" + "x".repeat(40) + ";");
  });
});

describe("stripHtmlTags", () => {
  test("removes tags without regex backtracking", () => {
    expect(stripHtmlTags("a <b>c</b> d")).toBe("a  c  d");
  });

  test("keeps a trailing literal when a tag is unterminated", () => {
    expect(stripHtmlTags("a <b")).toBe("a <b");
  });
});

describe("getHtmlAttribute", () => {
  test("reads quoted and unquoted attributes in any order", () => {
    expect(getHtmlAttribute(' name="description" content="Hello"', "content")).toBe("Hello");
    expect(getHtmlAttribute(" id=hero class='x y'", "id")).toBe("hero");
    expect(getHtmlAttribute(" data-x='1'", "missing")).toBeNull();
  });
});

describe("tokenizeHtml", () => {
  test("skips comments and keeps text and tags", () => {
    const tokens = tokenizeHtml("a<!-- hidden --><b>c</b>");
    expect(tokens).toEqual([
      { kind: "text", text: "a" },
      expect.objectContaining({ kind: "tag" }),
      { kind: "text", text: "c" },
      expect.objectContaining({ kind: "tag" }),
    ]);
  });

  test("does not emit script or style content", () => {
    const text = tokenizeHtml("<style>.a{}</style><p>ok</p>")
      .filter((t) => t.kind === "text")
      .map((t) => (t.kind === "text" ? t.text : ""))
      .join("");
    expect(text).not.toContain(".a");
    expect(text).toContain("ok");
  });
});

describe("stripHtmlBlocks", () => {
  test("removes a block and its content", () => {
    const html = "<p>keep</p><nav><a href='/x'>menu</a></nav><footer>legal</footer>";
    expect(stripHtmlBlocks(html, ["nav", "footer"])).toBe("<p>keep</p>");
  });
});

describe("htmlToMarkdown", () => {
  test("converts headings, links, lists and strips scripts", () => {
    const md = htmlToMarkdown(
      "<script>alert(1)</script><h1>Title</h1><p>Hello <a href=\"/x\">link</a></p><ul><li>one</li></ul>",
    );
    expect(md).toContain("# Title");
    expect(md).toContain("[link](/x)");
    expect(md).toContain("- one");
    expect(md).not.toContain("alert");
  });

  test("never turns an unsafe scheme into a link", () => {
    const md = htmlToMarkdown('<a href="javascript:alert(1)">click</a>');
    expect(md).toContain("click");
    expect(md).not.toContain("javascript:");
    expect(md).not.toContain("](");
  });

  test("keeps code fences tidy", () => {
    expect(htmlToMarkdown("<pre><code>const a = 1;</code></pre>")).toBe("```\nconst a = 1;\n```\n");
  });
});
