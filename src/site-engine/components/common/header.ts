import type { SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { labels } from "../../utils/labels";

const PHONE_ICON =
  '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

export function renderHeader(sheet: ClientSheet, spec: SiteSpec): string {
  const L = labels(spec.lang);
  const name = escapeHtml(sheet.BUSINESS_NAME ?? "");
  const phone = (sheet.PHONE_LINK ?? "").replace(/[^\d+]/g, "");
  const phoneLink = phone ? `tel:${escapeHtml(phone)}` : "";

  return `<header class="site-header">
  <a class="skip-link" href="#main">${escapeHtml(L.skip)}</a>
  <div class="header-inner container">
    <a class="brand" href="index.html">${name}</a>
    <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-label="${escapeHtml(L.menu)}">
    <label for="nav-toggle" class="nav-burger"><span class="sr-only">${escapeHtml(L.menu)}</span><span class="burger-line"></span><span class="burger-line"></span><span class="burger-line"></span></label>
    <nav class="site-nav" aria-label="Navigation">
      <a href="index.html">${escapeHtml(L.navHome)}</a>
      <a href="index.html#services">${escapeHtml(L.navServices)}</a>
      <a href="about.html">${escapeHtml(L.navAbout)}</a>
      <a href="index.html#reviews">${escapeHtml(L.navReviews)}</a>
      <a href="index.html#contact">${escapeHtml(L.navContact)}</a>
    </nav>
    ${phoneLink ? `<a class="btn btn-accent header-cta" href="${phoneLink}">${PHONE_ICON}<span>${escapeHtml(L.call)}</span></a>` : ""}
  </div>
</header>`;
}
