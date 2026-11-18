// Échappement HTML systématique de tout texte venant du SiteSpec ou du sheet.
// À utiliser DANS les attributs comme dans le contenu.

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/** URL sûre : http(s), tel:, mailto:, wa.me uniquement — sinon "#". */
export function safeUrl(value: string | undefined | null): string {
  const v = String(value ?? "").trim();
  if (/^https?:\/\//i.test(v) || /^tel:\+?[0-9()\s-]+$/i.test(v) || /^mailto:[^@\s]+@[^@\s]+$/i.test(v)) {
    return escapeHtml(v);
  }
  return "#";
}

/** Sérialisation JSON-LD sans risque de fermer la balise script. */
export function jsonLdSafe(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}
