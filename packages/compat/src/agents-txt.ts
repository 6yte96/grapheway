/**
 * `agents.txt` / `agents.json` — legacy capability declarations
 * (agents-txt.com convention). Part of the optional compat module:
 * served only when the site owner mounts `compatHandler`.
 */

import { buildManifest, type GraphewayConfig } from "grapheway";

/**
 * Build `agents.txt` — a human+agent readable capability declaration
 * following the agents-txt.com convention.
 */
export function buildAgentsTxt(config: GraphewayConfig): string {
  const m = buildManifest(config);
  const lines: string[] = [];
  lines.push(`# ${m.site.name} — agent capability declaration`);
  if (m.site.tagline) lines.push(`# ${m.site.tagline}`);
  lines.push("");
  lines.push(`Site: ${m.site.url}`);
  if (m.site.contact?.name) lines.push(`Contact name: ${m.site.contact.name}`);
  if (m.site.contact?.email) lines.push(`Contact email: ${m.site.contact.email}`);
  lines.push("");

  lines.push("## MCP");
  lines.push(`- Server: ${m.endpoints.mcp}  (Model Context Protocol, streamable HTTP)`);
  lines.push("");

  lines.push("## API");
  lines.push(`- Manifest: ${m.endpoints.manifest}`);
  lines.push(`- Info: ${m.endpoints.info}`);
  lines.push(`- Sections: ${m.endpoints.sections}`);
  lines.push(`- Actions: ${m.endpoints.actions}`);
  lines.push(`- Call action: ${m.endpoints.action}  (POST)`);
  lines.push("");

  lines.push("## Content");
  lines.push(`- llms.txt: ${m.endpoints.llmsTxt}`);
  lines.push(`- llms-full.txt: ${m.endpoints.llmsFullTxt}`);
  lines.push(`- robots.txt: ${m.endpoints.robotsTxt}`);
  lines.push(`- sitemap.xml: ${m.endpoints.sitemap}`);
  lines.push("");

  if (m.capabilities.length > 0) {
    lines.push("## Capabilities");
    for (const cap of m.capabilities) lines.push(`- ${cap}`);
    lines.push("");
  }

  if (m.actions.length > 0) {
    lines.push("## Actions");
    for (const a of m.actions) {
      lines.push(`- \`${a.name}\`: ${a.description}`);
    }
    lines.push("");
  }

  lines.push("CORS: Access-Control-Allow-Origin: *");
  lines.push("");
  return lines.join("\n");
}

/**
 * Build `agents.json` — the machine-readable capability manifest.
 * This is the same shape as the `/agent` endpoint response.
 */
export function buildAgentsJson(config: GraphewayConfig): string {
  return JSON.stringify(buildManifest(config), null, 2);
}
