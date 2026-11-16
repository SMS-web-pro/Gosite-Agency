import { generateIncludedFeatures, generateTodoList } from "./_lib/bundle.ts";
import { buildSiteConfig } from "./_lib/site-config.ts";

let fail = 0;
const check = (n: string, c: boolean) => {
  if (!c) {
    fail++;
    console.log("FAIL", n);
  } else console.log("ok  ", n);
};

const sheet = {
  BUSINESS_NAME: "Étoile",
  BUSINESS_TYPE: "salon de coiffure",
  CITY: "Casablanca",
  COUNTRY: "Maroc",
  PHONE: "+212600000000",
  TAGLINE: "Beauté et soin",
  GOOGLE_RATING: "4.5",
  GOOGLE_REVIEWS: "30",
};
const cfg = buildSiteConfig(sheet, 42);

// ── generateIncludedFeatures : uniquement des faits du bundle ──
const feats = generateIncludedFeatures(cfg);
check("inclut accueil", feats.some((f) => /accueil/i.test(f)));
check("inclut services avec nombre", feats.some((f) => f.includes(String(cfg.services.length)) && /service/i.test(f)));
check("inclut formulaire", feats.some((f) => /formulaire/i.test(f)));
check("inclut mobile", feats.some((f) => /mobile/i.test(f)));
check("inclut référencement local", feats.some((f) => /Google/i.test(f)));
check("inclut mentions légales", feats.some((f) => /légales/i.test(f)));
check("galerie présente si photos", feats.some((f) => /galerie/i.test(f)));
{
  const sansGalerie = generateIncludedFeatures({ ...cfg, images: { hero: "", about: "", gallery: [] } });
  check("galerie conditionnelle", sansGalerie.every((f) => !/galerie/i.test(f)));
}
check("langue EN", generateIncludedFeatures({ ...cfg, lang: "en" }).every((f) => !/accueil|galerie/i.test(f)));

// ── generateTodoList : vocabulaire niche-neutre ──
const todos = generateTodoList(cfg);
check("checklist sans chantier", todos.every((t) => !/chantier/i.test(t)));
check("checklist parle de vos photos", todos.some((t) => /photos/i.test(t)));
check("checklist sans licence en dur", todos.every((t) => !/numéro de licence/i.test(t)));

if (fail) {
  console.log(`\n${fail} échec(s) offer-features`);
  process.exit(1);
}
console.log("\nok  offer-features — tous verts");
