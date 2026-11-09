// Tracking des emails — fonctions PURES (testable sans DB) :
// pixel d'ouverture + redirection de clics avec classification destination.
// La mise à jour SQL vit dans /api/track/open et /api/track/click.

import { randomBytes } from "node:crypto";

export function newEmailToken(): string {
  return randomBytes(16).toString("hex");
}

export type ClickKind = "site" | "payment" | "external";

/** whop.com = lien de paiement ; tout le reste = site/lien site vitrine. */
export function classifyClick(url: string): ClickKind {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "whop.com" || host.endsWith(".whop.com")) return "payment";
    return "site";
  } catch {
    return "external";
  }
}

function unescapeUrl(u: string): string {
  return u.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/** Réécrit les href http(s) d'un HTML en redirecteur de clic. Ne double-enchasse
 * jamais un lien déjà tracké ni les mailto:. */
export function wrapLinks(html: string, base: string, token: string): string {
  const b = base.replace(/\/$/, "");
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (full, raw) => {
    const url = unescapeUrl(raw);
    if (url.startsWith(`${b}/api/track/`)) return full;
    const enc = encodeURIComponent(url);
    const safe = htmlEsc(url);
    return `href="${b}/api/track/click?t=${token}&u=${enc}" data-track="${safe}"`;
  });
}

/** Texte brut : remplace les URLs nues par l'URL de redirection (mailto exclu). */
export function trackifyText(text: string, base: string, token: string): string {
  const b = base.replace(/\/$/, "");
  return text.replace(/(https?:\/\/[^\s<>"'[()\]]+)/g, (url) =>
    url.startsWith(`${b}/api/track/`) ? url : `${b}/api/track/click?t=${token}&u=${encodeURIComponent(url)}`
  );
}

/** URLs déjà ÉCHAPPÉES (dans du HTML) → ancres pointant le redirecteur. */
export function linkifyEscaped(escapedText: string, base: string, token: string): string {
  const b = base.replace(/\/$/, "");
  return escapedText.replace(/https?:\/\/[^\s<>"']+/g, (m) => {
    const url = unescapeUrl(m);
    if (url.startsWith(`${b}/api/track/`)) return m;
    const enc = encodeURIComponent(url);
    return `<a href="${b}/api/track/click?t=${token}&u=${enc}" style="color:#0A8757;word-break:break-all">${m}</a>`;
  });
}

/** Pixel d'ouverture 1×1 injecté avant la fermeture du body (ou en fin). */
export function injectPixel(html: string, base: string, token: string): string {
  const pixel = `<img src="${base.replace(/\/$/, "")}/api/track/open?t=${token}" alt="" width="1" height="1" style="opacity:0;border:0" />`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${pixel}</body>`);
  return `${html}${pixel}`;
}

function htmlEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
