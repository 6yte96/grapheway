/**
 * @grapheway/compat — optional legacy agent-discovery files.
 *
 * llms.txt, agents.txt, robots.txt, sitemap.xml and the config audit.
 * Fully decoupled from the runtime core: mount `compatHandler` next to
 * your agent handler only if you want these served.
 */

export * from "./agents.ts";
export * from "./llms-txt.ts";
export * from "./robots.ts";
export * from "./sitemap.ts";
export * from "./audit.ts";
export * from "./agents-txt.ts";
export * from "./generate-all.ts";
export * from "./handler.ts";
