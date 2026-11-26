#!/usr/bin/env node
/**
 * Conformance check for any Grapheway endpoint.
 *
 *   node scripts/conformance.mjs https://example.com
 *   npm run conformance -- http://localhost:4321
 *
 * It checks the public surface, not the internals: discovery, manifest,
 * graph, MCP and one built-in action. Exit code is non-zero on any failure,
 * so it can run in CI against a staging site.
 */

const base = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!base) {
  console.error("usage: node scripts/conformance.mjs <base-url>");
  process.exit(2);
}

const results = [];

function record(name, ok, detail = "") {
  results.push({ name, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function getJson(path) {
  const res = await fetch(base + path, { headers: { accept: "application/json" } });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  return { status: res.status, body, text };
}

async function postJson(path, payload) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }
  return { status: res.status, body, text };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// 1. Discovery
try {
  const { status, body } = await getJson("/.well-known/agent");
  const ok =
    status === 200 &&
    isObject(body) &&
    body.protocol === "grapheway" &&
    typeof body.version === "string" &&
    typeof body.name === "string" &&
    typeof body.url === "string";
  record("discovery document", ok, `status ${status}`);
} catch (err) {
  record("discovery document", false, String(err));
}

// 2. Manifest
let manifest;
try {
  const { status, body } = await getJson("/agent");
  manifest = body;
  const ok =
    status === 200 &&
    isObject(body) &&
    isObject(body.site) &&
    Array.isArray(body.sections) &&
    Array.isArray(body.actions);
  record("manifest", ok, `status ${status}`);
} catch (err) {
  record("manifest", false, String(err));
}

// 3. Graph summary and full graph
try {
  const summary = await getJson("/graph/v1");
  const full = await getJson("/graph/v1/graph");
  const ok =
    summary.status === 200 &&
    isObject(summary.body) &&
    Array.isArray(full.body?.nodes) &&
    Array.isArray(full.body?.edges);
  record("graph endpoints", ok, `${full.body?.nodes?.length ?? 0} nodes`);
} catch (err) {
  record("graph endpoints", false, String(err));
}

// 4. Search
try {
  const { status, body } = await getJson("/graph/v1/search?q=a&limit=3");
  const ok = status === 200 && Array.isArray(body?.results);
  record("graph search", ok, `status ${status}`);
} catch (err) {
  record("graph search", false, String(err));
}

// 5. MCP initialize and tools/list
try {
  const init = await postJson("/mcp", {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "grapheway-conformance", version: "1.0.0" },
    },
  });
  const tools = await postJson("/mcp", { jsonrpc: "2.0", id: 2, method: "tools/list" });
  const toolList = tools.body?.result?.tools;
  const annotated =
    Array.isArray(toolList) &&
    toolList.length > 0 &&
    toolList.every((tool) => isObject(tool.annotations));
  const ok =
    init.status === 200 &&
    init.body?.result?.serverInfo?.name === "grapheway" &&
    Array.isArray(toolList) &&
    toolList.length >= 8 &&
    annotated;
  record("MCP initialize and tools/list", ok, `${toolList?.length ?? 0} tools`);
} catch (err) {
  record("MCP initialize and tools/list", false, String(err));
}

// 6. Built-in action
try {
  const { status, body } = await postJson("/agent/action", {
    name: "get_site_info",
    arguments: {},
  });
  const ok = status === 200 && body?.ok === true && isObject(body.result);
  record("built-in action", ok, `status ${status}`);
} catch (err) {
  record("built-in action", false, String(err));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length > 0) {
  console.error(`\n${failed.length} check(s) failed against ${base}`);
  process.exit(1);
}
console.log(`\n${base} is Grapheway conformant.`);
