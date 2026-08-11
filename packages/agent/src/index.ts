/**
 * @grapheway/agent — the agent side of grapheway.
 *
 *   const client = new GraphewayClient("https://example.com");
 *   await client.getManifest();   // site info + sections + actions
 *   await client.search("pricing");
 *
 * Or run `grapheway-mcp https://example.com` to expose the site's actions
 * to any MCP client as tools.
 */

export * from "./client.ts";
export { runStdioServer } from "./mcp-stdio.ts";
