import type { ServicePage, SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";
import { escapeHtml } from "../utils/escape";
import { labels } from "../utils/labels";
import { ctaExtra, ctaHref, iconBadge } from "../components/common/ui";
import { renderHeader } from "../components/common/header";
import { renderFooter } from "../components/common/footer";
import { renderMobileBar } from "../components/common/mobile-bar";
import { wrapPage } from "./wrap";

/** Ancre locale (#contact) -> page d'accueil depuis /services/*.html. */
function absoluteCta(href: string): string {
  return href.startsWith("#") ? `index.html${href}` : href;
}

export function renderServiceDetailPage(
  sp: ServicePage,
  spec: SiteSpec,
  sheet: ClientSheet,
  css: string,
  baseUrl: string,
): string {
  const L = labels(spec.lang);
  const business = escapeHtml(sheet.BUSINESS_NAME ?? "");
  const phone = (sheet.PHONE_LINK ?? "").replace(/[^\d+]/g, "");
  const related = spec.servicePages.filter((s) => sp.relatedServices.includes(s.slug) && s.slug !== sp.slug);

  const body = `${renderHeader(sheet, spec)}
<main id="main">
  <section class="page-hero">
    <div class="container">
      <nav class="breadcrumb" aria-label="${escapeHtml(L.breadcrumb)}">
        <a href="index.html">${escapeHtml(L.navHome)}</a><span aria-hidden="true">/</span><a href="index.html#services">${escapeHtml(L.navServices)}</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(sp.title)}</span>
      </nav>
      <h1>${escapeHtml(sp.title)}</h1>
      <p class="hero-sub">${escapeHtml(sp.heroSubtitle)}</p>
      <div class="hero-actions">
        <a class="btn btn-accent" href="${escapeHtml(absoluteCta(ctaHref(sp.cta.action, sheet)))}"${ctaExtra(sp.cta.action)}>${escapeHtml(sp.cta.label)}</a>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="container container-narrow prose">
      ${sp.paragraphs.map((p) => `<p class="para">${escapeHtml(p)}</p>`).join("\n      ")}
      <ul class="check-list">
        ${sp.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("\n        ")}
      </ul>
    </div>
  </section>
  ${
    related.length > 0
      ? `<section class="section section-alt">
    <div class="container">
      <div class="section-head reveal">
        <h2>${escapeHtml(L.relatedTitle)}</h2>
      </div>
      <div class="services-grid services-grid-3">
        ${related
          .map(
            (r) => `<article class="service-card reveal">
          ${iconBadge(r.title)}
          <h3><a href="services/${escapeHtml(r.slug)}.html">${escapeHtml(r.title)}</a></h3>
          <p>${escapeHtml(r.metaDescription)}</p>
          <a class="service-arrow" href="services/${escapeHtml(r.slug)}.html" aria-label="${escapeHtml(r.title)}">&#8594;</a>
        </article>`,
          )
          .join("\n        ")}
      </div>
    </div>
  </section>`
      : ""
  }
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
    title: `${sp.title} | ${business}`,
    description: sp.metaDescription,
    url: `${baseUrl}/services/${sp.slug}`,
    lang: spec.lang,
    dir: spec.dir,
    css,
    body,
    sheet,
    spec,
  });
}
