// SiteConfig v6 — source de vérité unique du bundle : chaque fichier généré
// (index Gemini, pages auxiliaires, JSON-LD, sitemap, email TODO) est rendu
// depuis cet objet. Module PUR (copié tel quel dans tests/_lib).

import { findNiche } from "./niches";
import { nicheServicesJson } from "./mapper";

export type SiteService = { slug: string; title: string; short: string; paras: string[]; bullets: string[] };

export type SiteConfig = {
  name: string; tagline: string; phone: string; phoneLink: string; email: string | null;
  address: string; city: string; zip: string; country: string; currency: string;
  domain: string; mapUrl: string; mapEmbed: string | null; lat: number | null; lng: number | null;
  rating: number | null; reviewCount: number | null;
  hours: { weekday: string; sat: string; sun: string } | null; emergency247: boolean;
  services: SiteService[]; areas: string[];
  socials: { instagram?: string; facebook?: string };
  formAction: string;
  images: { hero: string; about: string; gallery: string[] };
  year: number; lang: "fr" | "en"; locale: string; dir: "ltr" | "rtl";
  nicheLabel: string; schemaType: string;
  primaryColor: string; accentColor: string; neutralBg: string;
  prospectId: number;
};

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

const str = (v: string | undefined, max = 300): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: string | undefined): number | null => {
  // « 80+ » (reviews arrondies) et « ~4.5 » se parsent proprement.
  const n = Number(String(str(v)).replace(/[+~\s]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Services complets du site (SERVICES + merge SERVICES_FULL + repli niche)
 *  — partagé entre buildSiteConfig et le prompt Gemini (buildSiteBundle). */
export function resolveServices(sheet: Record<string, string>): SiteService[] {
  let list: { title?: unknown; short?: unknown; desc?: unknown; slug?: unknown; paras?: unknown; bullets?: unknown }[] = [];
  try { list = JSON.parse(sheet.SERVICES || "[]"); } catch { list = []; }
  let services: SiteService[] = (Array.isArray(list) ? list : [])
    .map((s) => ({ title: str(String(s.title ?? ""), 60), short: str(String(s.short ?? s.desc ?? ""), 200) }))
    .filter((s) => s.title)
    .map((s) => ({ slug: "", title: s.title, short: s.short, paras: [] as string[], bullets: [] as string[] }));
  // SERVICES_FULL : le LLM (map) fournit paras/bullets par service — merge par titre.
  try {
    const full = JSON.parse(sheet.SERVICES_FULL || "[]");
    if (Array.isArray(full)) {
      for (const f of full) {
        const title = str(String((f as Record<string, unknown>).title ?? ""), 60);
        const target = services.find((s) => s.title.toLowerCase() === title.toLowerCase());
        if (!target) continue;
        target.slug = slugify(str(String((f as Record<string, unknown>).slug ?? ""), 48)) || slugify(target.title);
        target.paras = (Array.isArray(f.paras) ? f.paras : []).map((p: unknown) => str(String(p), 400)).filter(Boolean).slice(0, 3);
        target.bullets = (Array.isArray(f.bullets) ? f.bullets : []).map((b: unknown) => str(String(b), 120)).filter(Boolean).slice(0, 4);
      }
    }
  } catch { /* SERVICES_FULL invalide → paras assemblées au repli */ }
  const isEn = (sheet.LANG || "fr").startsWith("en");
  for (const s of services) {
    if (!s.slug) s.slug = slugify(s.title);
    if (s.paras.length === 0) {
      // Repli déterministe : jamais de page service vide (Review Focus 4).
      const city = str(sheet.CITY, 60) || "our area";
      s.paras = isEn
        ? [`${s.short} In ${city}, our team handles it with upfront pricing and clear timelines.`, `Every ${s.title.toLowerCase()} job starts with an honest assessment — you approve the plan before we touch a wrench. Call us and we will walk you through what happens next.`]
        : [`${s.short} À ${city}, notre équipe intervient avec un devis clair et des délais annoncés.`, `Chaque intervention ${s.title.toLowerCase()} commence par une évaluation honnête — vous validez le plan avant le moindre outil. Appelez-nous, nous vous expliquons la suite.`];
    }
  }
  if (services.length < 5) {
    const niche = findNiche(sheet.BUSINESS_TYPE || "");
    services = JSON.parse(nicheServicesJson(niche, isEn)).map((s: { title: string; desc: string }) => ({
      slug: slugify(s.title), title: s.title, short: str(s.desc, 200), paras: [] as string[], bullets: [] as string[],
    }));
    for (const s of services) {
      const city = str(sheet.CITY, 60) || "our area";
      s.paras = isEn
        ? [`${s.short} Serving ${city} with upfront pricing.`, `We arrive on time, assess honestly, and quote before we start. Ask us anything by phone — no obligation.`]
        : [`${s.short} Au service de ${city}, devis clair et transparent.`, `Nous arrivons à l'heure, évaluons honnêtement et chiffrons avant de commencer. Appelez-nous, sans engagement.`];
      s.bullets = [];
    }
  }
  return services.slice(0, 6);
}

export function buildSiteConfig(sheet: Record<string, string>, prospectId: number): SiteConfig {
  const slug = str(sheet.SLUG, 60).replace(/^https?:\/\//, "").replace(/\.vercel\.app$/, "").replace(/\/$/, "");
  const domain = str(sheet.DOMAIN, 120) || `https://${slug}.vercel.app`;
  const query = encodeURIComponent([str(sheet.BUSINESS_NAME, 80), str(sheet.ADDRESS, 120), str(sheet.CITY, 60), str(sheet.ZIP, 12)].filter(Boolean).join(" "));
  const rating = num(sheet.GOOGLE_RATING);
  const reviewCount = num(sheet.REVIEW_COUNT);
  const weekday = str(sheet.HOURS_WEEKDAY, 60);
  const sat = str(sheet.HOURS_SAT, 60);
  const sun = str(sheet.HOURS_SUN, 60);
  const hours = weekday ? { weekday, sat, sun } : null;
  const email = str(sheet.EMAIL, 120);
  const lat = num(sheet.LAT);
  const lng = num(sheet.LNG);
  const mapEmbed = str(sheet.MAPS_EMBED, 500) || null;
  const ig = str(sheet.INSTAGRAM, 200);
  const fb = str(sheet.FACEBOOK, 200);
  const areas = (str(sheet.AREAS, 300) || str(sheet.CITY, 60)).split(",").map((c) => c.trim()).filter(Boolean);

  return {
    name: str(sheet.BUSINESS_NAME, 80), tagline: str(sheet.TAGLINE, 120),
    phone: str(sheet.PHONE, 30), phoneLink: str(sheet.PHONE_LINK, 30) || str(sheet.PHONE, 30).replace(/[^\d+]/g, ""),
    email: email && email.toLowerCase() !== "none" ? email : null,
    address: str(sheet.ADDRESS, 160), city: str(sheet.CITY, 60), zip: str(sheet.ZIP, 12),
    country: str(sheet.COUNTRY, 60) || "France", currency: str(sheet.CURRENCY, 8) || "USD",
    domain, mapUrl: `https://www.google.com/maps/search/?api=1&query=${query}`, mapEmbed, lat, lng,
    rating, reviewCount, hours, emergency247: /24\s*\/\s*7|24h/i.test(weekday),
    services: resolveServices(sheet), areas,
    socials: { ...(ig && ig.toLowerCase() !== "none" ? { instagram: ig } : {}), ...(fb && fb.toLowerCase() !== "none" ? { facebook: fb } : {}) },
    formAction: `https://gosite.digital/api/site-form/${prospectId}`,
    images: { hero: "images/hero.jpg", about: "images/about.jpg", gallery: [1, 2, 3, 4, 5, 6].map((i) => `images/work-${i}.jpg`) },
    year: new Date().getFullYear(),
    lang: (sheet.LANG || "fr").startsWith("en") ? "en" : "fr",
    locale: str(sheet.LOCALE, 12) || "en-US", dir: (sheet.LANG_DIR || "ltr") === "rtl" ? "rtl" : "ltr",
    nicheLabel: findNiche(sheet.BUSINESS_TYPE || "").label, schemaType: str(sheet.SCHEMA_TYPE, 40) || "LocalBusiness",
    primaryColor: str(sheet.PRIMARY_COLOR, 20) || "#12294b", accentColor: str(sheet.ACCENT_COLOR, 20) || "#ff7a1a",
    neutralBg: str(sheet.NEUTRAL_BG, 20) || "#f6f8fc",
    prospectId,
  };
}
