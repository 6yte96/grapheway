/**
 * Minimal, linear HTML helpers.
 *
 * Everything here scans with `indexOf` and single passes instead of regexes
 * that backtrack. That keeps untrusted page content from turning into a
 * denial of service and keeps the static analyser quiet about sanitisers it
 * cannot reason about.
 *
 * The parser is deliberately small: it is not a WHATWG HTML5 parser. It
 * understands tags, quoted attributes, comments and raw-text elements, which
 * is all the runtime and the probe need for docs and marketing pages.
 */

export interface HtmlTag {
  /** Lowercase tag name. */
  name: string;
  /** Raw attributes text, excluding the tag name and the closing `>`. */
  attrs: string;
  closing: boolean;
  selfClosing: boolean;
  /** Index of `<` in the source. */
  start: number;
  /** Index just past `>` in the source. */
  end: number;
}

export type HtmlToken =
  | { kind: "text"; text: string }
  | { kind: "tag"; tag: HtmlTag };

/** Elements whose content is not markup and should not reach markdown. */
const SKIP_CONTENT = new Set(["script", "style", "noscript"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function isSpace(c: string | undefined): boolean {
  return c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f";
}

/** Decode the common named and numeric entities in a single pass. */
export function decodeHtmlEntities(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const amp = text.indexOf("&", i);
    if (amp < 0) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, amp);
    const semi = text.indexOf(";", amp + 1);
    // Entities are short. A distant `;` means this `&` is literal text.
    if (semi < 0 || semi - amp > 12) {
      out += "&";
      i = amp + 1;
      continue;
    }
    const body = text.slice(amp + 1, semi);
    const decoded = decodeEntityBody(body);
    out += decoded ?? "&";
    i = decoded === null ? amp + 1 : semi + 1;
  }
  return out;
}

function decodeEntityBody(body: string): string | null {
  if (!body) return null;
  if (body[0] === "#") {
    const hex = body[1] === "x" || body[1] === "X";
    const digits = hex ? body.slice(2) : body.slice(1);
    if (!digits || !/^[0-9a-fA-F]+$/.test(digits)) return null;
    const code = Number.parseInt(digits, hex ? 16 : 10);
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return null;
    try {
      return String.fromCodePoint(code);
    } catch {
      return null;
    }
  }
  return NAMED_ENTITIES[body.toLowerCase()] ?? null;
}

/** Remove tags and replace each with a space. Linear over the input. */
export function stripHtmlTags(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      out += html.slice(i);
      break;
    }
    out += html.slice(i, lt);
    const gt = html.indexOf(">", lt + 1);
    if (gt < 0) {
      out += html.slice(lt);
      break;
    }
    out += " ";
    i = gt + 1;
  }
  return out;
}

function parseTag(html: string, start: number, end: number): HtmlTag | null {
  let i = start + 1;
  let closing = false;
  if (html[i] === "/") {
    closing = true;
    i++;
  }
  const nameStart = i;
  while (i < end) {
    const c = html[i]!;
    if (isSpace(c) || c === "/" || c === ">") break;
    i++;
  }
  const name = html.slice(nameStart, i).toLowerCase();
  if (!name) return null;
  if (!/^[a-z][a-z0-9:-]*$/.test(name)) return null;
  const attrs = html.slice(i, end);
  const selfClosing = attrs.trimEnd().endsWith("/");
  return { name, attrs, closing, selfClosing, start, end: end + 1 };
}

/** Split an HTML string into text and tag tokens. */
export function tokenizeHtml(html: string): HtmlToken[] {
  const tokens: HtmlToken[] = [];
  const lower = html.toLowerCase();
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      tokens.push({ kind: "text", text: html.slice(i) });
      break;
    }
    if (lt > i) tokens.push({ kind: "text", text: html.slice(i, lt) });
    if (html.startsWith("<!--", lt)) {
      const close = html.indexOf("-->", lt + 4);
      i = close < 0 ? html.length : close + 3;
      continue;
    }
    const gt = html.indexOf(">", lt + 1);
    if (gt < 0) {
      tokens.push({ kind: "text", text: html.slice(lt) });
      break;
    }
    const tag = parseTag(html, lt, gt);
    i = gt + 1;
    if (!tag) continue;
    tokens.push({ kind: "tag", tag });
    if (!tag.closing && !tag.selfClosing && SKIP_CONTENT.has(tag.name)) {
      const close = lower.indexOf(`</${tag.name}`, i);
      if (close < 0) {
        i = html.length;
      } else {
        i = close;
      }
    }
  }
  return tokens;
}

/** Read one attribute value from a raw attribute string. */
export function getHtmlAttribute(attrs: string, name: string): string | null {
  const target = name.toLowerCase();
  let i = 0;
  while (i < attrs.length) {
    while (i < attrs.length && (isSpace(attrs[i]) || attrs[i] === "/")) i++;
    if (i >= attrs.length) break;
    const nameStart = i;
    while (i < attrs.length) {
      const c = attrs[i]!;
      if (isSpace(c) || c === "=" || c === "/" || c === ">") break;
      i++;
    }
    const attrName = attrs.slice(nameStart, i).toLowerCase();
    if (!attrName) {
      i++;
      continue;
    }
    while (i < attrs.length && isSpace(attrs[i])) i++;
    let value = "";
    if (attrs[i] === "=") {
      i++;
      while (i < attrs.length && isSpace(attrs[i])) i++;
      const quote = attrs[i];
      if (quote === '"' || quote === "'") {
        i++;
        const valueStart = i;
        while (i < attrs.length && attrs[i] !== quote) i++;
        value = attrs.slice(valueStart, i);
        i++;
      } else {
        const valueStart = i;
        while (i < attrs.length && !isSpace(attrs[i]) && attrs[i] !== ">") i++;
        value = attrs.slice(valueStart, i);
      }
    }
    if (attrName === target) return value;
  }
  return null;
}

/** Text content of a tag, entities decoded and whitespace collapsed. */
export function textContent(rawHtml: string): string {
  return decodeHtmlEntities(stripHtmlTags(rawHtml)).replace(/\s+/g, " ").trim();
}

/**
 * Remove whole elements (including their content) such as `nav` or `footer`.
 * Linear: each removed block is skipped by locating its close tag.
 */
export function stripHtmlBlocks(html: string, names: string[]): string {
  if (names.length === 0) return html;
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  const lower = html.toLowerCase();
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      out += html.slice(i);
      break;
    }
    const gt = html.indexOf(">", lt + 1);
    if (gt < 0) {
      out += html.slice(i);
      break;
    }
    const tag = parseTag(html, lt, gt);
    if (tag && !tag.closing && !tag.selfClosing && wanted.has(tag.name)) {
      out += html.slice(i, lt);
      const close = lower.indexOf(`</${tag.name}`, gt + 1);
      if (close < 0) break;
      const closeEnd = html.indexOf(">", close);
      i = closeEnd < 0 ? html.length : closeEnd + 1;
      continue;
    }
    out += html.slice(i, gt + 1);
    i = gt + 1;
  }
  return out;
}

/** Collapse whitespace while preserving at most one newline run. */
function normalText(raw: string): string {
  return decodeHtmlEntities(raw).replace(/\s+/g, " ");
}

/**
 * Best-effort HTML to Markdown, good enough for agents to read content.
 * Token based, so it never backtracks on hostile input.
 */
export function htmlToMarkdown(html: string): string {
  const tokens = tokenizeHtml(html);
  let out = "";
  let inPre = false;
  let linkHref: string | null = null;

  const ensureBlankLine = () => {
    if (out.length === 0 || out.endsWith("\n\n")) return;
    out += out.endsWith("\n") ? "\n" : "\n\n";
  };

  for (const token of tokens) {
    if (token.kind === "text") {
      const text = inPre ? decodeHtmlEntities(token.text) : normalText(token.text);
      if (text.trim()) out += text;
      continue;
    }
    const tag = token.tag;
    const name = tag.name;
    if (tag.closing) {
      if (name === "p" || isBlockTag(name)) {
        ensureBlankLine();
      } else if (name === "li") {
        if (!out.endsWith("\n")) out += "\n";
      } else if (name === "h1" || name === "h2" || name === "h3" || name === "h4" || name === "h5" || name === "h6") {
        ensureBlankLine();
      } else if (name === "pre") {
        inPre = false;
        if (!out.endsWith("\n")) out += "\n";
        out += "```\n\n";
      } else if (name === "code" && !inPre) {
        out += "`";
      } else if (name === "strong" || name === "b") {
        out += "**";
      } else if (name === "em" || name === "i") {
        out += "_";
      } else if (name === "a") {
        if (linkHref !== null) out += `](${linkHref})`;
        linkHref = null;
      }
      continue;
    }

    if (tag.selfClosing) {
      if (name === "br") out += "\n";
      continue;
    }

    if (name === "h1" || name === "h2" || name === "h3" || name === "h4" || name === "h5" || name === "h6") {
      const level = Number(name[1]);
      ensureBlankLine();
      out += `${"#".repeat(level)} `;
    } else if (name === "li") {
      if (!out.endsWith("\n")) out += "\n";
      out += "- ";
    } else if (name === "p" || isBlockTag(name)) {
      ensureBlankLine();
    } else if (name === "pre") {
      ensureBlankLine();
      out += "```\n";
      inPre = true;
    } else if (name === "code" && !inPre) {
      out += "`";
    } else if (name === "strong" || name === "b") {
      out += "**";
    } else if (name === "em" || name === "i") {
      out += "_";
    } else if (name === "a") {
      const href = getHtmlAttribute(tag.attrs, "href");
      if (href && isHttpHref(href)) {
        linkHref = href;
        out += "[";
      }
    } else if (name === "br") {
      out += "\n";
    }
  }

  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

function isBlockTag(name: string): boolean {
  return (
    name === "div" ||
    name === "section" ||
    name === "article" ||
    name === "main" ||
    name === "header" ||
    name === "footer" ||
    name === "aside" ||
    name === "nav" ||
    name === "table" ||
    name === "tr" ||
    name === "ul" ||
    name === "ol" ||
    name === "blockquote"
  );
}

/** True for links an agent can safely follow. */
export function isHttpHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed, "http://placeholder.invalid");
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
