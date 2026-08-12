/**
 * Demo of the agent-side of grapheway, run against the example site.
 *
 * 1. Start the site:  bun run examples/simple-site/server.ts
 * 2. Run the demo:    bun run examples/simple-site/demo.ts
 *
 * This is exactly what an AI agent would do to read info and perform
 * basic actions on an agent-ready site.
 */
import { GraphewayClient } from "@grapheway/agent";

const client = new GraphewayClient("http://localhost:4321");

console.log("== grapheway agent demo ==\n");

const manifest = await client.getManifest();
console.log(`Site:    ${manifest.site.name}`);
console.log(`Summary: ${manifest.site.summary?.slice(0, 100)}…`);
console.log(`Actions: ${manifest.actions.map((a) => a.name).join(", ")}`);
console.log(`MCP:     ${manifest.endpoints.mcp}\n`);

console.log("1. get_site_info:");
console.log("   ", JSON.stringify(await client.getSiteInfo()).slice(0, 140), "…\n");

console.log("2. list_sections:");
const sections = await client.getSections();
for (const s of sections) {
  console.log(`   - ${s.title} (${s.items?.length ?? 0} items)`);
}
console.log();

console.log("3. search_content('weather'):");
console.log("   ", JSON.stringify(await client.search("weather")), "\n");

console.log("4. get_page('/docs/install'):");
console.log((await client.getPage("/docs/install")).slice(0, 200), "\n");

console.log("5. custom action check_device_status(WB-0001):");
console.log("   ", JSON.stringify(await client.callAction("check_device_status", { serial: "WB-0001" })), "\n");

console.log("6. llms.txt (first 6 lines):");
const llms = await client.getLlmsTxt();
console.log(llms.split("\n").slice(0, 6).join("\n"), "\n");

console.log("7. discovery (/.well-known/agent):");
const discovery = await client.getDiscovery();
console.log(
  `   protocol=${discovery.protocol} · nodes=${discovery.graph.nodes} · edges=${discovery.graph.edges}`,
  "\n",
);

console.log("8. traverse the graph natively (no crawler):");
const walked = await client.traverse("http://localhost:4321", 2);
console.log(
  `   visited ${walked.nodes.length} nodes via ${walked.edges.length} edges: ${walked.nodes
    .map((n) => n.label)
    .join(", ")}`,
  "\n",
);

console.log("9. graph_path root → Weather Beacon (auditable path):");
const pathRes = await client.graphPath(
  "http://localhost:4321",
  "http://localhost:4321/products/weather-beacon",
);
console.log("   path:", pathRes?.path.join(" → "));
if (pathRes?.edges.length) {
  console.log("   evidence (edge behind each hop):");
  for (const e of pathRes.edges) {
    console.log(`     ${e.source} ──${e.type}[${e.confidence ?? "?"}]──▶ ${e.target}  · ${e.note ?? e.provenance ?? ""}`);
  }
}
console.log();

console.log("10. subscribe to live graph updates (SSE /graph/v1/events):");
const unsub = await client.subscribeGraph((ev) => {
  const d = ev.data as { type?: string; version?: number; patches?: Array<Record<string, unknown>> };
  console.log(`   [${ev.event}] graph v${d.version ?? "?"}${d.type ? ` · ${d.type}` : ""}${d.patches ? ` · ${d.patches.length} patch(es)` : ""}`);
  for (const p of d.patches ?? []) {
    const kind = String(p.type ?? "");
    if (kind === "add_node") console.log(`     + node: ${String((p.node as { label?: string })?.label ?? "")}`);
    if (kind === "add_edge") {
      const e = p.edge as { source?: string; target?: string; confidence?: string; note?: string };
      console.log(`     + edge: ${e.source} ──▶ ${e.target} [${e.confidence ?? "?"}] · ${e.note ?? ""}`);
    }
  }
});
// Listen for ~5s to catch the server's runtime patch, then unsubscribe.
await new Promise((r) => setTimeout(r, 5_000));
unsub();
console.log();

console.log("Done. The agent read this site by traversing its graph — no paid crawler needed.");
