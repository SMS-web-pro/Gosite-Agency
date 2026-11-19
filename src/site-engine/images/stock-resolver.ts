// Couche 3 (spec 2.6) : images libres de droits par niche, servies depuis
// nos propres assets statiques (public/stock, déployés avec le site). Chaque
// pack fournit hero, about, 4 visuels de galerie et une image OG — aucune
// dépendance à Unsplash/Pexels au runtime des sites générés.

import type { ClientSheet } from "../types";

export type NicheImagePack = {
  hero: string;
  about: string;
  gallery: string[];
  og: string;
};

export const STOCK_BASE = "https://gosite.digital/stock";

function pack(slug: string, aboutName = "about", galleryNames = ["work-1", "work-2", "work-3", "work-4"]): NicheImagePack {
  return {
    hero: `${STOCK_BASE}/${slug}/hero.webp`,
    about: `${STOCK_BASE}/${slug}/${aboutName}.webp`,
    gallery: galleryNames.map((g) => `${STOCK_BASE}/${slug}/${g}.webp`),
    og: `${STOCK_BASE}/${slug}/og.webp`,
  };
}

export const NICHE_IMAGES: Record<string, NicheImagePack> = {
  plumber: pack("plumber"),
  electrician: pack("electrician"),
  painter: pack("painter"),
  mechanic: pack("mechanic"),
  gym: pack("gym", "interior", ["training-1", "group-1", "equipment-1", "coach-1"]),
  restaurant: pack("restaurant", "interior", ["dish-1", "dish-2", "room-1", "chef-1"]),
  bakery: pack("bakery", "counter", ["bread-1", "pastry-1", "oven-1", "shop-1"]),
  lawyer: pack("lawyer", "office", ["meeting-1", "library-1", "desk-1", "team-1"]),
  dentist: pack("dentist", "clinic", ["room-1", "equipment-1", "reception-1", "team-1"]),
  salon: pack("salon", "interior", ["hair-1", "color-1", "nails-1", "reception-1"]),
  barber: pack("barber", "shop", ["cut-1", "beard-1", "chair-1", "detail-1"]),
  realtor: pack("realtor", "team", ["home-1", "home-2", "visit-1", "keys-1"]),
  photographer: pack("photographer", "studio", ["shoot-1", "portrait-1", "event-1", "setup-1"]),
  accountant: pack("accountant", "office", ["desk-1", "meeting-1", "documents-1", "team-1"]),
  veterinarian: pack("veterinarian", "clinic", ["care-1", "exam-1", "recovery-1", "team-1"]),
  default: pack("default"),
};

/** Synonymes FR/EN -> clé de niche interne. */
const NICHE_KEYWORDS: Array<[string, string[]]> = [
  ["barber", ["barber", "barbier", "barbershop"]],
  ["gym", ["gym", "fitness", "salle de sport", "musculation", "crossfit", "coach"]],
  ["bakery", ["bakery", "boulangerie", "patisserie", "pastry", "patissier"]],
  ["restaurant", ["restaurant", "cafe", "bistro", "brasserie", "food"]],
  ["lawyer", ["lawyer", "attorney", "avocat", "law firm", "legal", "juridique"]],
  ["dentist", ["dentist", "dental", "dentiste", "orthodont"]],
  ["salon", ["salon", "beauty", "beaute", "spa", "coiffeur", "coiffure", "esthetique", "esthetic"]],
  ["plumber", ["plumber", "plumbing", "plombier", "plomberie", "chauffagiste", "heating"]],
  ["electrician", ["electrician", "electrical", "electricien", "electricite"]],
  ["painter", ["painter", "painting", "peintre", "peinture"]],
  ["mechanic", ["mechanic", "garage", "auto", "car repair", "mecanicien"]],
  ["realtor", ["realtor", "real estate", "immobilier", "agent immobilier"]],
  ["photographer", ["photographer", "photographe", "photography"]],
  ["accountant", ["accountant", "accounting", "comptable", "comptabilite"]],
  ["veterinarian", ["veterinarian", "veterinaire", "vet "]],
];

/** "Plomberie / Chauffage", "Salle de sport", "Électricien" -> clé interne. */
export function normalizeNiche(businessType: string | undefined): string {
  const raw = String(businessType ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!raw) return "default";
  if (NICHE_IMAGES[raw]) return raw;
  for (const [key, words] of NICHE_KEYWORDS) {
    if (words.some((w) => raw.includes(w))) return key;
  }
  return "default";
}

function svgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s{2,}/g, " ").trim())}`;
}

/** Repli abstrait (dégradé SVG) si aucun pack réel n'est disponible. */
export function generateFallbackPack(primary = "#111827", accent = "#ff7a1a"): NicheImagePack {
  const gradient = (label: string): string =>
    svgDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${primary}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs>
<rect width="1200" height="800" fill="url(#g)"/>
<circle cx="980" cy="160" r="220" fill="#ffffff" opacity="0.08"/>
<circle cx="220" cy="660" r="260" fill="#ffffff" opacity="0.06"/>
<text x="600" y="420" text-anchor="middle" font-family="sans-serif" font-size="44" font-weight="700" fill="#ffffff" opacity="0.9">${label}</text>
</svg>`);
  return {
    hero: gradient("Hero"),
    about: gradient("About"),
    gallery: [gradient("1"), gradient("2"), gradient("3"), gradient("4")],
    og: gradient("Preview"),
  };
}

/** Pack d'images de la niche, avec repli "default". */
export function resolveImages(businessType: string | undefined): NicheImagePack {
  const key = normalizeNiche(businessType);
  return NICHE_IMAGES[key] ?? NICHE_IMAGES.default;
}

/** Injecte le pack dans les clés images du sheet (utilisé par l'agent coder). */
export function applyImagePack(sheet: ClientSheet, images: NicheImagePack): ClientSheet {
  return {
    ...sheet,
    HERO_IMAGE_URL: images.hero,
    ABOUT_IMAGE_URL: images.about,
    GALLERY_IMAGE_URLS: images.gallery.join("|"),
    OG_IMAGE_URL: images.og,
  };
}
