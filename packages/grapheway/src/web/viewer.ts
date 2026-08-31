/**
 * The grapheway graph viewer — served at `GET /graph`.
 *
 * A self-contained, zero-dependency web UI (inline CSS + vanilla JS, no
 * network requests beyond the site's own graph API). Renders the live
 * knowledge graph as an interactive force-directed map:
 *
 *   - hand-rolled Fruchterman-Reingold layout (no libraries)
 *   - nodes colored by type, edges by confidence (extracted/inferred/ambiguous)
 *   - pan/zoom, node dragging, hover tooltips, detail drawer
 *   - search (`/graph/v1/search`) and auditable paths (`/graph/v1/path`)
 *   - realtime: subscribes to `/graph/v1/events` and applies patches live
 *
 * Works on every grapheway surface — sites running `@grapheway/web`, the
 * `grapheway gateway`, and `serveProbed` surfaces — because it is served
 * by the shared handler.
 *
 * The HTML is a single static string: no server-side interpolation. Keep
 * the client JS free of template literals so this file stays a plain
 * `String.raw` template (the browser receives it verbatim).
 */

export const VIEWER_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Graph Observatory · grapheway</title>
<style>
  :root {
    --bg: #0a0e15;
    --panel: rgba(15, 23, 42, 0.82);
    --line: rgba(148, 163, 184, 0.16);
    --ink: #e2e8f0;
    --ink-dim: #8b9bb0;
    --ink-faint: #5b6b82;
    --amber: #f5b942;
    --cyan: #38c9e8;
    --rose: #fb718f;
    --page: #7dd3fc;
    --section: #f5b942;
    --entity: #a78bfa;
    --concept: #34d399;
    --api: #fb7185;
    --serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
    --sans: "Avenir Next", -apple-system, "Segoe UI", system-ui, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background:
      radial-gradient(1200px 700px at 70% -10%, rgba(56, 201, 232, 0.07), transparent 60%),
      radial-gradient(900px 600px at 10% 110%, rgba(167, 139, 250, 0.06), transparent 60%),
      linear-gradient(rgba(148,163,184,0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148,163,184,0.045) 1px, transparent 1px),
      var(--bg);
    background-size: auto, auto, 36px 36px, 36px 36px, auto;
    color: var(--ink);
    font-family: var(--sans);
    overflow: hidden;
  }
  ::selection { background: rgba(245, 185, 66, 0.28); }

  /* ── instrument HUD ─────────────────────────────────────────────── */
  .hud {
    position: fixed; inset: 14px 14px auto 14px; z-index: 20;
    display: flex; align-items: center; gap: 14px;
    padding: 10px 14px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    animation: hud-in 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }
  @keyframes hud-in { from { opacity: 0; transform: translateY(-12px); } }
  .brand { display: flex; flex-direction: column; line-height: 1; padding-right: 14px; border-right: 1px solid var(--line); }
  .brand b { font-family: var(--serif); font-size: 17px; letter-spacing: 0.02em; color: var(--ink); }
  .brand span { font-family: var(--mono); font-size: 9px; letter-spacing: 0.32em; text-transform: uppercase; color: var(--ink-faint); margin-top: 4px; }
  .stats { display: flex; gap: 16px; align-items: baseline; font-family: var(--mono); }
  .stat { display: flex; flex-direction: column; }
  .stat i { font-style: normal; font-size: 9px; letter-spacing: 0.22em; color: var(--ink-faint); text-transform: uppercase; }
  .stat b { font-size: 13px; font-variant-numeric: tabular-nums; color: var(--ink); margin-top: 2px; }
  .stat b.amber { color: var(--amber); }
  .live { display: flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 10px; letter-spacing: 0.22em; color: var(--ink-dim); }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--concept); box-shadow: 0 0 8px rgba(52, 211, 153, 0.9); }
  .dot.pulse { animation: pulse 0.9s ease-out 2; }
  @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.9); } 100% { transform: scale(1); } }
  .dot.off { background: var(--ink-faint); box-shadow: none; }

  .search { position: relative; margin-left: auto; }
  .search input {
    width: 220px; padding: 7px 12px 7px 30px;
    background: rgba(10, 14, 21, 0.7); border: 1px solid var(--line); border-radius: 8px;
    color: var(--ink); font-size: 12px; font-family: var(--mono);
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .search input:focus { border-color: var(--amber); box-shadow: 0 0 0 3px rgba(245, 185, 66, 0.14); }
  .search::before {
    content: ""; position: absolute; left: 10px; top: 50%; translate: 0 -50%;
    width: 8px; height: 8px; border: 1.5px solid var(--ink-faint); border-radius: 50%;
  }
  .search::after {
    content: ""; position: absolute; left: 18px; top: calc(50% + 4px); width: 4px; height: 1.5px;
    background: var(--ink-faint); transform: rotate(45deg);
  }
  .results {
    position: absolute; top: calc(100% + 6px); left: 0; width: 320px; max-height: 320px; overflow: auto;
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    backdrop-filter: blur(10px); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    display: none; z-index: 30;
  }
  .results.open { display: block; animation: pop 0.16s ease-out both; }
  @keyframes pop { from { opacity: 0; transform: translateY(-6px) scale(0.98); } }
  .results .item { padding: 9px 12px; cursor: pointer; border-bottom: 1px solid rgba(148,163,184,0.08); }
  .results .item:hover { background: rgba(56, 201, 232, 0.08); }
  .results .item b { display: block; font-size: 12px; font-weight: 600; }
  .results .item i { font-style: normal; font-family: var(--mono); font-size: 10px; color: var(--ink-faint); }
  .results .empty { padding: 12px; font-size: 11px; color: var(--ink-faint); font-family: var(--mono); }

  .tbtn {
    padding: 7px 11px; background: rgba(10, 14, 21, 0.7); border: 1px solid var(--line); border-radius: 8px;
    color: var(--ink-dim); font-size: 10px; font-family: var(--mono); letter-spacing: 0.18em; text-transform: uppercase;
    cursor: pointer; transition: all 0.18s;
  }
  .tbtn:hover { border-color: var(--cyan); color: var(--ink); }
  .tbtn.on { border-color: var(--amber); color: var(--amber); box-shadow: 0 0 0 3px rgba(245, 185, 66, 0.12); }

  .filters {
    position: fixed; top: 66px; right: 14px; z-index: 25;
    width: 236px; padding: 12px 14px;
    background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    backdrop-filter: blur(10px); box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    display: none;
  }
  .filters.open { display: block; animation: pop 0.16s ease-out both; }
  .filters h4 { font-size: 9px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; margin: 8px 0 7px; }
  .filters h4:first-child { margin-top: 0; }
  .chip { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 6px; cursor: pointer; font-size: 11px; color: var(--ink-dim); }
  .chip:hover { background: rgba(148, 163, 184, 0.08); }
  .chip .sw { width: 9px; height: 9px; border-radius: 3px; flex: none; }
  .chip.off { opacity: 0.35; text-decoration: line-through; }
  .chip b { font-family: var(--mono); font-weight: 500; }

  /* ── stage ──────────────────────────────────────────────────────── */
  #stage { position: fixed; inset: 0; cursor: grab; }
  #stage.dragging { cursor: grabbing; }
  svg { width: 100%; height: 100%; display: block; }
  .edge { stroke-width: 1; }
  .edge.hl { stroke-width: 2.6; filter: drop-shadow(0 0 4px rgba(245, 185, 66, 0.55)); }
  .edge.dim { opacity: 0.05; }
  .node { cursor: pointer; }
  .node.pop { animation: npop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) both; }
  @keyframes npop { 0% { transform: scale(0); } 70% { transform: scale(1.25); } 100% { transform: scale(1); } }
  .node .halo { opacity: 0; transition: opacity 0.18s; }
  .node:hover .halo { opacity: 1; }
  .node.sel .halo { opacity: 1; }
  .node.sel .core { stroke: var(--amber); }
  .node.hit .core { stroke: var(--cyan); stroke-dasharray: 3 2; }
  .node text { font-family: var(--mono); font-size: 10px; fill: #c8d4e3; paint-order: stroke; stroke: rgba(10, 14, 21, 0.9); stroke-width: 3px; pointer-events: none; }

  .empty-state, .loading {
    position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
    font-family: var(--mono); color: var(--ink-faint); z-index: 5;
  }
  .empty-state b { font-family: var(--serif); font-size: 22px; color: var(--ink-dim); font-weight: 400; }
  .loading { animation: fade 0.4s ease-out 2s forwards; }
  @keyframes fade { to { opacity: 0; visibility: hidden; } }
  .spin { width: 26px; height: 26px; border-radius: 50%; border: 2px solid rgba(148,163,184,0.2); border-top-color: var(--amber); animation: rot 0.9s linear infinite; }
  @keyframes rot { to { transform: rotate(360deg); } }

  /* ── drawer ─────────────────────────────────────────────────────── */
  .drawer {
    position: fixed; top: 66px; right: 14px; bottom: 14px; z-index: 24;
    width: 340px; overflow-y: auto;
    background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
    backdrop-filter: blur(12px); box-shadow: -12px 0 40px rgba(0, 0, 0, 0.5);
    transform: translateX(110%); transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1);
    padding: 16px;
  }
  .drawer.open { transform: translateX(0); }
  .drawer h2 { font-family: var(--serif); font-size: 18px; font-weight: 500; line-height: 1.3; padding-right: 26px; }
  .drawer .kicker { font-family: var(--mono); font-size: 9px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--ink-faint); margin-bottom: 6px; }
  .drawer .x { position: absolute; top: 12px; right: 12px; background: none; border: none; color: var(--ink-faint); font-size: 16px; cursor: pointer; }
  .drawer .x:hover { color: var(--ink); }
  .drawer .id { font-family: var(--mono); font-size: 10px; color: var(--ink-faint); word-break: break-all; margin: 8px 0 12px; }
  .drawer .props { display: grid; grid-template-columns: auto 1fr; gap: 5px 12px; font-size: 11.5px; margin: 10px 0; }
  .drawer .props dt { color: var(--ink-faint); font-family: var(--mono); font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; }
  .drawer .props dd { color: var(--ink); word-break: break-word; }
  .drawer h3 { font-size: 9px; letter-spacing: 0.26em; text-transform: uppercase; color: var(--ink-faint); font-weight: 600; margin: 16px 0 8px; }
  .nb { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; cursor: pointer; font-size: 12px; border: 1px solid transparent; }
  .nb:hover { background: rgba(56, 201, 232, 0.08); border-color: rgba(56, 201, 232, 0.25); }
  .nb .sw { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .nb i { font-style: normal; font-family: var(--mono); font-size: 10px; color: var(--ink-faint); flex: none; }
  .nb span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .path-row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 6px; align-items: center; margin: 10px 0; }
  .path-row input {
    width: 100%; padding: 7px 9px; background: rgba(10, 14, 21, 0.7); border: 1px solid var(--line); border-radius: 8px;
    color: var(--ink); font-size: 11px; font-family: var(--mono); outline: none;
  }
  .path-row input:focus { border-color: var(--amber); }
  .path-row .arr { color: var(--ink-faint); font-family: var(--mono); }
  .path-step { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-left: 2px solid rgba(148,163,184,0.2); margin: 4px 0 4px 6px; }
  .path-step .route { font-family: var(--mono); font-size: 11px; color: var(--ink); }
  .path-step .meta { display: flex; gap: 6px; flex-wrap: wrap; }
  .badge { font-family: var(--mono); font-size: 9px; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; border: 1px solid; }
  .badge.conf-extracted { color: var(--amber); border-color: rgba(245, 185, 66, 0.45); }
  .badge.conf-inferred { color: var(--cyan); border-color: rgba(56, 201, 232, 0.45); }
  .badge.conf-ambiguous { color: var(--rose); border-color: rgba(251, 113, 143, 0.45); }
  .badge.prov { color: var(--ink-dim); border-color: rgba(148, 163, 184, 0.35); }
  .path-step .note { font-size: 10.5px; color: var(--ink-faint); }
  .drawer .actions { display: flex; gap: 8px; margin-top: 14px; }

  .legend {
    position: fixed; left: 14px; bottom: 14px; z-index: 20;
    display: flex; gap: 14px; padding: 9px 13px; align-items: center;
    background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
    backdrop-filter: blur(10px); font-family: var(--mono); font-size: 10px; color: var(--ink-dim);
    animation: hud-in 0.5s 0.12s cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }
  .legend .lg { display: flex; align-items: center; gap: 5px; }
  .legend .lg .sw { width: 8px; height: 8px; border-radius: 2px; }
  .legend .lg .ln { width: 14px; height: 0; border-top: 2px solid; }

  .hint {
    position: fixed; right: 14px; bottom: 14px; z-index: 20;
    font-family: var(--mono); font-size: 9.5px; color: var(--ink-faint); letter-spacing: 0.08em;
    animation: hud-in 0.5s 0.22s cubic-bezier(0.2, 0.9, 0.3, 1) both;
  }

  .tooltip {
    position: fixed; z-index: 40; pointer-events: none;
    background: rgba(8, 11, 18, 0.94); border: 1px solid var(--line); border-radius: 9px;
    padding: 9px 11px; font-family: var(--mono); font-size: 10.5px; color: var(--ink);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55); max-width: 340px;
    display: none;
  }
  .tooltip.show { display: block; }
  .tooltip b { display: block; font-size: 11.5px; margin-bottom: 4px; font-family: var(--sans); }
  .tooltip .row { color: var(--ink-dim); margin-top: 3px; line-height: 1.5; }
  .tooltip .row b { display: inline; font-family: var(--mono); font-size: 10px; }

  @media (max-width: 860px) {
    .stats { display: none; }
    .search input { width: 140px; }
    .hint { display: none; }
    .drawer { width: min(340px, calc(100vw - 28px)); }
  }
</style>
</head>
<body>

<header class="hud">
  <div class="brand"><b>Grapheway</b><span>graph observatory</span></div>
  <div class="stats">
    <div class="stat"><i>Nodes</i><b id="sNodes">—</b></div>
    <div class="stat"><i>Edges</i><b id="sEdges">—</b></div>
    <div class="stat"><i>Version</i><b id="sVersion" class="amber">0</b></div>
  </div>
  <div class="search">
    <input id="q" type="search" placeholder="Search the graph…" autocomplete="off" spellcheck="false">
    <div class="results" id="qResults"></div>
  </div>
  <button class="tbtn" id="btnPath">Path</button>
  <button class="tbtn" id="btnLabels">Labels</button>
  <button class="tbtn" id="btnFilters">Legend</button>
  <button class="tbtn" id="btnExport">Export</button>
  <div class="live"><span class="dot" id="dot"></span><span id="liveTxt">CONNECTING</span></div>
</header>

<div class="filters" id="filters">
  <h4>Node types</h4>
  <div id="typeChips"></div>
  <h4>Edge confidence</h4>
  <div id="confChips"></div>
</div>

<aside class="drawer" id="drawer">
  <button class="x" id="drawerX" aria-label="Close">✕</button>
  <div id="drawerBody"></div>
</aside>

<main id="stage">
  <svg id="svg" role="img" aria-label="Knowledge graph">
    <defs>
      <radialGradient id="haloGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <g id="viewport"></g>
  </svg>
</main>

<div class="loading"><div class="spin"></div>charting the graph…</div>
<div class="empty-state" id="empty" style="display:none"><b>The observatory is empty</b><span>this graph has no nodes yet</span></div>

<div class="legend">
  <span class="lg"><span class="sw" style="background:#7dd3fc"></span>page</span>
  <span class="lg"><span class="sw" style="background:#f5b942"></span>section</span>
  <span class="lg"><span class="sw" style="background:#a78bfa"></span>entity</span>
  <span class="lg"><span class="sw" style="background:#34d399"></span>concept</span>
  <span class="lg"><span class="sw" style="background:#fb7185"></span>api</span>
  <span class="lg"><span class="ln" style="border-color:#f5b942"></span>extracted</span>
  <span class="lg"><span class="ln" style="border-color:#38c9e8"></span>inferred</span>
  <span class="lg"><span class="ln" style="border-color:#fb718f"></span>ambiguous</span>
</div>

<div class="hint">drag · pan &nbsp;|&nbsp; scroll · zoom &nbsp;|&nbsp; click · inspect</div>
<div class="tooltip" id="tooltip"></div>

<script>
(function () {
  "use strict";

  // ── palette ────────────────────────────────────────────────────────
  var NODE_COLORS = { page: "#7dd3fc", section: "#f5b942", entity: "#a78bfa", concept: "#34d399", api: "#fb7185" };
  var NODE_FALLBACK = "#94a3b8";
  var CONF_STYLE = {
    extracted: { color: "#f5b942", dash: "" },
    inferred: { color: "#38c9e8", dash: "7 5" },
    ambiguous: { color: "#fb718f", dash: "2 4" }
  };
  var CONF_FALLBACK = { color: "#64748b", dash: "" };

  // ── state ──────────────────────────────────────────────────────────
  var nodes = [], edges = [], byId = {}, pos = {};
  var version = 0, W = 0, H = 0;
  var view = { x: 0, y: 0, s: 1 };
  var drag = null, hover = null;
  var filters = { types: {}, conf: {} };
  var labelsOn = null; // null = auto
  var pathHl = null;   // { nodeIds:Set, edgeIds:Set }
  var selected = null;
  var siteInfo = null;
  var nodeEls = {}, edgeEls = {};
  // API root derived from the page URL: the viewer lives at <root>/graph, so
  // strip the trailing "/graph" — every other endpoint hangs off the root.
  var API = location.pathname.replace(/\/graph\/?$/, "").replace(/\/+$/, "");

  // ── dom ────────────────────────────────────────────────────────────
  var svg = document.getElementById("svg");
  var vg = document.getElementById("viewport");
  var tooltip = document.getElementById("tooltip");
  var drawer = document.getElementById("drawer");
  var drawerBody = document.getElementById("drawerBody");
  var q = document.getElementById("q");
  var qResults = document.getElementById("qResults");
  var empty = document.getElementById("empty");

  function $(id) { return document.getElementById(id); }

  function mks(tag, attrs) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    return el;
  }
  function mk(tag, attrs, parent) {
    var el = document.createElement(tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // ── sizing / view ──────────────────────────────────────────────────
  function resize() {
    W = svg.clientWidth; H = svg.clientHeight;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  }
  window.addEventListener("resize", resize);

  function applyView() {
    vg.setAttribute("transform", "translate(" + view.x + " " + view.y + ") scale(" + view.s + ")");
  }
  function resetView() {
    var n = nodes.length;
    if (!n) { view = { x: 0, y: 0, s: 1 }; applyView(); return; }
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (nd) {
      var p = pos[nd.id] || { x: 0, y: 0 };
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    var cw = maxX - minX || 1, ch = maxY - minY || 1;
    var s = clamp(Math.min((W - 160) / cw, (H - 160) / ch), 0.12, 2.4);
    view = { x: W / 2 - ((minX + maxX) / 2) * s, y: H / 2 - ((minY + maxY) / 2) * s, s: s };
    applyView();
  }

  // ── stats / hud ────────────────────────────────────────────────────
  function setStats() {
    $("sNodes").textContent = String(nodes.length);
    $("sEdges").textContent = String(edges.length);
    $("sVersion").textContent = String(version);
  }
  function pulseLive() {
    var d = $("dot"); d.classList.remove("pulse"); void d.offsetWidth; d.classList.add("pulse");
  }
  function setLiveTxt(t, ok) {
    $("liveTxt").textContent = t;
    var d = $("dot");
    if (ok === false) d.classList.add("off"); else d.classList.remove("off");
  }

  // ── force layout (Fruchterman-Reingold, no deps) ───────────────────
  function layout() {
    var n = nodes.length;
    if (!n) return;
    var area = Math.max(200, W * H * 0.55);
    var k = Math.sqrt(area / n);
    var temp = Math.sqrt(area) / 7;
    var R = Math.sqrt(area / Math.PI) * 0.48;
    nodes.forEach(function (nd, i) {
      var a = (i / n) * Math.PI * 2;
      pos[nd.id] = { x: W / 2 + Math.cos(a) * R, y: H / 2 + Math.sin(a) * R };
    });
    var disp = {};
    var maxTicks = 200, tick = 0;

    function physics() {
      var i, j, a, b, dx, dy, d2, d, f;
      for (i = 0; i < n; i++) disp[nodes[i].id] = { x: 0, y: 0 };
      // repulsion
      for (i = 0; i < n; i++) {
        a = pos[nodes[i].id];
        for (j = i + 1; j < n; j++) {
          b = pos[nodes[j].id];
          dx = a.x - b.x; dy = a.y - b.y;
          d2 = dx * dx + dy * dy || 1;
          d = Math.sqrt(d2);
          f = (k * k) / d;
          dx /= d; dy /= d;
          disp[nodes[i].id].x += dx * f; disp[nodes[i].id].y += dy * f;
          disp[nodes[j].id].x -= dx * f; disp[nodes[j].id].y -= dy * f;
        }
      }
      // springs
      for (i = 0; i < edges.length; i++) {
        var e = edges[i];
        a = pos[e.source]; b = pos[e.target];
        if (!a || !b) continue;
        dx = a.x - b.x; dy = a.y - b.y;
        d = Math.sqrt(dx * dx + dy * dy) || 1;
        f = (d * d) / k;
        dx /= d; dy /= d;
        disp[e.source].x -= dx * f; disp[e.source].y -= dy * f;
        disp[e.target].x += dx * f; disp[e.target].y += dy * f;
      }
      // apply
      for (i = 0; i < n; i++) {
        var id = nodes[i].id, p = pos[id], dp = disp[id];
        var len = Math.sqrt(dp.x * dp.x + dp.y * dp.y) || 1;
        var step = Math.min(len, temp);
        p.x += (dp.x / len) * step;
        p.y += (dp.y / len) * step;
        p.x = clamp(p.x, 40, W - 40);
        p.y = clamp(p.y, 60, H - 40);
      }
    }

    function step() {
      var i = 0;
      while (i < 6 && tick < maxTicks) { physics(); temp *= 0.99; tick++; i++; }
      render();
      if (tick < maxTicks) requestAnimationFrame(step); else fitAfterLayout();
    }
    requestAnimationFrame(step);
  }
  function fitAfterLayout() {
    // settle once, then frame the whole graph
    requestAnimationFrame(resetView);
  }

  // ── filtering ──────────────────────────────────────────────────────
  function nodeVisible(nd) {
    return !(filters.types[nd.type] === false);
  }
  function edgeVisible(e) {
    var c = e.confidence || "extracted";
    if (filters.conf[c] === false) return false;
    return nodeVisible(byId[e.source]) && nodeVisible(byId[e.target]);
  }
  function confStyle(c) { return CONF_STYLE[c] || CONF_FALLBACK; }

  // ── rendering ──────────────────────────────────────────────────────
  function render() {
    vg.textContent = "";
    nodeEls = {}; edgeEls = {};
    var showLabels = labelsOn === null ? nodes.length <= 90 : labelsOn;
    var i, e, nd, p;

    for (i = 0; i < edges.length; i++) {
      e = edges[i];
      var a = pos[e.source], b = pos[e.target];
      if (!a || !b || !edgeVisible(e)) continue;
      var cs = confStyle(e.confidence);
      var line = mks("line", {
        x1: a.x, y1: a.y, x2: b.x, y2: b.y,
        stroke: cs.color, "stroke-opacity": 0.42,
        "stroke-dasharray": cs.dash
      });
      line.setAttribute("class", "edge");
      if (pathHl && pathHl.edgeIds.has(e.id)) line.setAttribute("class", "edge hl");
      line.dataset.id = e.id;
      line.addEventListener("mouseenter", function (ev) { hoverEdge(ev, this.dataset.id); });
      line.addEventListener("mouseleave", hideTooltip);
      vg.appendChild(line);
      edgeEls[e.id] = line;
    }

    for (i = 0; i < nodes.length; i++) {
      nd = nodes[i];
      p = pos[nd.id];
      if (!p || !nodeVisible(nd)) continue;
      var g = mks("g", { transform: "translate(" + p.x + " " + p.y + ")" });
      g.setAttribute("class", "node");
      var color = NODE_COLORS[nd.type] || NODE_FALLBACK;
      var r = nd.type === "page" ? 8 : nd.type === "section" ? 6.5 : 5.5;
      var halo = mks("circle", { r: r + 9, fill: "url(#haloGrad)" });
      halo.setAttribute("class", "halo");
      var core = mks("circle", { r: r, fill: color, stroke: "rgba(10,14,21,0.85)", "stroke-width": 1.4 });
      core.setAttribute("class", "core");
      g.appendChild(halo); g.appendChild(core);
      if (selected === nd.id) g.setAttribute("class", "node sel");
      if (pathHl && pathHl.nodeIds.has(nd.id)) g.setAttribute("class", "node sel");
      if (hover && hover.id === nd.id) g.setAttribute("class", "node sel");
      var label = null;
      if (showLabels || hover === nd || selected === nd.id || (pathHl && pathHl.nodeIds.has(nd.id))) {
        label = mks("text", { x: r + 6, y: 3.5, "font-size": 10 });
        label.textContent = String(nd.label || nd.id).slice(0, 46);
        g.appendChild(label);
      }
      g.dataset.id = nd.id;
      g.addEventListener("mousedown", function (ev) { ev.stopPropagation(); startNodeDrag(ev, this.dataset.id); });
      g.addEventListener("mouseenter", function (ev) { hover = { id: this.dataset.id, kind: "node" }; showNodeTip(ev, this.dataset.id); });
      g.addEventListener("mouseleave", function () { hover = null; hideTooltip(); });
      vg.appendChild(g);
      nodeEls[nd.id] = g;
    }
  }

  // ── tooltips ───────────────────────────────────────────────────────
  function showTipAt(ev, html) {
    tooltip.innerHTML = html;
    tooltip.classList.add("show");
    var w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    var x = ev.clientX + 14, y = ev.clientY + 12;
    if (x + w > window.innerWidth - 8) x = ev.clientX - w - 10;
    if (y + h > window.innerHeight - 8) y = ev.clientY - h - 10;
    tooltip.style.left = x + "px"; tooltip.style.top = y + "px";
  }
  function showNodeTip(ev, id) {
    var nd = byId[id]; if (!nd) return;
    var props = "";
    if (nd.props) {
      if (nd.props.description) props = "<div class=\"row\">" + esc(nd.props.description) + "</div>";
      if (nd.props.url) props += "<div class=\"row\"><b>url</b> " + esc(nd.props.url) + "</div>";
    }
    showTipAt(ev, "<b>" + esc(nd.label || id) + "</b>" +
      "<div class=\"row\">" + esc(nd.type) + " · " + neighborsCount(id) + " connections</div>" + props);
  }
  function hoverEdge(ev, id) {
    var e = null;
    for (var i = 0; i < edges.length; i++) if (edges[i].id === id) { e = edges[i]; break; }
    if (!e) return;
    var cs = confStyle(e.confidence);
    showTipAt(ev, "<b>" + esc(e.label || e.type || "edge") + "</b>" +
      "<div class=\"row\">" + esc(e.type) + " — <span style=\"color:" + cs.color + "\">" + esc(e.confidence || "extracted") + "</span>" +
      (e.provenance ? " · " + esc(e.provenance) : "") + "</div>" +
      (e.note ? "<div class=\"row\">" + esc(e.note) + "</div>" : ""));
  }
  function hideTooltip() { tooltip.classList.remove("show"); }
  function neighborsCount(id) {
    var c = 0;
    for (var i = 0; i < edges.length; i++) {
      var e = edges[i];
      if (e.source === id || e.target === id) c++;
    }
    return c;
  }

  // ── selection + drawer ─────────────────────────────────────────────
  function openDrawer() { drawer.classList.add("open"); }
  function closeDrawer() { drawer.classList.remove("open"); selected = null; render(); }
  $("drawerX").addEventListener("click", closeDrawer);

  function selectNode(id, focus) {
    selected = id;
    if (focus) centerOn(id);
    render();
    fetchNodeDetail(id);
  }
  function centerOn(id) {
    var p = pos[id]; if (!p) return;
    view.x = W / 2 - p.x * view.s; view.y = H / 2 - p.y * view.s;
    applyView();
  }

  function fetchNodeDetail(id) {
    openDrawer();
    drawerBody.innerHTML = "<div class=\"spin\" style=\"margin:40px auto\"></div>";
    var nd = byId[id];
    var head = "";
    if (nd) {
      head = "<div class=\"kicker\">" + esc(nd.type) + " node</div><h2>" + esc(nd.label || id) + "</h2>" +
        "<div class=\"id\">" + esc(id) + "</div>";
    }
    Promise.all([
      fetch(API + "/graph/v1/node?id=" + encodeURIComponent(id)).then(function (r) { return r.json(); }).catch(function () { return null; }),
      fetch(API + "/graph/v1/edges?id=" + encodeURIComponent(id) + "&direction=both").then(function (r) { return r.json(); }).catch(function () { return null; })
    ]).then(function (res) {
      var node = res[0] || nd, nb = res[1];
      var props = "";
      if (node && node.props) {
        var keys = Object.keys(node.props).filter(function (k) { return node.props[k] != null && node.props[k] !== ""; }).slice(0, 10);
        if (keys.length) {
          props = "<dl class=\"props\">";
          keys.forEach(function (k) {
            var v = node.props[k];
            props += "<dt>" + esc(k) + "</dt><dd>" + esc(typeof v === "object" ? JSON.stringify(v) : v) + "</dd>";
          });
          props += "</dl>";
        }
      }
      var neighbors = "";
      if (nb && nb.nodes && nb.nodes.length) {
        neighbors = "<h3>Neighbors · " + nb.nodes.length + "</h3>";
        nb.nodes.forEach(function (other) {
          var e = null;
          for (var i = 0; i < nb.edges.length; i++) {
            var te = nb.edges[i];
            if (te.source === other.id || te.target === other.id) { e = te; break; }
          }
          var color = NODE_COLORS[other.type] || NODE_FALLBACK;
          var kind = e ? (e.source === other.id ? "←" : "→") : "·";
          neighbors += "<div class=\"nb\" data-id=\"" + esc(other.id) + "\">" +
            "<span class=\"sw\" style=\"background:" + color + "\"></span>" +
            "<i>" + kind + "</i><span>" + esc(other.label || other.id) + "</span></div>";
        });
      } else {
        neighbors = "<h3>Neighbors</h3><p style=\"font-size:11px;color:var(--ink-faint)\">none yet</p>";
      }
      var pathBtn = siteInfo && siteInfo.url
        ? "<div class=\"actions\"><button class=\"tbtn\" id=\"btnPathTo\">Path from site root</button></div>"
        : "";
      drawerBody.innerHTML = head + props + neighbors + pathBtn;
      var pathTo = $("btnPathTo");
      if (pathTo) pathTo.addEventListener("click", function () { runPath(siteInfo.url, id); });
      Array.prototype.forEach.call(drawerBody.querySelectorAll(".nb"), function (row) {
        row.addEventListener("click", function () { selectNode(row.dataset.id, false); });
      });
    });
  }

  // ── search ─────────────────────────────────────────────────────────
  var searchTimer = null;
  q.addEventListener("input", function () {
    clearTimeout(searchTimer);
    var term = q.value.trim();
    if (!term) { closeSearch(); return; }
    searchTimer = setTimeout(function () { runSearch(term); }, 220);
  });
  q.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { q.value = ""; closeSearch(); }
    if (ev.key === "Enter") {
      var first = qResults.querySelector(".item");
      if (first) { q.value = ""; closeSearch(); selectNode(first.dataset.id, true); }
    }
  });
  document.addEventListener("click", function (ev) {
    if (!ev.target.closest(".search")) closeSearch();
  });
  function closeSearch() { qResults.classList.remove("open"); qResults.innerHTML = ""; }
  function runSearch(term) {
    fetch(API + "/graph/v1/search?q=" + encodeURIComponent(term) + "&limit=8")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        qResults.innerHTML = "";
        if (!d.results || !d.results.length) {
          qResults.innerHTML = "<div class=\"empty\">no matches</div>";
        } else {
          d.results.forEach(function (hit) {
            var nd = hit.node;
            var row = mk("div", { class: "item", "data-id": nd.id });
            var color = NODE_COLORS[nd.type] || NODE_FALLBACK;
            var score = typeof hit.score === "number" && Number.isFinite(hit.score) ? hit.score.toFixed(2) : "?";
            row.innerHTML = "<span style=\"display:inline-block;width:8px;height:8px;border-radius:50%;background:" + color + ";margin-right:7px\"></span><b>" +
              esc(nd.label || nd.id) + "</b><i>" + esc(nd.type) + " · score " + score + "</i>";
            row.addEventListener("click", function () { q.value = ""; closeSearch(); selectNode(nd.id, true); });
            qResults.appendChild(row);
          });
        }
        qResults.classList.add("open");
      })
      .catch(function () {});
  }

  // ── paths ──────────────────────────────────────────────────────────
  var pathMode = false;
  var pathInputs = null;
  $("btnPath").addEventListener("click", function () {
    pathMode = !pathMode;
    this.classList.toggle("on", pathMode);
    if (pathMode) showPathPanel(); else { clearPath(); closeDrawer(); }
  });
  function showPathPanel() {
    openDrawer();
    var opts = "<datalist id=\"nodeList\">";
    nodes.forEach(function (nd) { opts += "<option value=\"" + esc(nd.id) + "\">" + esc(nd.label || nd.id) + "</option>"; });
    opts += "</datalist>";
    drawerBody.innerHTML =
      "<div class=\"kicker\">path inspector</div><h2>Walk the graph</h2>" +
      "<div class=\"path-row\"><input id=\"pf\" list=\"nodeList\" placeholder=\"from…\"><span class=\"arr\">→</span><input id=\"pt\" list=\"nodeList\" placeholder=\"to…\"></div>" +
      "<div class=\"actions\"><button class=\"tbtn\" id=\"btnFind\">Find auditable path</button></div>" +
      opts + "<div id=\"pathOut\"></div>";
    pathInputs = { f: $("pf"), t: $("pt") };
    $("btnFind").addEventListener("click", function () {
      var f = pathInputs.f.value.trim(), t = pathInputs.t.value.trim();
      if (f && t) runPath(f, t);
    });
  }
  function runPath(from, to) {
    fetch(API + "/graph/v1/path?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to))
      .then(function (r) { return r.status === 200 ? r.json() : null; })
      .then(function (d) {
        if (!d) {
          pathHl = null; render();
          var out = $("pathOut");
          if (out) out.innerHTML = "<p style=\"font-size:11px;color:var(--rose);margin-top:10px\">no path found</p>";
          return;
        }
        var nodeIds = {}, edgeIds = {};
        d.path.forEach(function (id) { nodeIds[id] = true; });
        d.edges.forEach(function (e) { edgeIds[e.id] = true; });
        pathHl = { nodeIds: nodeIds, edgeIds: edgeIds };
        var steps = "";
        d.edges.forEach(function (e) {
          var cs = confStyle(e.confidence);
          steps += "<div class=\"path-step\"><div class=\"route\">" + esc(e.source) + " → " + esc(e.target) + "</div>" +
            "<div class=\"meta\"><span class=\"badge conf-" + esc(e.confidence || "extracted") + "\">" + esc(e.confidence || "extracted") + "</span>" +
            "<span class=\"badge prov\">" + esc(e.type) + (e.provenance ? " · " + e.provenance : "") + "</span></div>" +
            (e.note ? "<div class=\"note\">" + esc(e.note) + "</div>" : "") + "</div>";
        });
        drawerBody.innerHTML =
          "<div class=\"kicker\">auditable path</div><h2>" + esc(from) + "</h2>" +
          "<div style=\"font-family:var(--mono);font-size:11px;color:var(--ink-dim);margin:4px 0 10px\">↓ " + d.path.length + " hops →</div>" +
          steps +
          "<div class=\"actions\"><button class=\"tbtn\" id=\"btnPathClear\">Clear</button></div>";
        $("btnPathClear").addEventListener("click", function () { clearPath(); showPathPanel(); });
        render();
      })
      .catch(function () {});
  }
  function clearPath() { pathHl = null; render(); }

  // ── export ─────────────────────────────────────────────────────────
  $("btnExport").addEventListener("click", function () {
    fetch(API + "/graph/v1/graph")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var blob = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "graph.json";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      });
  });

  // ── labels + filters ───────────────────────────────────────────────
  $("btnLabels").addEventListener("click", function () {
    labelsOn = labelsOn === null ? false : labelsOn === false ? true : null;
    this.classList.toggle("on", labelsOn === true);
    render();
  });
  $("btnFilters").addEventListener("click", function () {
    var f = $("filters"); f.classList.toggle("open");
    if (f.classList.contains("open")) buildFilterChips();
  });
  function buildFilterChips() {
    var types = {};
    nodes.forEach(function (nd) { types[nd.type] = true; });
    var tc = $("typeChips"); tc.innerHTML = "";
    Object.keys(types).sort().forEach(function (t) {
      var chip = mk("div", { class: "chip" });
      if (filters.types[t] === false) chip.classList.add("off");
      chip.innerHTML = "<span class=\"sw\" style=\"background:" + (NODE_COLORS[t] || NODE_FALLBACK) + "\"></span><b>" + esc(t) + "</b>";
      chip.addEventListener("click", function () {
        if (filters.types[t] === false) delete filters.types[t]; else filters.types[t] = false;
        buildFilterChips(); render();
      });
      tc.appendChild(chip);
    });
    var cc = $("confChips"); cc.innerHTML = "";
    ["extracted", "inferred", "ambiguous"].forEach(function (c) {
      var chip = mk("div", { class: "chip" });
      if (filters.conf[c] === false) chip.classList.add("off");
      chip.innerHTML = "<span class=\"ln\" style=\"width:14px;border-top:2px solid " + CONF_STYLE[c].color + "\"></span><b>" + c + "</b>";
      chip.addEventListener("click", function () {
        if (filters.conf[c] === false) delete filters.conf[c]; else filters.conf[c] = false;
        buildFilterChips(); render();
      });
      cc.appendChild(chip);
    });
  }

  // ── interaction: pan / zoom / drag ─────────────────────────────────
  var stage = $("stage");
  stage.addEventListener("mousedown", function (ev) {
    if (ev.target === svg || ev.target === vg) {
      drag = { kind: "pan", sx: ev.clientX, sy: ev.clientY, vx: view.x, vy: view.y, moved: false };
      stage.classList.add("dragging");
      ev.preventDefault();
    }
  });
  window.addEventListener("mousemove", function (ev) {
    if (!drag) return;
    if (drag.kind === "pan") {
      var dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      view.x = drag.vx + dx; view.y = drag.vy + dy;
      applyView();
    } else if (drag.kind === "node") {
      var p = pos[drag.id];
      if (!p) return;
      p.x = drag.nx + (ev.clientX - drag.sx) / view.s;
      p.y = drag.ny + (ev.clientY - drag.sy) / view.s;
      // Cheap incremental update: move the node group + its incident edges,
      // instead of rebuilding the whole SVG on every mousemove.
      var g = nodeEls[drag.id];
      if (g) g.setAttribute("transform", "translate(" + p.x + " " + p.y + ")");
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        if (e.source === drag.id || e.target === drag.id) {
          var line = edgeEls[e.id];
          var a = pos[e.source], b = pos[e.target];
          if (line && a && b) {
            line.setAttribute("x1", a.x); line.setAttribute("y1", a.y);
            line.setAttribute("x2", b.x); line.setAttribute("y2", b.y);
          }
        }
      }
    }
  });
  window.addEventListener("mouseup", function (ev) {
    if (!drag) return;
    if (drag.kind === "node" && !drag.moved) selectNode(drag.id, false);
    drag = null;
    stage.classList.remove("dragging");
    render();
  });
  function startNodeDrag(ev, id) {
    var p = pos[id]; if (!p) return;
    drag = { kind: "node", id: id, sx: ev.clientX, sy: ev.clientY, nx: p.x, ny: p.y, moved: false };
    stage.classList.add("dragging");
  }
  svg.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    var rect = svg.getBoundingClientRect();
    var cx = ev.clientX - rect.left, cy = ev.clientY - rect.top;
    var factor = ev.deltaY < 0 ? 1.12 : 0.9;
    var ns = clamp(view.s * factor, 0.08, 4);
    var k = ns / view.s;
    view.x = cx - (cx - view.x) * k;
    view.y = cy - (cy - view.y) * k;
    view.s = ns;
    applyView();
  }, { passive: false });
  svg.addEventListener("dblclick", resetView);

  // ── realtime (SSE) ─────────────────────────────────────────────────
  function connect() {
    var es;
    try { es = new EventSource(API + "/graph/v1/events"); }
    catch (e) { setLiveTxt("NO STREAM", false); return; }
    es.addEventListener("graph", function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      applyMessage(msg);
    });
    es.onopen = function () { setLiveTxt("LIVE"); };
    es.onerror = function () { setLiveTxt("RECONNECTING", false); };
  }

  function reload() {
    fetch(API + "/graph/v1/graph")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        nodes = d.nodes || []; edges = d.edges || []; version = d.version || 0;
        byId = {};
        nodes.forEach(function (nd) { byId[nd.id] = nd; });
        setStats(); render();
      })
      .catch(function () {});
  }

  function applyMessage(msg) {
    if (msg.type === "snapshot") {
      var snapVersion = msg.version || 0;
      if (snapVersion > version) {
        // Patches landed between our full-graph fetch and the SSE connect
        // (or we missed some) — re-sync rather than guess.
        version = snapVersion; setStats(); reload();
      } else {
        version = snapVersion; setStats();
      }
      return;
    }
    var changed = false;
    var patches = msg.patches || [];
    for (var i = 0; i < patches.length; i++) {
      var p = patches[i];
      if (applyPatch(p)) changed = true;
    }
    version = msg.version != null ? msg.version : version;
    setStats();
    if (changed) { pulseLive(); render(); }
  }
  function applyPatch(p) {
    if (p.type === "add_node") {
      if (byId[p.node.id]) return false;
      nodes.push(p.node); byId[p.node.id] = p.node;
      pos[p.node.id] = { x: W / 2 + (Math.random() - 0.5) * 80, y: H / 2 + (Math.random() - 0.5) * 80 };
      return true;
    }
    if (p.type === "remove_node") {
      if (!byId[p.id]) return false;
      delete byId[p.id];
      delete pos[p.id];
      nodes = nodes.filter(function (n) { return n.id !== p.id; });
      edges = edges.filter(function (e) { return e.source !== p.id && e.target !== p.id; });
      if (selected === p.id) { selected = null; closeDrawer(); }
      return true;
    }
    if (p.type === "add_edge") {
      if (edges.some(function (e) { return e.id === p.edge.id; })) return false;
      edges.push(p.edge);
      return true;
    }
    if (p.type === "remove_edge") {
      var before = edges.length;
      edges = edges.filter(function (e) { return e.id !== p.id; });
      return edges.length !== before;
    }
    if (p.type === "set_node_meta") {
      var nd = byId[p.id];
      if (!nd) return false;
      nd.props = nd.props || {};
      for (var k in p.meta) nd.props[k] = p.meta[k];
      return true;
    }
    return false;
  }

  // ── boot ───────────────────────────────────────────────────────────
  function boot() {
    resize();
    fetch(API + "/agent/info").then(function (r) { return r.json(); }).then(function (info) { siteInfo = info; })
      .catch(function () {});
    fetch(API + "/graph/v1/graph")
      .then(function (r) {
        if (r.status === 404) throw new Error("no graph endpoint");
        return r.json();
      })
      .then(function (d) {
        nodes = d.nodes || []; edges = d.edges || []; version = d.version || 0;
        byId = {};
        nodes.forEach(function (nd) { byId[nd.id] = nd; });
        setStats();
        if (!nodes.length) {
          empty.style.display = "flex";
          document.querySelector(".loading").style.display = "none";
          setLiveTxt("EMPTY", false);
          return;
        }
        layout();
        connect();
      })
      .catch(function (err) {
        document.querySelector(".loading").style.display = "none";
        empty.style.display = "flex";
        empty.querySelector("span").textContent = "could not reach the graph API — is the server running?";
        setLiveTxt("OFFLINE", false);
      });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
</script>
</body>
</html>`;
