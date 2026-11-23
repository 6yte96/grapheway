"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PROJECT_CONFIG } from "@/config";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "/grapheway";

const ADOPT_URL =
  "https://github.com/6yte96/grapheway/issues/new?template=adopt.yml&title=%5Badopt%5D+";
const INDEX_URL = "https://6yte96.github.io/grapheway/adopters/";
const BADGE_URL =
  "https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2F6yte96.github.io%2Fgrapheway%2Fadopters.json&query=%24.total&label=agent-ready%20sites&color=0b0e15";

interface Site {
  name: string;
  url: string;
  surface?: string;
  status?: string;
  note?: string;
  addedAt?: string;
  verified?: boolean;
}

interface IndexData {
  updatedAt?: string;
  total?: number;
  verified?: number;
  sites?: Site[];
}

interface Live {
  stars: number | null;
  downloads: number | null;
  indexed: number | null;
  updatedAt: string | null;
}

const format = (value: number | null): string =>
  value === null ? "—" : new Intl.NumberFormat("en-US").format(value);

export function LiveIndex({ full = false }: { full?: boolean }) {
  const { liveIndex } = PROJECT_CONFIG;
  const [data, setData] = useState<IndexData>({});
  const [live, setLive] = useState<Live>({
    stars: null,
    downloads: null,
    indexed: null,
    updatedAt: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [index, github, npm] = await Promise.allSettled([
        fetch(`${BASE}/adopters.json`, { cache: "no-store" }).then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("index")),
        ),
        fetch("https://api.github.com/repos/6yte96/grapheway", {
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("github")))),
        fetch("https://api.npmjs.org/downloads/point/last-month/grapheway", {
          cache: "no-store",
        }).then((r) => (r.ok ? r.json() : Promise.reject(new Error("npm")))),
      ]);

      if (cancelled) return;

      const idx: IndexData =
        index.status === "fulfilled" ? (index.value as IndexData) : {};
      const stars =
        github.status === "fulfilled"
          ? Number((github.value as { stargazers_count?: number }).stargazers_count)
          : NaN;
      const downloads =
        npm.status === "fulfilled"
          ? Number((npm.value as { downloads?: number }).downloads)
          : NaN;

      setData(idx);
      setLive({
        stars: Number.isFinite(stars) ? stars : null,
        downloads: Number.isFinite(downloads) ? downloads : null,
        indexed: typeof idx.total === "number" ? idx.total : idx.sites?.length ?? null,
        updatedAt: idx.updatedAt ?? null,
      });
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sites = data.sites ?? [];
  const shown = full ? sites : sites.slice(0, 6);
  const updated = live.updatedAt
    ? new Date(live.updatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <section id="index" className="projects-section" style={{ paddingTop: "1rem" }}>
      <div className="section-header">
        <div className="section-header-left">
          <h2 className="section-title">{liveIndex.title}</h2>
          <p className="section-description">{liveIndex.subtitle}</p>
        </div>
        <span className="index-live-pill">
          <span className="index-live-dot" aria-hidden="true" />
          LIVE
        </span>
      </div>

      <div className="live-index-grid">
        <div className="live-index-stat">
          <span className="live-index-label">INDEXED SITES</span>
          <strong className="live-index-value">{format(live.indexed)}</strong>
          <span className="live-index-note">
            {data.verified ? `${data.verified} verified by public agent card` : "self-submitted"}
          </span>
        </div>
        <div className="live-index-stat">
          <span className="live-index-label">GITHUB STARS</span>
          <strong className="live-index-value">{format(live.stars)}</strong>
          <span className="live-index-note">live from the GitHub API</span>
        </div>
        <div className="live-index-stat">
          <span className="live-index-label">NPM DOWNLOADS / MONTH</span>
          <strong className="live-index-value">{format(live.downloads)}</strong>
          <span className="live-index-note">live from the npm registry</span>
        </div>
      </div>

      <div className="live-index-list">
        {loading ? (
          <div className="live-index-empty">reading the index…</div>
        ) : shown.length === 0 ? (
          <div className="live-index-empty">{liveIndex.empty}</div>
        ) : (
          shown.map((site) => (
            <a
              key={`${site.name}-${site.url}`}
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="live-index-row"
            >
              <span className="live-index-site">
                <strong>{site.name}</strong>
                {site.note ? <span>{site.note}</span> : null}
              </span>
              <span className="live-index-tags">
                {site.surface ? (
                  <span className="live-index-tag">{site.surface}</span>
                ) : null}
                <span
                  className={`live-index-status ${
                    site.status === "verified" || site.verified ? "is-verified" : ""
                  }`}
                >
                  {site.status === "verified" || site.verified ? "verified" : site.status ?? "listed"}
                </span>
                <span aria-hidden="true">↗</span>
              </span>
            </a>
          ))
        )}
      </div>

      <div className="live-index-actions">
        <a
          href={ADOPT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="support-btn primary"
        >
          <i className="fas fa-plus" aria-hidden="true" />
          <span>{liveIndex.ctaAdd}</span>
        </a>
        {full ? (
          <Link href="/" className="support-btn">
            <i className="fas fa-arrow-left" aria-hidden="true" />
            <span>Back to the overview</span>
          </Link>
        ) : (
          <Link href="/adopters" className="support-btn">
            <i className="fas fa-table-list" aria-hidden="true" />
            <span>{liveIndex.ctaFull}</span>
          </Link>
        )}
        <Link href="/readiness" className="support-btn">
          <i className="fas fa-chart-simple" aria-hidden="true" />
          <span>Agent Readiness Index</span>
        </Link>
      </div>

      <div className="live-index-badge">
        <span>{liveIndex.ctaBadge}</span>
        <code>{`[![agent-ready sites](${BADGE_URL})](${INDEX_URL})`}</code>
        <span className="live-index-updated">
          {updated ? `index refreshed ${updated}` : "index refreshes daily"}
        </span>
      </div>
    </section>
  );
}
