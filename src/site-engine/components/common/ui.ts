import type { SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml, safeUrl } from "../../utils/escape";

/** Image avec repli silencieux : le parent porte un dégradé CSS. */
export function imgTag(src: string | undefined, alt: string, opts?: { className?: string; eager?: boolean }): string {
  if (!src) return "";
  const cls = opts?.className ? ` class="${opts.className}"` : "";
  const load = opts?.eager ? ' loading="eager" fetchpriority="high"' : ' loading="lazy"';
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${cls}${load} decoding="async" onerror="this.style.display='none'">`;
}

/** Liste d'images de la galerie (sheet) — pipes séparés. */
export function galleryImages(sheet: ClientSheet): string[] {
  return (sheet.GALLERY_IMAGE_URLS ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s) || s.startsWith("/"));
}

export type CtaAction = "call" | "form" | "whatsapp" | "booking";

/** href d'un CTA selon son action (téléphone, WhatsApp, formulaire). */
export function ctaHref(action: CtaAction, sheet: ClientSheet): string {
  const phone = (sheet.PHONE_LINK ?? "").replace(/[^\d+]/g, "");
  if (action === "call" && phone) return safeUrl(`tel:${phone}`);
  if (action === "whatsapp") {
    const wa = safeUrl(sheet.WHATSAPP_URL);
    if (wa !== "#") return wa;
  }
  return "#contact";
}

/** Attributs externes pour WhatsApp. */
export function ctaExtra(action: CtaAction): string {
  return action === "whatsapp" ? ' rel="noopener" target="_blank"' : "";
}

/** Badge d'icône : initiale du titre dans un disque dégradé (zéro CDN). */
export function iconBadge(title: string, className = "icon-badge"): string {
  const letter = escapeHtml((title.trim()[0] ?? "•").toUpperCase());
  return `<span class="${className}" aria-hidden="true">${letter}</span>`;
}

/** Étoiles d'avis accessibles. */
export function stars(rating: number, outOfLabel: string): string {
  const r = Math.max(0, Math.min(5, Math.round(rating)));
  return `<span class="stars" role="img" aria-label="${r} ${escapeHtml(outOfLabel)}">${"★".repeat(r)}<span class="stars-dim">${"★".repeat(5 - r)}</span></span>`;
}

/** Section wrapper standard. */
export function sectionOpen(cls: string, id?: string): string {
  return `<section class="section ${cls}"${id ? ` id="${id}"` : ""}>`;
}

/** Bloc de contenu textuel (paragraphes) — chaque texte est échappé. */
export function paragraphs(items: string[], cls = "para"): string {
  return items.map((p) => `<p class="${cls}">${escapeHtml(p)}</p>`).join("\n      ");
}
