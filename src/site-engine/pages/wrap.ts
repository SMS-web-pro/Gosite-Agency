import type { SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";
import { escapeHtml } from "../utils/escape";
import { renderHead } from "../components/common/seo-head";
import { REVEAL_SCRIPT } from "../scripts/reveal";
import { MOTION_SCRIPT } from "../scripts/motion";

export type PageShellOpts = {
  title: string;
  description: string;
  ogDescription?: string;
  url: string;
  lang: string;
  dir?: string;
  css: string;
  body: string;
  sheet: ClientSheet;
  spec: SiteSpec;
  jsonLd?: boolean;
};

/** Enveloppe HTML commune à toutes les pages générées. */
export function wrapPage(opts: PageShellOpts): string {
  const lang = escapeHtml(opts.lang || "en");
  const dir = opts.dir === "rtl" ? "rtl" : "ltr";
  const guideAttrs = opts.spec.design
    ? ` data-guide="${escapeHtml(opts.spec.design.styleGuide)}" data-motion="${escapeHtml(opts.spec.design.motion)}"`
    : "";
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}"${guideAttrs}>
<head>
${renderHead(opts)}
<style>${opts.css}</style>
</head>
<body>
${opts.body}
<script>${opts.spec.design ? MOTION_SCRIPT : REVEAL_SCRIPT}</script>
</body>
</html>`;
}
