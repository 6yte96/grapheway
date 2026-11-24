import type { Metadata } from "next";
import { PROJECT_CONFIG } from "@/config";

const site = PROJECT_CONFIG.meta.url.replace(/\/+$/, "");

/** Absolute URL of the social card. metadataBase must not double the base path. */
export const OG_IMAGE = `${site}/og.png`;

/** Absolute canonical URL for a site path. Always uses a trailing slash. */
export function canonical(path = "/"): string {
  let clean = path.startsWith("/") ? path : `/${path}`;
  if (clean !== "/" && !clean.endsWith("/")) clean = `${clean}/`;
  return `${site}${clean}`;
}

/**
 * Page-level metadata with its own canonical URL and social card.
 * Layout-level metadata still supplies the home page defaults.
 */
export function pageMetadata(options: {
  title: string;
  description: string;
  path: string;
  imageAlt?: string;
}): Metadata {
  const url = canonical(options.path);
  return {
    title: options.title,
    description: options.description,
    alternates: { canonical: url },
    openGraph: {
      title: options.title,
      description: options.description,
      url,
      siteName: PROJECT_CONFIG.brand.name,
      type: "website",
      images: [
        {
          url: OG_IMAGE,
          width: 1200,
          height: 630,
          alt: options.imageAlt ?? options.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: options.title,
      description: options.description,
      images: [OG_IMAGE],
    },
  };
}
