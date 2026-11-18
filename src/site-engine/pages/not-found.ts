import type { SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";
import { escapeHtml } from "../utils/escape";
import { labels } from "../utils/labels";
import { renderHeader } from "../components/common/header";
import { renderFooter } from "../components/common/footer";
import { renderMobileBar } from "../components/common/mobile-bar";
import { wrapPage } from "./wrap";

export function render404Page(spec: SiteSpec, sheet: ClientSheet, css: string, baseUrl: string): string {
  const L = labels(spec.lang);

  const body = `${renderHeader(sheet, spec)}
<main id="main">
  <section class="section error-page">
    <div class="container container-narrow">
      <p class="error-code">404</p>
      <h1>${escapeHtml(L.notFoundTitle)}</h1>
      <p class="para">${escapeHtml(L.notFoundText)}</p>
      <a class="btn btn-accent" href="index.html">${escapeHtml(L.backHome)}</a>
    </div>
  </section>
</main>
${renderFooter(sheet, spec)}
${renderMobileBar(sheet, spec)}`;

  return wrapPage({
    title: `404 | ${escapeHtml(sheet.BUSINESS_NAME ?? "")}`,
    description: L.notFoundText,
    url: `${baseUrl}/404`,
    lang: spec.lang,
    dir: spec.dir,
    css,
    body,
    sheet,
    spec,
  });
}
