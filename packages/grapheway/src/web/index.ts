/**
 * @grapheway/web — drop-in agent endpoint for any Node web app.
 *
 *   import { createGrapheway, toNodeHandler } from "@grapheway/web";
 *   import { createServer } from "node:http";
 *
 *   const agent = createGrapheway(config);
 *   createServer(toNodeHandler(agent.handler)).listen(3000);
 *
 * Your site now answers on /llms.txt, /agents.txt, /robots.txt, /agent
 * (JSON API with basic actions) and /mcp (open Model Context Protocol).
 */

export * from "./types.ts";
export * from "./handler.ts";
export * from "./adapters.ts";
export * from "./actions.ts";
export * from "./mcp.ts";
export * from "./inject.ts";
export * from "./viewer.ts";
