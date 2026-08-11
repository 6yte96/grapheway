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

console.log("9. graph_path root → Weather Beacon:");
const path = await client.graphPath("http://localhost:4321", "http://localhost:4321/products/weather-beacon");
console.log("   ", path?.join(" → "), "\n");

console.log("Done. The agent read this site by traversing its graph — no paid crawler needed.");
