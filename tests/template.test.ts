import { generateSiteHtml } from "./_lib/site-template.ts";
import { validateSheet } from "./_lib/mapper.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const base: Record<string, string> = {
  BUSINESS_NAME: "Boulangerie Atlas", BUSINESS_TYPE: "boulangerie", TAGLINE: "Le pain au levain, rien que ça",
  DESCRIPTION: "Pain au levain", PHONE: "05 20 30 40 50", PHONE_LINK: "+33520304050", EMAIL: "none",
  ADDRESS: "1 rue du Marché", CITY: "Dallas", ZIP: "75201", COUNTRY: "United States",
  CURRENCY: "USD", MAPS_LINK: "https://maps.google.com/?q=dallas", MAPS_EMBED: "https://maps.google.com/maps?q=dallas&output=embed",
  LAT: "32.77", LNG: "-96.79", GOOGLE_RATING: "0.0", REVIEW_COUNT: "0",
  LANG: "en", LANG_DIR: "ltr", LOCALE: "en-US", SCHEMA_TYPE: "Bakery",
  PRIMARY_COLOR: "#8B4513", ACCENT_COLOR: "#D2691E", NEUTRAL_BG: "#FDF6EC", STYLE: "warm",
  DISPLAY_FONT: "Syne", HERO_IMAGE_URL: "https://images.unsplash.com/x", ABOUT_IMAGE_URL: "https://images.unsplash.com/y",
};

// A. SANS données réelles : rien d'inventé
const noData = generateSiteHtml(base);
check("A. pas de faux avis (google svg)", !noData.includes("4285F4"));
check("A. pas d'aggregateRating", !noData.includes("aggregateRating"));
check("A. pas d'horaires inventés", !noData.includes("9h00"));
check("A. pas de 'ans de' inventé", !noData.includes("ans de<br>") && !noData.includes("ans de métier"));
check("A. pas de 'clients satisfaits'", !noData.includes("clients satisfaits"));
check("A. pas de 'avis vérifiés'", !noData.includes("avis vérifiés"));
check("A. pas de garantie 1 an", !noData.includes("Garantie 1 an"));
check("A. validateSheet OK sans horaires", validateSheet(base).ok);

// B. AVEC données réelles : la réputation factuelle s'affiche
const withData = generateSiteHtml({ ...base, GOOGLE_RATING: "4.7", REVIEW_COUNT: "120+", HOURS_WEEKDAY: "Lun-Sam 6h-19h" });
check("B. réputation présente", withData.includes("avis publics sur Google"));
check("B. aggregateRating réel", withData.includes("aggregateRating"));
check("B. rating réel affiché", withData.includes("4.7"));
check("B. horaires réels affichés", withData.includes("Lun-Sam 6h-19h"));
check("B. pays US dans JSON-LD", withData.includes('"addressCountry":"US"'));
check("B. pas de 'vérifiés'", !withData.includes("avis vérifiés"));

process.exit(fail ? 1 : 0);
