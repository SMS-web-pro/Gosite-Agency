// Image OG 1200x630 en SVG déterministe (aucun renderer raster requis) :
// dégradé palette + nom, accroche et ville. Utilisée comme asset du bundle ;
// l'og:image des pages privilégie OG_IMAGE_URL (pack stock) puis le hero.

import type { SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";
import { escapeHtml } from "../utils/escape";
import { safeHex } from "./favicon-gen";

function clip(value: string | undefined, max: number): string {
  const v = String(value ?? "").trim();
  return v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v;
}

export function generateOgImage(sheet: ClientSheet, spec: SiteSpec): string {
  const primary = safeHex(spec.palette.primary, "#111827");
  const accent = safeHex(spec.palette.accent, "#ff7a1a");
  const name = escapeHtml(clip(sheet.BUSINESS_NAME, 34) || "Site");
  const tagline = escapeHtml(clip(sheet.TAGLINE || sheet.DESCRIPTION || spec.metaDescription, 68));
  const city = escapeHtml(clip(sheet.CITY, 40));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${name}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>
<rect width="1200" height="630" fill="url(#g)"/>
<circle cx="1060" cy="90" r="240" fill="#ffffff" opacity="0.08"/>
<circle cx="1040" cy="560" r="180" fill="#ffffff" opacity="0.06"/>
<text x="80" y="250" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="62" font-weight="800" fill="#ffffff">${name}</text>
<text x="82" y="320" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="30" fill="#ffffff" opacity="0.86">${tagline}</text>
${city ? `<text x="82" y="540" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="26" font-weight="600" fill="#ffffff" opacity="0.8">${city}</text>` : ""}
</svg>
`;
}
