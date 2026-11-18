import type { AboutPage, SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";
import { escapeHtml } from "../utils/escape";
import { labels } from "../utils/labels";
import { imgTag } from "../components/common/ui";
import { renderHeader } from "../components/common/header";
import { renderFooter } from "../components/common/footer";
import { renderMobileBar } from "../components/common/mobile-bar";
import { wrapPage } from "./wrap";

export function renderAboutPage(
  page: AboutPage,
  spec: SiteSpec,
  sheet: ClientSheet,
  css: string,
  baseUrl: string,
): string {
  const L = labels(spec.lang);
  const phone = (sheet.PHONE_LINK ?? "").replace(/[^\d+]/g, "");
  const business = escapeHtml(sheet.BUSINESS_NAME ?? "");

  const body = `${renderHeader(sheet, spec)}
<main id="main">
  <section class="page-hero">
    <div class="container">
      <nav class="breadcrumb" aria-label="${escapeHtml(L.breadcrumb)}">
        <a href="index.html">${escapeHtml(L.navHome)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(L.navAbout)}</span>
      </nav>
      <h1>${escapeHtml(page.metaTitle)}</h1>
    </div>
  </section>
  <section class="section">
    <div class="container about-grid">
      <div class="about-copy reveal">
        ${page.story.map((p) => `<p class="para">${escapeHtml(p)}</p>`).join("\n        ")}
        ${page.teamNote ? `<p class="para para-em">${escapeHtml(page.teamNote)}</p>` : ""}
      </div>
      <div class="about-media reveal">${imgTag(sheet.ABOUT_IMAGE_URL, business)}</div>
    </div>
  </section>
  <section class="section section-alt">
    <div class="container container-narrow">
      <h2>${escapeHtml(L.missionTitle)}</h2>
      <p class="para">${escapeHtml(page.mission)}</p>
      <h2 class="mt-lg">${escapeHtml(L.valuesTitle)}</h2>
      <div class="values-grid">
        ${page.values
          .map(
            (v) => `<article class="value-card reveal">
          <h3>${escapeHtml(v.title)}</h3>
          <p>${escapeHtml(v.desc)}</p>
        </article>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>
  <section class="section cta-band">
    <div class="container cta-band-inner">
      <div>
        <h2>${escapeHtml(L.ctaTitle)}</h2>
        <p>${escapeHtml(L.ctaText)}</p>
      </div>
      <div class="hero-actions">
        ${phone ? `<a class="btn btn-accent" href="tel:${escapeHtml(phone)}">${escapeHtml(L.call)} ${escapeHtml(sheet.PHONE ?? phone)}</a>` : ""}
        <a class="btn btn-ghost" href="index.html#contact">${escapeHtml(L.navContact)}</a>
      </div>
    </div>
  </section>
</main>
${renderFooter(sheet, spec)}
${renderMobileBar(sheet, spec)}`;

  return wrapPage({
    title: page.metaTitle,
    description: page.metaDescription,
    url: `${baseUrl}/about`,
    lang: spec.lang,
    dir: spec.dir,
    css,
    body,
    sheet,
    spec,
  });
}
