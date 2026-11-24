import Link from "next/link";
import { PROJECT_CONFIG } from "@/config";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: `Docs · ${PROJECT_CONFIG.brand.name}`,
  description:
    "Make any website agent-ready in one command. Quickstart for Next.js, Express, Hono, static hosts, stdio MCP and the hosted remote MCP endpoint.",
  path: "/docs/",
  imageAlt: "Grapheway documentation",
});

const faq = [
  {
    q: "How do I make my website readable by AI agents?",
    a: "Run `npx grapheway init` in your project. It detects Next.js, Express, Hono or a static host, writes grapheway.config.ts, and mounts the agent surface: discovery, a typed knowledge graph, an /agent API and an open MCP endpoint.",
  },
  {
    q: "What is an MCP server for a website?",
    a: "An MCP server exposes a site's content and actions as native tools to AI clients such as Claude Desktop, Cursor and VS Code. Grapheway gives a site graph tools (graph_node, graph_neighbors, graph_search, graph_path), its own actions, and pages as markdown resources.",
  },
  {
    q: "Does the site owner have to opt in?",
    a: "No. `npx grapheway probe <url>` converts any public site into the same graph locally, respecting robots.txt and staying same-origin. The opt-in runtime makes the surface permanent and live.",
  },
  {
    q: "Is grapheway free?",
    a: "Yes. The protocol and runtime are GPL-3.0, with no account, no API key and no paid crawler. The hosted MCP demo is rate-limited but free.",
  },
  {
    q: "How is grapheway different from llms.txt?",
    a: "llms.txt is a static, hand-maintained snapshot. Grapheway is a live graph: typed nodes and edges, search, auditable paths, actions, realtime updates over SSE, and MCP tools that agents can call.",
  },
];

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

function Code({ children }: { children: string }) {
  return (
    <pre className="code-window-body" style={{ marginTop: "0.75rem" }}>
      <code>{children}</code>
    </pre>
  );
}

export default function DocsPage() {
  return (
    <section className="projects-section" style={{ paddingTop: "2rem" }}>
      <h1 className="sr-only">Grapheway documentation</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      <div className="section-header">
        <div className="section-header-left">
          <p className="readiness-eyebrow">DOCS</p>
          <h2 className="section-title">Make any website agent-ready</h2>
          <p className="section-description">
            One command to mount the surface. One command to probe a site that
            has not opted in. One URL to use the hosted MCP demo.
          </p>
        </div>
      </div>

      <h3 className="readiness-eyebrow" style={{ marginTop: "1.5rem" }}>1. 60-second quickstart</h3>
      <Code>{`npx grapheway init
# detects Next.js / Express / Hono / static, writes the config, mounts the surface

npx grapheway init --url https://your-site.com
# generates a real config from a live probe

npx grapheway audit https://your-site.com
# 0–100 agent-readiness score + exact gaps

npx grapheway badge --url https://your-site.com --out badge.svg --md
# embeddable SVG badge for your README or footer`}</Code>

      <h3 className="readiness-eyebrow" style={{ marginTop: "1.5rem" }}>2. Connect an agent</h3>
      <p className="section-description" style={{ marginTop: "0.4rem" }}>
        Local clients can launch a stdio server. Hosted clients can use the
        remote demo. Both expose the same graph tools and site actions.
      </p>
      <Code>{`# stdio — no hosting, no port
npx grapheway mcp --probe https://expressjs.com

# print the exact client snippet
npx grapheway mcp-config --stdio --probe https://expressjs.com

# hosted demo — swap the url for any public site
https://grapheway-mcp.usmani3923.workers.dev/mcp?url=https://expressjs.com`}</Code>

      <h3 className="readiness-eyebrow" style={{ marginTop: "1.5rem" }}>3. What the site exposes</h3>
      <div className="benchmark-table-wrapper">
        <table className="benchmark-table">
          <thead>
            <tr>
              <th>Route</th>
              <th>What agents get</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>/.well-known/agent</code></td><td>Discovery: protocol, capabilities, endpoints.</td></tr>
            <tr><td><code>/graph/v1</code></td><td>Nodes, edges, search, auditable paths and SSE updates.</td></tr>
            <tr><td><code>/agent</code></td><td>Manifest, curated sections and declared actions.</td></tr>
            <tr><td><code>/agent/action</code></td><td>Run an action over HTTP — same implementation as MCP.</td></tr>
            <tr><td><code>/mcp</code></td><td>Streamable HTTP MCP: graph tools, actions, markdown resources.</td></tr>
            <tr><td><code>/graph</code></td><td>Human-interactive viewer of the same live graph.</td></tr>
          </tbody>
        </table>
      </div>

      <h3 className="readiness-eyebrow" style={{ marginTop: "1.5rem" }}>4. Next.js App Router</h3>
      <p className="section-description" style={{ marginTop: "0.4rem" }}>
        <code>grapheway init</code> writes <code>middleware.ts</code> and one
        route handler. The middleware rewrites the agent surface to the handler
        and preserves the original path in a header.
      </p>
      <Code>{`// middleware.ts
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const url = request.nextUrl.clone();
  url.pathname = "/api/grapheway";
  const headers = new Headers(request.headers);
  headers.set("x-grapheway-path", pathname);
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: ["/.well-known/agent", "/graph", "/graph/:path*", "/agent", "/agent/:path*", "/mcp"],
};`}</Code>

      <h3 className="readiness-eyebrow" style={{ marginTop: "1.5rem" }}>5. FAQ</h3>
      <div className="readiness-gaps-card" style={{ marginTop: "0.75rem" }}>
        {faq.map((item) => (
          <details key={item.q} style={{ marginBottom: "0.75rem" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{item.q}</summary>
            <p style={{ marginTop: "0.4rem", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {item.a}
            </p>
          </details>
        ))}
      </div>

      <div className="readiness-cta">
        <div>
          <strong>Ready to see what agents see?</strong>
          <p>Audit any site, then mount the surface in one command. No account, no key, no paid crawler.</p>
        </div>
        <div className="readiness-commands">
          <code>npx grapheway audit https://your.site</code>
          <code>npx grapheway init --url https://your.site</code>
          <Link href="/readiness" className="readiness-link">See the readiness index →</Link>
        </div>
      </div>

      <p className="readiness-method">
        <Link href={PROJECT_CONFIG.links.github}>GitHub</Link> ·{" "}
        <Link href={PROJECT_CONFIG.links.npm ?? "#"}>npm</Link> ·{" "}
        <Link href="/adopters">Adoption index</Link> ·{" "}
        <Link href="/readiness">Agent Readiness Index</Link>
      </p>
    </section>
  );
}
