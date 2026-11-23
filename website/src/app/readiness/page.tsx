import Link from "next/link";
import data from "@/data/agent-readiness.json";
import { PROJECT_CONFIG } from "@/config";

export const metadata = {
  title: `Agent Readiness Index · ${PROJECT_CONFIG.brand.name}`,
  description:
    "A live public audit of the documentation sites AI agents read most. Scores, grades and the exact gaps — no visitor data.",
};

export default function ReadinessPage() {
  const results = data.results;
  const top = results.slice(0, 10);

  return (
    <section className="projects-section" style={{ paddingTop: "2rem" }}>
      <div className="section-header">
        <div className="section-header-left">
          <h2 className="section-title">The Agent Readiness Index</h2>
          <p className="section-description">
            We audited {data.total} of the documentation sites agents read most.
            The average is {data.average}/100. {data.passing} scored B or better.
          </p>
        </div>
        <span className="index-live-pill">
          <span className="index-live-dot" aria-hidden="true" />
          LIVE AUDIT
        </span>
      </div>

      <div className="readiness-hero">
        <div className="readiness-hero-stat">
          <span className="live-index-label">AVERAGE SCORE</span>
          <strong className="readiness-big">{data.average}</strong>
          <span className="live-index-note">out of 100</span>
        </div>
        <div className="readiness-hero-stat">
          <span className="live-index-label">AT B OR BETTER</span>
          <strong className="readiness-big">{data.passing}</strong>
          <span className="live-index-note">of {data.total} sites</span>
        </div>
        <div className="readiness-hero-stat">
          <span className="live-index-label">MOST COMMON GAP</span>
          <strong className="readiness-small">
            {results[0]?.gaps[0] ?? "discovery card"}
          </strong>
          <span className="live-index-note">present on almost no site</span>
        </div>
      </div>

      <div className="benchmark-table-wrapper">
        <table className="benchmark-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Site</th>
              <th>Score</th>
              <th>Grade</th>
              <th>Gaps</th>
              <th>Report</th>
            </tr>
          </thead>
          <tbody>
            {top.map((site, idx) => (
              <tr key={site.slug} className={idx === 0 ? "highlight-row" : ""}>
                <td>{idx + 1}</td>
                <td>
                  <strong>{site.name}</strong>
                  <br />
                  <span className="readiness-url">{site.url}</span>
                </td>
                <td>
                  <strong>{site.score}</strong>/100
                </td>
                <td>
                  <span className={`readiness-grade grade-${site.grade.toLowerCase()}`}>
                    {site.grade}
                  </span>
                </td>
                <td>{site.gaps.length}</td>
                <td>
                  <Link href={`/readiness/${site.slug}`} className="readiness-link">
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="readiness-cta">
        <div>
          <strong>Your site is not on the list.</strong>
          <p>
            Run the same audit locally, then mount the surface in one command.
            The report gives you the exact gaps.
          </p>
        </div>
        <div className="readiness-commands">
          <code>npx grapheway audit {PROJECT_CONFIG.meta.url.replace(/\/$/, "")}</code>
          <code>npx grapheway init --url {PROJECT_CONFIG.meta.url.replace(/\/$/, "")}</code>
          <code>npx grapheway badge --url https://your.site</code>
        </div>
      </div>

      <p className="readiness-method">
        Methodology: a live public-endpoint audit of discovery, graph, /agent, MCP,
        robots.txt AI policy, llms.txt, agents.json, JSON-LD and sitemap. A low
        score measures missing agent-native endpoints, not site quality. No
        visitor data is collected. <Link href="/adopters">See the adoption index →</Link>
      </p>
    </section>
  );
}
