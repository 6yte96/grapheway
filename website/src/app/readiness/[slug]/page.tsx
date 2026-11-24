import Link from "next/link";
import { notFound } from "next/navigation";
import data from "@/data/agent-readiness.json";
import { PROJECT_CONFIG } from "@/config";
import { canonical, pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return data.results.map((site) => ({ slug: site.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = data.results.find((item) => item.slug === slug);
  if (!site) return { title: "Agent readiness report" };
  return pageMetadata({
    title: `${site.name} agent readiness: ${site.score}/100 (${site.grade})`,
    description: `Public agent-readiness audit of ${site.url}: score ${site.score}/100, grade ${site.grade}, ${site.gaps.length} gaps. Run the same audit with grapheway.`,
    path: `/readiness/${site.slug}/`,
    imageAlt: `${site.name} agent readiness report`,
  });
}

export default async function ReadinessReport({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const site = data.results.find((item) => item.slug === slug);
  if (!site) notFound();

  const checks = site.checks;
  const passed = checks.filter((c) => c.ok).length;
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${site.name} agent readiness: ${site.score}/100`,
    description: `Public agent-readiness audit of ${site.url}. Score ${site.score}/100, grade ${site.grade}, ${site.gaps.length} gaps.`,
    datePublished: data.updatedAt,
    dateModified: data.updatedAt,
    mainEntityOfPage: canonical(`/readiness/${site.slug}/`),
    author: {
      "@type": "Organization",
      name: "Grapheway",
      url: "https://6yte96.github.io/grapheway/",
    },
  };

  return (
    <section className="projects-section" style={{ paddingTop: "2rem" }}>
      <h1 className="sr-only">{site.name} agent readiness report</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <div className="section-header">
        <div className="section-header-left">
          <p className="readiness-eyebrow">AGENT READINESS REPORT</p>
          <h2 className="section-title">{site.name}</h2>
          <p className="section-description">
            {site.url} · audited {new Date(data.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <Link href="/readiness" className="support-btn">
          All reports
        </Link>
      </div>

      <div className="readiness-report-grid">
        <div className="readiness-score-card">
          <span className="live-index-label">SCORE</span>
          <strong className={`readiness-score grade-text-${site.grade.toLowerCase()}`}>
            {site.score}
          </strong>
          <span className="readiness-score-sub">/ 100 · grade {site.grade}</span>
          <span className="readiness-score-sub">
            {passed}/{checks.length} checks passed
          </span>
        </div>
        <div className="readiness-gaps-card">
          <span className="live-index-label">WHAT AGENTS CANNOT DO</span>
          {site.gaps.length ? (
            <ul>
              {site.gaps.map((gap) => (
                <li key={gap}>{gap}</li>
              ))}
            </ul>
          ) : (
            <p>No gaps found. This site is fully agent-ready.</p>
          )}
        </div>
      </div>

      <div className="benchmark-table-wrapper" style={{ marginTop: "1.25rem" }}>
        <table className="benchmark-table">
          <thead>
            <tr>
              <th>Check</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.id}>
                <td>{check.label}</td>
                <td>
                  <span className={check.ok ? "readiness-pass" : "readiness-fail"}>
                    {check.ok ? "✓ pass" : "✗ gap"}
                  </span>
                </td>
                <td>{check.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="readiness-cta">
        <div>
          <strong>Make {site.name.split(" ")[0]} agent-ready in one command.</strong>
          <p>
            The audit gives you the list; the runtime gives you the surface. No
            scraping, no API key, zero dependencies.
          </p>
        </div>
        <div className="readiness-commands">
          <code>npx grapheway init --url {site.url}</code>
          <code>npx grapheway audit {site.url}</code>
          <code>npx grapheway badge --url {site.url}</code>
        </div>
      </div>

      <p className="readiness-method">
        Public endpoints only. No visitor data. A low score measures missing
        agent-native endpoints, not site quality.{" "}
        <Link href={`https://github.com/6yte96/grapheway/issues/new?template=adopt.yml&title=${encodeURIComponent(`[re-audit] ${site.name}`)}`}>
          Request a re-audit →
        </Link>{" "}
        · <Link href="/adopters">Adoption index</Link> ·{" "}
        <Link href={PROJECT_CONFIG.links.github}>GitHub</Link>
      </p>
    </section>
  );
}
