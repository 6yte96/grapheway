import { readFileSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { marked } from "marked";
import articles from "@/data/articles.json";
import { canonical, OG_IMAGE, pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);
  if (!article) return { title: "Article" };
  return pageMetadata({
    title: `${article.title} | grapheway`,
    description: article.description,
    path: `/blog/${article.slug}/`,
    imageAlt: article.title,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();

  const source = readFileSync(
    join(process.cwd(), "..", "docs", "articles", article.file),
    "utf-8",
  );
  const markdown = source.replace(/^# .+\r?\n/, "").trim();
  const html = await marked.parse(markdown, { gfm: true });
  const url = canonical(`/blog/${article.slug}/`);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.date,
    mainEntityOfPage: url,
    image: OG_IMAGE,
    keywords: article.tags.join(", "),
    author: {
      "@type": "Person",
      name: "6yte96",
      url: "https://github.com/6yte96",
    },
    publisher: {
      "@type": "Organization",
      name: "Grapheway",
      url: "https://6yte96.github.io/grapheway/",
    },
  };

  return (
    <article className="projects-section" style={{ paddingTop: "2rem" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />

      <div className="article-wrap">
        <Link href="/blog" className="readiness-link">
          All writing
        </Link>

        <div className="article-meta">
          <span>{new Date(article.date).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}</span>
          <span>{article.readingTime}</span>
        </div>

        <h1 className="article-title">{article.title}</h1>
        <p className="article-deck">{article.description}</p>

        <div className="article-tags">
          {article.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="readiness-cta">
          <div>
            <strong>Run it on your site.</strong>
            <p>
              Audit any public site, then mount the agent surface in one
              command. No account, no API key, no paid crawler.
            </p>
          </div>
          <div className="readiness-commands">
            <code>npx -y grapheway@latest audit https://your.site</code>
            <code>npx -y grapheway@latest init</code>
            <Link href="/setup" className="readiness-link">
              Agent setup
            </Link>
          </div>
        </div>

        <p className="readiness-method">
          Written by 6yte96, the maintainer of grapheway.{" "}
          <Link href="/blog">More writing</Link>,{" "}
          <Link href="/docs">Docs</Link>, and{" "}
          <Link href="/readiness">Agent Readiness Index</Link>.
        </p>
      </div>
    </article>
  );
}
