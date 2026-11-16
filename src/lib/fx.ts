// fx — conversion de devise pure. Le prix de base est TOUJOURS en USD :
// la base est une constante, pas un setting, pour qu'aucune config fausse ne
// puisse recréer le bug « 259 MAD » (le chiffre réutilisé tel quel dans une
// autre devise). Les taux viennent de open.er-api.com, mis en cache côté
// emailer — ce module, lui, ne touche ni au réseau ni à la base. Pur.

export const OFFER_BASE_CURRENCY = "USD";

export type Rates = Record<string, number>;

/* ─────────── Devise d'affichage du lead ─────────── */

const USD_RE = /\b(usa?|u\.s\.a?|united states|états-unis|etats-unis|america)\b/i;
const GBP_RE = /\b(uk|u\.k\.|united kingdom|royaume-uni|england|angleterre|great britain|gb)\b/i;
const MAD_RE = /\b(maroc|morocco)\b/i;
const EUR_RE = /\b(france|belgium|belgique|belgie|luxembourg)\b/i;
// Pays francophones sans devise géo dédiée : l'euro reste le choix le moins
// mauvais (le Mapper ne produit de toute façon que MAD/USD/GBP/EUR).
const FR_RE = /\b(france|canada|belgium|belgique|belgie|maroc|morocco|algerie|algeria|tunisie|tunisia|suisse|switzerland|luxembourg)\b/i;

const KNOWN_CURRENCIES = new Set(["USD", "GBP", "MAD", "EUR"]);

/** La fiche (CURRENCY, remplie par le Mapper) gagne ; sinon la géo du pays. */
export function resolveDisplayCurrency(p: {
  clientData?: Record<string, string> | null;
  country?: string | null;
}): string {
  const sheet = (p.clientData ?? {}) as Record<string, unknown>;
  const raw = typeof sheet.CURRENCY === "string" ? sheet.CURRENCY.trim().toUpperCase() : "";
  if (KNOWN_CURRENCIES.has(raw)) return raw;
  const country = String(p.country ?? "");
  if (USD_RE.test(country)) return "USD";
  if (GBP_RE.test(country)) return "GBP";
  if (MAD_RE.test(country)) return "MAD";
  if (EUR_RE.test(country)) return "EUR";
  return FR_RE.test(country) ? "EUR" : "USD";
}

/* ─────────── Conversion + arrondi + formatage ─────────── */

/** USD → devise du lead. Taux absent/invalide → null (le caller retombe en USD,
 *  jamais un montant faux). */
export function convertUsd(amountUsd: number, currency: string, rates: Rates): number | null {
  const cur = currency.toUpperCase();
  if (cur === OFFER_BASE_CURRENCY) return amountUsd;
  const rate = rates[cur];
  return typeof rate === "number" && rate > 0 ? amountUsd * rate : null;
}

/** Arrondi marketing TOUJOURS vers le bas (jamais plus cher que le taux réel) :
 *  multiple de 10 sous 10 000, de 100 sous 100 000, sinon de 1 000. */
export function roundMarketing(n: number): number {
  const step = n >= 100_000 ? 1000 : n >= 10_000 ? 100 : 10;
  return Math.floor(n / step) * step;
}

/** $259 · £210 · 2 570 MAD · 249 € (Intl fr-FR, zéro décimale). */
export function formatMoney(amount: number, currency: string): string {
  const cur = currency.toUpperCase();
  if (cur === "USD") return `$${Math.round(amount)}`;
  if (cur === "GBP") return `£${Math.round(amount)}`;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} ${cur}`;
}

/** Prix affiché : converti + arrondi en devise du lead, avec la base USD
 *  discrète (« ≈ $259 ») si la devise diffère. Sans taux fiables → USD brut. */
export function displayOffer(
  amountUsd: number,
  currency: string,
  rates: Rates | null,
): { main: string; approx: string | null } {
  const converted = rates ? convertUsd(amountUsd, currency, rates) : null;
  if (converted === null) return { main: formatMoney(amountUsd, OFFER_BASE_CURRENCY), approx: null };
  const main = formatMoney(roundMarketing(converted), currency);
  const approx =
    currency.toUpperCase() === OFFER_BASE_CURRENCY ? null : `≈ ${formatMoney(amountUsd, OFFER_BASE_CURRENCY)}`;
  return { main, approx };
}
