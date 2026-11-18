import type { LegalPage, SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";
import { escapeHtml } from "../utils/escape";
import { labels } from "../utils/labels";
import { renderHeader } from "../components/common/header";
import { renderFooter } from "../components/common/footer";
import { renderMobileBar } from "../components/common/mobile-bar";
import { wrapPage } from "./wrap";

export type LegalKind = "privacy" | "terms";

/** Pages légales (confidentialité / CGU) — un seul gabarit partagé. */
export function renderLegalPage(
  page: LegalPage,
  kind: LegalKind,
  spec: SiteSpec,
  sheet: ClientSheet,
  css: string,
  baseUrl: string,
): string {
  const L = labels(spec.lang);
  const breadcrumbLabel = kind === "privacy" ? L.privacy : L.terms;

  const body = `${renderHeader(sheet, spec)}
<main id="main">
  <section class="page-hero">
    <div class="container">
      <nav class="breadcrumb" aria-label="${escapeHtml(L.breadcrumb)}">
        <a href="index.html">${escapeHtml(L.navHome)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(breadcrumbLabel)}</span>
      </nav>
      <h1>${escapeHtml(page.title)}</h1>
      ${page.lastUpdated ? `<p class="legal-updated">${escapeHtml(L.legalUpdated)} : ${escapeHtml(page.lastUpdated)}</p>` : ""}
    </div>
  </section>
  <section class="section">
    <article class="container container-narrow prose">
      ${page.sections
        .map(
          (s) => `<section class="legal-block">
        <h2>${escapeHtml(s.heading)}</h2>
        <p>${escapeHtml(s.content)}</p>
      </section>`,
        )
        .join("\n      ")}
    </article>
  </section>
</main>
${renderFooter(sheet, spec)}
${renderMobileBar(sheet, spec)}`;

  return wrapPage({
    title: page.title,
    description: page.sections[0]?.content.slice(0, 150) ?? page.title,
    url: `${baseUrl}/${kind}`,
    lang: spec.lang,
    dir: spec.dir,
    css,
    body,
    sheet,
    spec,
  });
}
