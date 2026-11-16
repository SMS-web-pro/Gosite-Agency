// offer-copy — types + discipline de la copie commerciale (module PUR, testé).
// Le LLM ne peut ni faire passer un fait inventé (+30 %, « gratuit »), ni
// écrire l'encadré offre ou le CTA (déterministes, repris des fallbacks).
// Chaque valeur invalide retombe sur le pack de langue — jamais de blocage.

export type SalesCopyRaw = { subject?: string; hook?: string; bullets?: string[]; offerTitle?: string; cta?: string; closing?: string };
export type SalesCopy = { subject: string; hook: string; bullets: string[]; offerTitle: string; cta: string; closing: string };

/** Ce qui fait qu'une phrase n'est pas vérifiable : un pourcentage ou une
 *  promesse de gratuité. « Gratuit » est réservé aux inclusions RÉELLES de
 *  l'offre (domaine, hébergement, support), écrites par le template. */
const POLLUTED = /%|gratuit/i;

/** Nettoie la proposition LLM : toute phrase polluée est supprimée entière
 *  (le coerce retombera sur le fallback), les bullets saines sont gardées. */
export function sanitizeCopyRaw(raw: SalesCopyRaw | null): SalesCopyRaw {
  if (!raw) return {};
  const clean = (v: unknown): string => (typeof v === "string" && !POLLUTED.test(v) ? v.trim() : "");
  const bullets = Array.isArray(raw.bullets)
    ? raw.bullets.filter((b): b is string => typeof b === "string" && b.trim().length > 0 && !POLLUTED.test(b))
    : [];
  return { subject: clean(raw.subject), hook: clean(raw.hook), bullets, closing: clean(raw.closing) };
}

/** Valide et borne la copie ; `fallbacks` (pack de langue + prospect) fournit
 *  TOUT ce que le LLM n'a pas fourni de sain — et toujours offerTitle/cta. */
export function coerceCopy(raw: SalesCopyRaw | null, fallbacks: SalesCopy): SalesCopy {
  const r = sanitizeCopyRaw(raw);
  const str = (v: string, max: number, fb: string): string => (v ? v.slice(0, max) : fb);
  const bullets = (r.bullets ?? []).map((b) => b.trim().slice(0, 120)).slice(0, 4);
  return {
    subject: str(r.subject, 90, fallbacks.subject),
    hook: str(r.hook, 420, fallbacks.hook),
    bullets: bullets.length >= 2 ? bullets : fallbacks.bullets,
    offerTitle: fallbacks.offerTitle,
    cta: fallbacks.cta,
    closing: str(r.closing, 300, fallbacks.closing),
  };
}
