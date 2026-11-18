import type { SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml, safeUrl } from "../../utils/escape";
import { labels } from "../../utils/labels";

const PHONE_ICON =
  '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

const WA_ICON =
  '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.4A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20zm4.4-5.9c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7.3 7.3 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c2.3.9 2.3.6 2.7.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.1c-.1-.1-.2-.2-.4-.3z"/></svg>';

export function renderMobileBar(sheet: ClientSheet, spec: SiteSpec): string {
  const L = labels(spec.lang);
  const phone = (sheet.PHONE_LINK ?? "").replace(/[^\d+]/g, "");
  const phoneLink = phone ? `tel:${escapeHtml(phone)}` : "";
  const wa = safeUrl(sheet.WHATSAPP_URL);
  const hasWa = wa !== "#";

  if (!phoneLink && !hasWa) return "";

  return `<nav class="mobile-bar" aria-label="${escapeHtml(L.contactTitle)}">
  ${phoneLink ? `<a class="mbar-btn mbar-call" href="${phoneLink}">${PHONE_ICON}<span>${escapeHtml(L.call)}</span></a>` : ""}
  ${hasWa ? `<a class="mbar-btn mbar-wa" href="${wa}" rel="noopener" target="_blank">${WA_ICON}<span>${escapeHtml(L.whatsapp)}</span></a>` : `<a class="mbar-btn mbar-contact" href="#contact">${escapeHtml(L.navContact)}</a>`}
</nav>`;
}
