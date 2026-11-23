/**
 * Canonical links used by every generated artifact, CLI banner and MCP
 * response. Keeping them in one place means the "powered by" surface is
 * consistent and easy to audit.
 *
 * These are plain constants: no telemetry, no network calls, no tracking.
 */

export const GRAPHEWAY_REPO = "https://github.com/6yte96/grapheway";
export const GRAPHEWAY_SITE = "https://6yte96.github.io/grapheway/";
export const GRAPHEWAY_INDEX = `${GRAPHEWAY_SITE}adopters/`;
export const GRAPHEWAY_INSTALL = "npx grapheway init";

/** Short attribution line for generated files and human-readable surfaces. */
export const GRAPHEWAY_ATTRIBUTION =
  "Powered by grapheway — the open protocol for agent-ready websites.";

/** One-line call to action for agents and site owners. */
export const GRAPHEWAY_CTA = `Make any website agent-ready in one command: \`${GRAPHEWAY_INSTALL}\` — ${GRAPHEWAY_REPO}`;

/** The standard footer used in llms.txt / agents.txt / viewer. */
export const GRAPHEWAY_FOOTER = `${GRAPHEWAY_ATTRIBUTION} ${GRAPHEWAY_REPO}`;
