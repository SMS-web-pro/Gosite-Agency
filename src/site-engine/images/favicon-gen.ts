// Favicon SVG déterministe : initiales de la marque sur fond couleur primaire.
// Aucun raster, aucun CDN — un seul fichier texte dans le bundle.

import { escapeHtml } from "../utils/escape";

/** Couleur hex valide ou repli neutre. */
export function safeHex(color: string | undefined, fallback = "#111827"): string {
  const v = String(color ?? "").trim();
  return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
}

/** Initiales : 2 premières lettres significatives (1 seule lettre -> 2 lettres du mot). */
export function brandInitials(name: string | undefined): string {
  const cleaned = String(name ?? "")
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);

  if (cleaned.length === 0) return "G";
  if (cleaned.length === 1) return (cleaned[0].slice(0, 2) || "G").toUpperCase();
  return (cleaned[0][0] + cleaned[1][0]).toUpperCase();
}

export function generateFavicon(businessName: string | undefined, primary: string): string {
  const initials = escapeHtml(brandInitials(businessName));
  const fill = safeHex(primary);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="${initials}">
<rect width="64" height="64" rx="14" fill="${fill}"/>
<text x="32" y="41" text-anchor="middle" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" font-size="26" font-weight="700" fill="#ffffff">${initials}</text>
</svg>
`;
}
