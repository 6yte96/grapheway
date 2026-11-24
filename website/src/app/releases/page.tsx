import Link from "next/link";
import { PROJECT_CONFIG } from "@/config";

export const metadata = {
  title: `Release notes · ${PROJECT_CONFIG.brand.name}`,
  description:
    "What changed in grapheway, newest first. Snapshot provenance, hosted MCP, stdio MCP, the Official MCP Registry and the concise README.",
};

const releases = [
  {
    version: "v0.2.8",
    date: "November 24, 2026",
    title: "Snapshot source and capture time",
    tag: "FEATURE",
    summary:
      "Probed graphs now say where they came from and when they were captured, so an agent can tell the user it is quoting a snapshot, not the site's live state.",
    points: [
      "Graph metadata: `sourceUrl`, `capturedAt` and `snapshot: true`.",
      "`_meta` on search, node, neighbor and path results over HTTP and MCP.",
      "`refresh()` keeps the capture metadata current when the live graph is patched.",
      "SKILL.md tells agents to disclose when they are quoting a snapshot.",
      "No breaking changes. The new fields are additive.",
    ],
    href: "https://github.com/6yte96/grapheway/releases/tag/v0.2.8",
  },
  {
    version: "v0.2.7",
    date: "November 23, 2026",
    title: "A README for humans",
    tag: "DOCS",
    summary:
      "A docs-only release. The README is now a 189-line plain-English overview; the deep technical guide moved to docs/technical-reference.md.",
    points: [
      "New README for a general audience.",
      "Technical detail preserved in the technical reference.",
      "The npm page shows the new overview.",
    ],
    href: "https://github.com/6yte96/grapheway/releases/tag/v0.2.7",
  },
  {
    version: "v0.2.6",
    date: "November 23, 2026",
    title: "Hosted, zero-install MCP",
    tag: "INFRA",
    summary:
      "A public Cloudflare Worker that probes any website and serves the full MCP surface. The Official MCP Registry entry now lists both the npm stdio package and the hosted remote.",
    points: [
      "Hosted endpoint: /mcp?url=<site>.",
      "12-page crawl, robots-aware, 10-minute cache, rate-limited.",
      "Remote streamable-HTTP entry in the Official MCP Registry.",
    ],
    href: "https://github.com/6yte96/grapheway/releases/tag/v0.2.6",
  },
  {
    version: "v0.2.5",
    date: "November 23, 2026",
    title: "Stdio MCP and the Official MCP Registry",
    tag: "FEATURE",
    summary:
      "`npx grapheway mcp --probe <url>` runs a local stdio MCP server. Grapheway is listed in the Official MCP Registry as io.github.6yte96/grapheway.",
    points: [
      "Stdio transport for Claude Desktop, Cursor, VS Code and Claude Code.",
      "`mcp-config --stdio` prints the exact client snippet.",
      "Official MCP Registry listing with mcpName and server.json.",
    ],
    href: "https://github.com/6yte96/grapheway/releases/tag/v0.2.5",
  },
];

export default function ReleasesPage() {
  return (
    <section className="projects-section" style={{ paddingTop: "2rem" }}>
      <div className="section-header">
        <div className="section-header-left">
          <p className="readiness-eyebrow">RELEASE NOTES</p>
          <h2 className="section-title">What changed, newest first</h2>
          <p className="section-description">
            Every release is small, documented and shipped from main. Follow the
            feed or read the full history on GitHub.
          </p>
        </div>
        <a
          href="https://github.com/6yte96/grapheway/releases.atom"
          target="_blank"
          rel="noopener noreferrer"
          className="support-btn"
        >
          <i className="fas fa-rss" aria-hidden="true" />
          <span>RSS feed</span>
        </a>
      </div>

      <div className="editorial-chronicle-list" style={{ marginTop: "1.5rem" }}>
        {releases.map((release) => (
          <article key={release.version} className="editorial-chronicle-card">
            <div className="chronicle-header">
              <div className="chronicle-title-row">
                <span className="postcard-tag boxed tilt-up chronicle-layer-tag">
                  {release.tag}
                </span>
                <h3 className="chronicle-role">
                  {release.version} · {release.title}
                </h3>
              </div>
              <span className="readiness-url">{release.date}</span>
            </div>
            <div className="chronicle-body">
              <p className="chronicle-text">{release.summary}</p>
              <ul className="readiness-release-list">
                {release.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <a
                href={release.href}
                target="_blank"
                rel="noopener noreferrer"
                className="readiness-link"
              >
                Full release notes →
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="readiness-cta">
        <div>
          <strong>Get the latest release.</strong>
          <p>
            One command, no account, no API key. Works with Next.js, Express,
            Hono, Node, static hosts, Cloudflare Workers, Deno and Bun.
          </p>
        </div>
        <div className="readiness-commands">
          <code>npx -y grapheway@latest init</code>
          <code>npx -y grapheway@latest audit https://your.site</code>
          <Link href="/docs" className="readiness-link">
            Read the docs →
          </Link>
        </div>
      </div>

      <p className="readiness-method">
        Full history:{" "}
        <Link href={PROJECT_CONFIG.links.github + "/releases"}>GitHub releases</Link>{" "}
        · <Link href="/readiness">Agent Readiness Index</Link> ·{" "}
        <Link href="/adopters">Adoption index</Link>
      </p>
    </section>
  );
}
