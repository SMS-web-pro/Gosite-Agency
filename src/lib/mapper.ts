// Mapper — remplit et valide la fiche client complète.
import type { Prospect } from "@/db/schema";
import { findNiche, localeFor } from "./niches";
import { pickSeededImages } from "./images";

export function buildClientSheet(p: Prospect): Record<string, string> {
  const niche = findNiche(p.businessType);
  const loc = localeFor(p.country ?? "France");
  const phoneDigits = (p.phone ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  const lat = p.lat ?? "0";
  const lng = p.lng ?? "0";
  // Les fiches Serper n'ont pas toujours de coordonnées GPS — repli sur la recherche par adresse
  const geoOk = Math.abs(parseFloat(lat)) > 0.0001 && Math.abs(parseFloat(lng)) > 0.0001;
  const queryFallback = encodeURIComponent(`${p.businessName} ${p.address ?? ""} ${p.city ?? ""}`);
  const mapsLink = geoOk
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${queryFallback}`;
  const hours = (p.hours ?? {}) as Record<string, string>;
  const city = p.city ?? "";
  const name = p.businessName;
  // Images déterministes et DIFFÉRENTES pour chaque lead (seed nom+ville) :
  // héros, about et 6 photos de galerie piochées dans le pool niche sans
  // répétition d'un site à l'autre.
  const imgs = pickSeededImagesSafe(niche.imagePool, `${name}|${city}`, 6, niche.heroImage, niche.aboutImage);
  const rating = parseFloat(String(p.rating ?? "0")) || 0;
  const reviews = p.reviewCount ?? 0;

  const tagline =
    p.tagline ||
    pick(niche.taglineTemplates);

  const description =
    p.description ||
    (rating > 0
      ? `${name} — ${niche.label.toLowerCase()} à ${city}. Note Google ${rating.toFixed(1)}/5 sur la base de ${reviews} avis publics. ${niche.trustBadges.join(" · ")}.`
      : `${name} — ${niche.label.toLowerCase()} à ${city}. ${niche.trustBadges.join(" · ")}.`);

  return {
    BUSINESS_NAME: name,
    BUSINESS_TYPE: p.businessType,
    TAGLINE: tagline,
    DESCRIPTION: description,
    PHONE: p.phone ?? "",
    PHONE_LINK: phoneDigits ? `+${phoneDigits}` : "",
    EMAIL: p.email ?? "none",
    ADDRESS: p.address ?? "",
    CITY: city,
    ZIP: p.zip ?? "",
    COUNTRY: p.country ?? "France",
    CURRENCY: loc.currency,
    MAPS_LINK: mapsLink,
    MAPS_EMBED: geoOk
      ? `https://www.google.com/maps?q=${lat},${lng}&output=embed`
      : `https://maps.google.com/maps?q=${queryFallback}&output=embed`,
    LAT: String(lat),
    LNG: String(lng),
    // Horaires : UNIQUEMENT les données réelles — rien n'est inventé si absentes.
    HOURS_WEEKDAY: hours.weekday ?? "",
    HOURS_SAT: hours.sat ?? "",
    HOURS_SUN: hours.sun ?? "",
    GOOGLE_RATING: rating.toFixed(1),
    REVIEW_COUNT: reviews >= 50 ? `${Math.floor(reviews / 10) * 10}+` : String(reviews),
    LANG: loc.lang,
    LANG_DIR: loc.dir,
    LOCALE: loc.locale,
    SCHEMA_TYPE: niche.schemaType,
    PRIMARY_COLOR: niche.primary,
    ACCENT_COLOR: niche.accent,
    NEUTRAL_BG: niche.neutralBg,
    STYLE: niche.style,
    DISPLAY_FONT: niche.displayFont,
    ACCESSIBILITY: "true",
    PARKING: "street",
    PAYMENT: "",
    INSTAGRAM: "none",
    FACEBOOK: "none",
    HERO_IMAGE_URL: imgs.hero,
    ABOUT_IMAGE_URL: imgs.about,
    GALLERY_IMAGE_URLS: imgs.gallery.join("|"),
    // Champs v5 — remplis par enrichSheetFromRealData (Serper + LLM) :
    // SERVICES = services réels dérivés de la description du lead,
    // ABOUT_SOURCE = description Google Maps réelle, IMAGE_SOURCE = traçabilité,
    // IMAGE_FALLBACK_URL = image de substitution si un lien d'image meurt.
    SERVICES: "",
    ABOUT_SOURCE: "",
    IMAGE_SOURCE: "pool",
    IMAGE_FALLBACK_URL: imgs.hero,
    // Bouton flottant WhatsApp : lien wa.me avec message prérempli dans la
    // langue du site. Vide si aucun téléphone (le Coder supprime le bouton).
    WHATSAPP_URL: phoneDigits
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(
          loc.lang.startsWith("en")
            ? `Hello ${name}, I'd like to get more information.`
            : `Bonjour ${name}, je souhaite obtenir plus d'informations.`,
        )}`
      : "",
    NICHE_LABEL: niche.label,
    NICHE_ICON: niche.icon,
  };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Jamais bloquant : pool manquant → repli héros/about déclaratifs de la niche. */
function pickSeededImagesSafe(pool: string[], seed: string, count: number, heroFb: string, aboutFb: string) {
  if (pool.length > 0) return pickSeededImages(pool, seed, count);
  return { hero: heroFb, about: aboutFb, gallery: [] as string[] };
}

/** Services de repli de la niche (variante EN pour les sites anglophones). */
export function nicheServicesJson(niche: ReturnType<typeof findNiche>, isEn: boolean): string {
  const list = isEn ? (niche.servicesEn ?? []) : niche.services;
  return JSON.stringify(list.map(({ title, desc }) => ({ title, desc })));
}

/**
 * Enrichissement v6 — données RÉELLES du lead, jamais bloquant :
 * 1. Serper /maps : description Google + horaires réels (ABOUT_SOURCE, HOURS_*).
 * 2. SERVICES préparés en repli niche — le LLM du Mapper les remplace si la
 *    description réelle est exploitable.
 * Les IMAGES ne passent plus par Serper (photos concurrents bannies) : le
 * build v6 télécharge le pool Unsplash curé et les embarque localement.
 * Les imports DB/Serper restent dynamiques : ce module est copié tel quel dans
 * tests/_lib (pur).
 */
export async function enrichSheetFromRealData(p: Prospect, sheet: Record<string, string>): Promise<void> {
  // Idempotence : une fiche déjà enrichie (retry du pipeline, crash après
  // persistance) ne re-brûle pas de crédits Serper pour le même résultat.
  if (sheet.SERVICES_FULL) return;
  try {
    const niche = findNiche(p.businessType);
    const isEn = (sheet.LANG || "fr").startsWith("en");
    const gl = ((sheet.LOCALE || "fr-FR").split("-")[1] || "fr").toLowerCase();
    const hl = isEn ? "en" : "fr";
    // Repli par défaut tant que le LLM n'a pas prouvé mieux (ou si Serper est
    // épuisé/hors ligne).
    sheet.SERVICES = nicheServicesJson(niche, isEn);

    const serper = await import("./serper");
    const key = await serper.nextSerperKey();
    if (!key) return;

    // /maps — 1 crédit : description réelle + horaires. Les IMAGES ne viennent
    // PLUS de Serper (photos concurrents bannies) : le build v6 télécharge le
    // pool Unsplash curé et les embarque localement.
    const det = await serper.fetchLeadDetails({
      apiKey: key.apiKey,
      q: `${p.businessName} ${p.address ?? ""} ${p.city ?? ""}`.trim(),
      gl,
      hl,
    });
    await serper.countSerperCredit(key.id);
    if (det.description) sheet.ABOUT_SOURCE = det.description.slice(0, 400);
    if (det.hours) {
      if (det.hours.weekday) sheet.HOURS_WEEKDAY = det.hours.weekday;
      if (det.hours.sat) sheet.HOURS_SAT = det.hours.sat;
      if (det.hours.sun) sheet.HOURS_SUN = det.hours.sun;
    }
  } catch (err) {
    // Aucun enrichissement ne doit casser le mapping : le pool garde la main.
    if (!sheet.SERVICES) {
      const niche = findNiche(p.businessType);
      sheet.SERVICES = nicheServicesJson(niche, (sheet.LANG || "fr").startsWith("en"));
    }
    // Traçabilité : un enrichissement silencieusement no-op (blip DB, module
    // absent) doit rester distinguishable d'un Serper à sec.
    try {
      const { logActivity } = await import("./activity");
      await logActivity({
        agentKey: "mapper", action: "enrichissement_echec",
        message: `${p.businessName} : enrichissement Serper ignoré (${err instanceof Error ? err.message.slice(0, 120) : "erreur inconnue"}) — services de niche conservés.`,
        level: "warn", prospectId: p.id,
      });
    } catch {
      // Journalisation impossible : on ne casse jamais le mapping pour un log.
    }
  }
}

// Required fields of the sheet — Mapper validates they are filled
export function validateSheet(d: Record<string, string>): { ok: boolean; missing: string[] } {
  const required = [
    "BUSINESS_NAME", "BUSINESS_TYPE", "TAGLINE", "DESCRIPTION", "PHONE", "PHONE_LINK",
    "EMAIL", "ADDRESS", "CITY", "COUNTRY", "CURRENCY", "MAPS_LINK", "MAPS_EMBED",
    "LAT", "LNG", "GOOGLE_RATING", "REVIEW_COUNT", "LANG", "LOCALE",
    "SCHEMA_TYPE", "PRIMARY_COLOR", "ACCENT_COLOR", "NEUTRAL_BG", "STYLE", "HERO_IMAGE_URL",
  ];
  const missing = required.filter((k) => !d[k] || d[k].trim() === "" || d[k].startsWith("["));
  return { ok: missing.length === 0, missing };
}
