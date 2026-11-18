import type { SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";

/** JSON-LD LocalBusiness — uniquement des données réelles du sheet. */
export function localBusinessJsonLd(sheet: ClientSheet, spec: SiteSpec, url: string): Record<string, unknown> {
  const rating = Number.parseFloat(sheet.GOOGLE_RATING ?? "0") || 0;
  const reviews = Number.parseInt(String(sheet.REVIEW_COUNT ?? "0").replace(/[^\d]/g, ""), 10) || 0;
  const lat = Number.parseFloat(sheet.LAT ?? "0") || 0;
  const lng = Number.parseFloat(sheet.LNG ?? "0") || 0;
  const img = /^https?:\/\//.test(sheet.HERO_IMAGE_URL ?? "") ? sheet.HERO_IMAGE_URL : undefined;

  return {
    "@context": "https://schema.org",
    "@type": sheet.SCHEMA_TYPE || "LocalBusiness",
    name: sheet.BUSINESS_NAME || "",
    description: sheet.DESCRIPTION || spec.metaDescription,
    url,
    telephone: sheet.PHONE || undefined,
    email: /^[^@\s]+@[^@\s]+$/.test(sheet.EMAIL ?? "") ? sheet.EMAIL : undefined,
    image: img,
    address: {
      "@type": "PostalAddress",
      streetAddress: sheet.ADDRESS || undefined,
      addressLocality: sheet.CITY || undefined,
      postalCode: sheet.ZIP || undefined,
      addressCountry: sheet.COUNTRY || undefined,
    },
    geo: lat !== 0 || lng !== 0 ? { "@type": "GeoCoordinates", latitude: lat, longitude: lng } : undefined,
    aggregateRating:
      rating > 0 && reviews > 0
        ? { "@type": "AggregateRating", ratingValue: rating, reviewCount: reviews }
        : undefined,
  };
}

/** JSON-LD FAQPage — seulement si la home contient une section FAQ. */
export function faqJsonLd(spec: SiteSpec): Record<string, unknown> | null {
  const faq = spec.homeSections.find((s) => s.type === "faq");
  if (!faq || faq.type !== "faq") return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}
