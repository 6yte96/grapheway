import { type AgentManifest, type GraphewayConfig } from "./types.ts";
/** Build the absolute URL for a root-relative path. */
export declare function absoluteUrl(config: GraphewayConfig, path: string): string;
/**
 * Build the machine-readable agent manifest served at `/agent`
 * (also published as `agents.json`).
 */
export declare function buildManifest(config: GraphewayConfig): AgentManifest;
//# sourceMappingURL=manifest.d.ts.map