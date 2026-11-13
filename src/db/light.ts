// light.ts — projection légère des prospects pour les listes/polling.
// Les colonnes site_html (50 Ko) et site_bundle (jusqu'à ~300 Ko jsonb)
// sont exclues : le dashboard et /pipeline rafraîchissent /api/stats toutes
// les 7 s — avec ces colonnes, la réponse pesait ~18 Mo.
import { sql } from "drizzle-orm";
import { prospects } from "@/db/schema";

export const prospectLightColumns = {
  id: prospects.id,
  businessName: prospects.businessName,
  businessType: prospects.businessType,
  tagline: prospects.tagline,
  description: prospects.description,
  phone: prospects.phone,
  email: prospects.email,
  emailStatus: prospects.emailStatus,
  emailDetail: prospects.emailDetail,
  address: prospects.address,
  city: prospects.city,
  zip: prospects.zip,
  country: prospects.country,
  rating: prospects.rating,
  reviewCount: prospects.reviewCount,
  hasWebsite: prospects.hasWebsite,
  websiteUrl: prospects.websiteUrl,
  mapsLink: prospects.mapsLink,
  lat: prospects.lat,
  lng: prospects.lng,
  source: prospects.source,
  stage: prospects.stage,
  rejectReason: prospects.rejectReason,
  siteSlug: prospects.siteSlug,
  deployedUrl: prospects.deployedUrl,
  deployStatus: prospects.deployStatus,
  salesEmailId: prospects.salesEmailId,
  contactedAt: prospects.contactedAt,
  paymentUrl: prospects.paymentUrl,
  paymentStatus: prospects.paymentStatus,
  domainUrl: prospects.domainUrl,
  searchQuery: prospects.searchQuery,
  aiScore: prospects.aiScore,
  aiInsight: prospects.aiInsight,
  failCount: prospects.failCount,
  createdAt: prospects.createdAt,
  updatedAt: prospects.updatedAt,
  // Bools calculées en SQL : jamais les payloads lourds.
  hasSite: sql<boolean>`(${prospects.siteHtml} is not null or ${prospects.siteBundle} is not null)`,
  hasBundle: sql<boolean>`${prospects.siteBundle} is not null`,
};

export type ProspectLight = {
  [K in keyof typeof prospectLightColumns]: unknown;
};

/** Charge un lead sans les payloads lourds (site_html / site_bundle).
 *  À utiliser partout où le bundle n'est pas nécessaire : le bundle v6
 *  pèse ~2.7 Mo par lead. */
export async function loadProspectLight(id: number) {
  const { db } = await import("./index");
  const { prospects } = await import("./schema");
  const { eq } = await import("drizzle-orm");
  const rows = await db
    .select(prospectLightColumns)
    .from(prospects)
    .where(eq(prospects.id, id))
    .limit(1);
  return rows[0] ?? null;
}
