// mapper.ts — buildClientSheet : nouveaux champs v5 (SERVICES/ABOUT_SOURCE vides
// au départ, IMAGE_SOURCE=pool, IMAGE_FALLBACK_URL=image héros du pool).
import assert from "node:assert";
import { buildClientSheet, validateSheet } from "./_lib/mapper.ts";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "✔" : "✖"} ${label}${!cond ? ` ${extra}` : ""}`);
};

const fake = {
  id: 1,
  businessName: "Positiflo Organizing",
  businessType: "house cleaning",
  tagline: null,
  description: null,
  phone: "+1 555 010 2030",
  email: null,
  address: "12 Main St",
  city: "Dallas",
  zip: "75201",
  country: "USA",
  rating: "4.8",
  reviewCount: 64,
  lat: "32.77",
  lng: "-96.79",
  hours: {},
} as never;

const sheet = buildClientSheet(fake as never);

ok("IMAGE_SOURCE=pool", sheet.IMAGE_SOURCE === "pool", sheet.IMAGE_SOURCE);
ok("IMAGE_FALLBACK_URL https", typeof sheet.IMAGE_FALLBACK_URL === "string" && sheet.IMAGE_FALLBACK_URL.startsWith("https://"), sheet.IMAGE_FALLBACK_URL);
ok("IMAGE_FALLBACK_URL = héros", sheet.IMAGE_FALLBACK_URL === sheet.HERO_IMAGE_URL);
ok("SERVICES présent (vide)", "SERVICES" in sheet && sheet.SERVICES === "");
ok("ABOUT_SOURCE présent (vide)", "ABOUT_SOURCE" in sheet && sheet.ABOUT_SOURCE === "");

// Les nouveaux champs ne sont pas requis par validateSheet (une fiche sans
// Serper doit rester valide)
const v = validateSheet(sheet);
ok("fiche valide sans Serper", v.ok, (v.missing ?? []).join(","));

console.log(fails === 0 ? "SUITE OK" : `SUITE KO (${fails})`);
if (fails) process.exit(1);
