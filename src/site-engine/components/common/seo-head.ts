import type { SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml, jsonLdSafe } from "../../utils/escape";
import { fontHrefs } from "../../css/generate-theme";
import { faqJsonLd, localBusinessJsonLd } from "../../seo/jsonld";

export type HeadOpts = {
  title: string;
  description: string;
  ogDescription?: string;
  url: string;
  lang: string;
  dir?: string;
  sheet: ClientSheet;
  spec: SiteSpec;
  jsonLd?: boolean;
};

export function renderHead(opts: HeadOpts): string {
  const { sheet, spec } = opts;
  const url = opts.url.replace(/\/+$/, "");
  const canonical = url.endsWith(".html") || url.endsWith("/") ? url : `${url}/`;
  const ogImage = /^https?:\/\//.test(sheet.HERO_IMAGE_URL ?? "") ? sheet.HERO_IMAGE_URL : "";

  const fonts = fontHrefs(spec.fontPairing)
    .map((h) => `<link rel="stylesheet" href="${escapeHtml(h)}">`)
    .join("\n");

  const faq = opts.jsonLd ? faqJsonLd(spec) : null;

  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="${escapeHtml(spec.palette.primary)}">
<title>${escapeHtml(opts.title)}</title>
<meta name="description" content="${escapeHtml(opts.description)}">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ""}
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(opts.title)}">
<meta property="og:description" content="${escapeHtml(opts.ogDescription || opts.description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:locale" content="${escapeHtml((sheet.LOCALE || "en-US").replace("-", "_"))}">
${ogImage ? `<meta property="og:image" content="${escapeHtml(ogImage)}">` : ""}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(opts.title)}">
<meta name="twitter:description" content="${escapeHtml(opts.ogDescription || opts.description)}">
${ogImage ? `<meta name="twitter:image" content="${escapeHtml(ogImage)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://api.fontshare.com">
${fonts}
<link rel="icon" href="favicon.svg" type="image/svg+xml">
${opts.jsonLd ? `<script type="application/ld+json">${jsonLdSafe(localBusinessJsonLd(sheet, spec, canonical))}</script>` : ""}
${faq ? `<script type="application/ld+json">${jsonLdSafe(faq)}</script>` : ""}`;
}
