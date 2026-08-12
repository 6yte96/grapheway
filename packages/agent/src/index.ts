/**
 * @grapheway/agent — the agent side of grapheway.
 *
 * A typed client for any grapheway endpoint — a site running
 * `@grapheway/web`, a `grapheway gateway`, or a `grapheway probe` surface:
 *
 *   const client = new GraphewayClient("http://localhost:4321");
 *   await client.getManifest();   // site info + sections + actions
 *   await client.search("pricing");
 *   await client.graphPath("/", "/api-reference");
 *
 * Agents don't need this package to *use* a gateway — MCP clients just
 * point at `http://host:port/mcp` (see `grapheway mcp-config`). This client
 * is for embedding grapheway access in your own agent/tooling.
 */

export * from "./client.ts";
