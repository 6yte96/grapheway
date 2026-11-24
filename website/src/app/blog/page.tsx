import Link from "next/link";
import articles from "@/data/articles.json";
import { PROJECT_CONFIG } from "@/config";
import { canonical, pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: `Writing | ${PROJECT_CONFIG.brand.name}`,
  description:
    "Practical writing on agent readiness, MCP, AI search and the live knowledge graph for websites.",
  path: "/blog/",
  imageAlt: "Grapheway writing",
});

const blogLd = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: `Writing | ${PROJECT_CONFIG.brand.name}`,
  url: canonical("/blog/"),
  blogPost: articles.map((article) => ({
    "@type": "BlogPosting",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    url: canonical(`/blog/${article.slug}/`),
  })),
};

export default function BlogIndex() {
  return (
    <section className="projects-section" style={{ paddingTop: "2rem" }}>
      <h1 className="sr-only">Grapheway writing</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogLd) }}
      />

      <div className="section-header">
        <div className="section-header-left">
          <p className="readiness-eyebrow">WRITING</p>
          <h2 className="section-title">Notes on the agent-native web</h2>
          <p className="section-description">
            Practical guides for making a website readable and useful to AI
            agents. No hype, no fake numbers.
          </p>
        </div>
      </div>

      <div className="blog-list">
        {articles.map((article) => (
          <Link key={article.slug} href={`/blog/${article.slug}`} className="blog-card">
            <div className="blog-card-meta">
              <span>{article.date}</span>
              <span>{article.readingTime}</span>
            </div>
            <h2>{article.title}</h2>
            <p>{article.description}</p>
            <div className="blog-card-footer">
              <div className="blog-tags">
                {article.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <span className="readiness-link">Read article</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="readiness-cta">
        <div>
          <strong>Want the setup instead of the theory?</strong>
          <p>
            Copy the agent prompt or run the quickstart. Both are on the docs
            page.
          </p>
        </div>
        <div className="readiness-commands">
          <code>npx -y grapheway@latest init</code>
          <Link href="/setup" className="readiness-link">
            Agent setup
          </Link>
          <Link href="/docs" className="readiness-link">
            Docs
          </Link>
        </div>
      </div>
    </section>
  );
}
