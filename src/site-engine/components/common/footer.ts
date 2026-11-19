import type { SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml, safeUrl } from "../../utils/escape";
import { labels } from "../../utils/labels";
import { formatAddress } from "../../utils/format-address";
import { formatPhoneFromSheet } from "../../utils/format-phone";

export function renderFooter(sheet: ClientSheet, spec: SiteSpec): string {
  const L = labels(spec.lang);
  const name = escapeHtml(sheet.BUSINESS_NAME ?? "");
  const year = new Date().getFullYear();
  const phone = (sheet.PHONE_LINK ?? "").replace(/[^\d+]/g, "");
  const address = formatAddress(sheet);
  const phoneText = formatPhoneFromSheet(sheet) || sheet.PHONE || phone;
  const email = /^[^@\s]+@[^@\s]+$/.test(sheet.EMAIL ?? "") ? sheet.EMAIL : "";
  const hours = [sheet.HOURS_WEEKDAY, sheet.HOURS_SAT, sheet.HOURS_SUN].filter(Boolean);

  return `<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-col footer-brand-col">
      <p class="footer-brand">${name}</p>
      <p class="footer-tagline">${escapeHtml(sheet.TAGLINE ?? "")}</p>
    </div>
    <div class="footer-col">
      <h4>${escapeHtml(L.contactTitle)}</h4>
      ${address ? `<p>${escapeHtml(address)}</p>` : ""}
      ${phone ? `<p><a href="tel:${escapeHtml(phone)}">${escapeHtml(phoneText)}</a></p>` : ""}
      ${email ? `<p><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>` : ""}
    </div>
    ${hours.length > 0 ? `<div class="footer-col">
      <h4>${escapeHtml(L.hours)}</h4>
      ${hours.map((h) => `<p class="footer-hours">${escapeHtml(h)}</p>`).join("\n      ")}
    </div>` : ""}
    <div class="footer-col">
      <h4>${escapeHtml(L.legalNav)}</h4>
      <p><a href="about.html">${escapeHtml(L.navAbout)}</a></p>
      <p><a href="privacy.html">${escapeHtml(L.privacy)}</a></p>
      <p><a href="terms.html">${escapeHtml(L.terms)}</a></p>
    </div>
  </div>
  <div class="footer-bottom container">
    <p>© ${year} ${name}. ${escapeHtml(L.footerRights)}</p>
    ${sheet.FACEBOOK && sheet.FACEBOOK !== "none" ? `<a href="${safeUrl(sheet.FACEBOOK)}" rel="noopener" target="_blank">Facebook</a>` : ""}
    ${sheet.INSTAGRAM && sheet.INSTAGRAM !== "none" ? `<a href="${safeUrl(sheet.INSTAGRAM)}" rel="noopener" target="_blank">Instagram</a>` : ""}
  </div>
</footer>`;
}
