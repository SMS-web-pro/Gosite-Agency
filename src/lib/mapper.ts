// Mapper — remplit et valide la fiche client complète.
import type { Prospect } from "@/db/schema";
import { findNiche, localeFor } from "./niches";

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
  const rating = parseFloat(String(p.rating ?? "0")) || 0;
  const reviews = p.reviewCount ?? 0;

  const tagline =
    p.tagline ||
    pick(niche.taglineTemplates);

  const description =
    p.description ||
    `${name} — ${niche.label.toLowerCase()} à ${city}. Note Google ${rating.toFixed(1)}/5 sur la base de ${reviews} avis vérifiés. ${niche.trustBadges.join(" · ")}.`;

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
    HOURS_WEEKDAY: hours.weekday ?? "Lun–Ven 9h00 – 19h00",
    HOURS_SAT: hours.sat ?? "Sam 9h00 – 18h00",
    HOURS_SUN: hours.sun ?? "Dim Fermé",
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
    PAYMENT: "Espèces, Cartes",
    INSTAGRAM: "none",
    FACEBOOK: "none",
    HERO_IMAGE_URL: niche.heroImage,
    ABOUT_IMAGE_URL: niche.aboutImage,
    NICHE_LABEL: niche.label,
    NICHE_ICON: niche.icon,
  };
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Required fields of the sheet — Mapper validates they are filled
export function validateSheet(d: Record<string, string>): { ok: boolean; missing: string[] } {
  const required = [
    "BUSINESS_NAME", "BUSINESS_TYPE", "TAGLINE", "DESCRIPTION", "PHONE", "PHONE_LINK",
    "EMAIL", "ADDRESS", "CITY", "COUNTRY", "CURRENCY", "MAPS_LINK", "MAPS_EMBED",
    "LAT", "LNG", "HOURS_WEEKDAY", "GOOGLE_RATING", "REVIEW_COUNT", "LANG", "LOCALE",
    "SCHEMA_TYPE", "PRIMARY_COLOR", "ACCENT_COLOR", "NEUTRAL_BG", "STYLE", "HERO_IMAGE_URL",
  ];
  const missing = required.filter((k) => !d[k] || d[k].trim() === "" || d[k].startsWith("["));
  return { ok: missing.length === 0, missing };
}
