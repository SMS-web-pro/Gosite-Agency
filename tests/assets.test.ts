import {
  STOCK_BASE,
  NICHE_IMAGES,
  normalizeNiche,
  resolveImages,
  generateFallbackPack,
  applyImagePack,
} from "./_lib/stock-resolver.ts";
import { generateFavicon, brandInitials, safeHex } from "./_lib/favicon-gen.ts";
import { generateOgImage } from "./_lib/og-image-gen.ts";
import { specFixture, specSheet } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

// ── Normalisation des niches ────────────────────────────────────────────────
{
  const cases: Array<[string, string]> = [
    ["Plumber", "plumber"],
    ["Plomberie / Chauffage", "plumber"],
    ["plombier", "plumber"],
    ["Gym / Fitness", "gym"],
    ["Salle de sport", "gym"],
    ["Salle de beauté", "salon"],
    ["Coiffeur", "salon"],
    ["Barbier", "barber"],
    ["Barbershop / Salon", "barber"],
    ["Restaurant", "restaurant"],
    ["Boulangerie", "bakery"],
    ["Avocat", "lawyer"],
    ["Dentiste / Médical", "dentist"],
    ["Électricien", "electrician"],
    ["Peintre", "painter"],
    ["Garage auto", "mechanic"],
    ["Agent immobilier", "realtor"],
    ["Photographe", "photographer"],
    ["Comptable", "accountant"],
    ["Vétérinaire", "veterinarian"],
    ["Nettoyage industriel", "default"],
    ["", "default"],
  ];
  let allOk = true;
  for (const [input, expected] of cases) {
    if (normalizeNiche(input) !== expected) { allOk = false; console.log("  niche mismatch:", input, "->", normalizeNiche(input)); }
  }
  check("niche: 22 normalisations FR/EN", allOk);
  check("niche: undefined -> default", normalizeNiche(undefined) === "default");
}

// ── Packs d'images ──────────────────────────────────────────────────────────
{
  const plumbing = resolveImages("Plomberie / Chauffage");
  check("pack: hero R2", plumbing.hero === `${STOCK_BASE}/plumber/hero.webp`);
  check("pack: about R2", plumbing.about === `${STOCK_BASE}/plumber/about.webp`);
  check("pack: og R2", plumbing.og === `${STOCK_BASE}/plumber/og.webp`);
  check("pack: 4 galeries https", plumbing.gallery.length === 4 && plumbing.gallery.every((g) => g.startsWith("https://")));

  const gym = resolveImages("Gym / Fitness");
  check("pack: gym galerie spécifique", gym.gallery[0].includes("/gym/training-1.webp"));

  const unknown = resolveImages("Nettoyage industriel");
  check("pack: inconnu -> default", unknown.hero.startsWith(`${STOCK_BASE}/default/`));

  check("packs: 16 niches + default", Object.keys(NICHE_IMAGES).length === 16);
  check("packs: toutes galeries >= 4", Object.values(NICHE_IMAGES).every((p) => p.gallery.length >= 4));

  const sheet = applyImagePack(specSheet, plumbing);
  check("sheet: clés images injectées", sheet.HERO_IMAGE_URL === plumbing.hero && sheet.ABOUT_IMAGE_URL === plumbing.about && sheet.OG_IMAGE_URL === plumbing.og);
  check("sheet: galerie pipe-jointe", sheet.GALLERY_IMAGE_URLS.split("|").length === 4);
  check("sheet: autres clés conservées", sheet.BUSINESS_NAME === "Test Co");
}

// ── Fallback SVG ────────────────────────────────────────────────────────────
{
  const fallback = generateFallbackPack("#112233", "#ff7a1a");
  check("fallback: data URI SVG", fallback.hero.startsWith("data:image/svg+xml,"));
  check("fallback: 4 galeries", fallback.gallery.length === 4);
  const decoded = decodeURIComponent(fallback.hero.replace("data:image/svg+xml,", ""));
  check("fallback: dégradé palette", decoded.includes("<linearGradient") && decoded.includes("#112233") && decoded.includes("#ff7a1a"));
  check("fallback: aucun undefined", !decoded.includes("undefined") && !fallback.about.includes("undefined"));
}

// ── Favicon ─────────────────────────────────────────────────────────────────
{
  check("favicon: initiales 2 mots", brandInitials("Test Co") === "TC");
  check("favicon: mot unique -> 2 lettres", brandInitials("Plomberie") === "PL");
  check("favicon: vide -> G", brandInitials("") === "G");
  check("favicon: symboles ignorés", brandInitials("<script> alert") === "SA");

  const fav = generateFavicon("Test Co", "#112233");
  check("favicon: SVG + initiales + couleur", fav.startsWith("<svg") && fav.includes(">TC</text>") && fav.includes('fill="#112233"'));
  check("favicon: couleur invalide -> repli", generateFavicon("X", "red; background:url(javascript:x)").includes('fill="#111827"'));
  check("favicon: injection neutralisée", !generateFavicon("<script>x</script>", "#112233").includes("<script>x"));

  check("safeHex: valide", safeHex("#AABBCC") === "#AABBCC");
  check("safeHex: invalide", safeHex("javascript:alert(1)") === "#111827");
}

// ── OG image ────────────────────────────────────────────────────────────────
{
  const sheet = { ...specSheet, TAGLINE: "Dallas Plumbing Done Right", CITY: "Dallas" };
  const og = generateOgImage(sheet, specFixture);
  check("og: dimensions 1200x630", og.includes('width="1200"') && og.includes('height="630"'));
  check("og: nom + accroche + ville", og.includes("Test Co") && og.includes("Dallas Plumbing Done Right") && og.includes(">Dallas</text>"));
  check("og: dégradé palette", og.includes("#112233") && og.includes("#ff7a1a"));
  check("og: aucun undefined", !og.includes("undefined"));

  const evil = generateOgImage({ ...sheet, BUSINESS_NAME: "<script>alert(1)</script>", TAGLINE: "A & B" }, specFixture);
  check("og: nom échappé", !evil.includes("<script>alert(1)") && evil.includes("&lt;script&gt;"));
  check("og: esperluette échappée", evil.includes("A &amp; B"));

  const longName = generateOgImage({ ...sheet, BUSINESS_NAME: "Un nom d'entreprise vraiment tres tres long pour tester la coupe" }, specFixture);
  check("og: troncature avec points de suspension", longName.includes("…"));
}

process.exit(fail ? 1 : 0);
