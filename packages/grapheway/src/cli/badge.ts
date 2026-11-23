/**
 * `grapheway badge` — an embeddable SVG agent-readiness badge.
 *
 * The badge is a growth loop with no tracking: it is a plain SVG the site
 * owner can put in a README or footer, linking back to the protocol. The
 * score comes from `grapheway audit <url>` or an explicit `--score`.
 */

export interface BadgeOptions {
  label?: string;
  value?: string;
  /** Accent color for the value half. */
  color?: string;
  /** Link target when embedded as markdown/html. */
  href?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Rough badge width: 6.5px per character + padding. */
function textWidth(value: string): number {
  return Math.max(28, Math.round(value.length * 6.6) + 14);
}

/** Build a shields.io-style SVG badge with no external dependencies. */
export function generateBadgeSvg(options: BadgeOptions = {}): string {
  const label = options.label ?? "agent-ready";
  const value = options.value ?? "grapheway";
  const color = options.color ?? "#0b0e15";
  const labelWidth = textWidth(label);
  const valueWidth = textWidth(value);
  const width = labelWidth + valueWidth;
  const labelX = labelWidth / 2;
  const valueX = labelWidth + valueWidth / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${escapeXml(
    `${label}: ${value}`,
  )}">
  <title>${escapeXml(`${label}: ${value}`)}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${width}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${escapeXml(color)}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
    <text x="${labelX}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(label)}</text>
    <text x="${labelX}" y="14">${escapeXml(label)}</text>
    <text x="${valueX}" y="15" fill="#010101" fill-opacity=".3">${escapeXml(value)}</text>
    <text x="${valueX}" y="14">${escapeXml(value)}</text>
  </g>
</svg>
`;
}

/** Markdown snippet for a hosted or local badge file. */
export function badgeMarkdown(url: string, href?: string): string {
  const alt = "agent-ready";
  return href ? `[![${alt}](${url})](${href})` : `![${alt}](${url})`;
}
