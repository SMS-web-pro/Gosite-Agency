import { buildSiteConfig } from "./_lib/site-config.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const base: Record<string, string> = {
  BUSINESS_NAME: "Positiflo", BUSINESS_TYPE: "plumbing", TAGLINE: "Dallas Plumbing Done Right",
  DESCRIPTION: "Residential and commercial plumbing.", SLUG: "positiflo-plumbing-dallas",
  PHONE: "+1 469-555-3810", PHONE_LINK: "+14695553810", EMAIL: "none",
  ADDRESS: "1 Main St", CITY: "Dallas", ZIP: "75201", COUNTRY: "United States", CURRENCY: "USD",
  MAPS_LINK: "https://maps.google.com/?q=positiflo", MAPS_EMBED: "https://www.google.com/maps?q=dallas&output=embed",
  LAT: "32.77", LNG: "-96.79", GOOGLE_RATING: "4.8", REVIEW_COUNT: "64",
  HOURS_WEEKDAY: "Mon-Fri 8-6", HOURS_SAT: "Sat 9-2", HOURS_SUN: "Closed",
  LANG: "en", LANG_DIR: "ltr", LOCALE: "en-US", SCHEMA_TYPE: "Plumber",
  PRIMARY_COLOR: "#12294b", ACCENT_COLOR: "#ff7a1a", NEUTRAL_BG: "#f6f8fc", STYLE: "bold",
  SERVICES: JSON.stringify([
    { title: "Leak Repair", desc: "Fast leak detection and repair." },
    { title: "Drain Cleaning", desc: "Clogs cleared same day." },
    { title: "Water Heater Repair", desc: "Hot water restored fast." },
    { title: "Pipe Installation", desc: "Repiping done right." },
    { title: "Sewer Line Inspection", desc: "Camera inspection before you dig." },
    { title: "Bathroom Plumbing", desc: "Fixtures and remodels." },
  ]),
  SERVICES_FULL: JSON.stringify([
    { slug: "leak-repair", title: "Leak Repair", short: "Fast leak detection.", paras: ["Slab leaks are common in Dallas.", "We locate and fix them without tearing the house apart."], bullets: ["Same-day service", "Upfront pricing", "Licensed plumbers"] },
    { slug: "drain-cleaning", title: "Drain Cleaning", short: "Clogs cleared same day.", paras: ["Slow drains get worse fast.", "We clear them with the right tool, not more water."], bullets: ["No-dig camera checks", "Rooter service"] },
  ]),
  INSTAGRAM: "none", FACEBOOK: "none", IMAGE_SOURCE: "local",
};

const c = buildSiteConfig(base, 1952);
check("domain = alias slug", c.domain === "https://positiflo-plumbing-dallas.vercel.app");
check("mapUrl = search propre", c.mapUrl.startsWith("https://www.google.com/maps/search/?api=1&query=") && c.mapUrl.includes("Positiflo"));
check("mapUrl = jamais raw coords", !c.mapUrl.includes("32.77"));
check("rating réel", c.rating === 4.8 && c.reviewCount === 64);
check("services 6 + paras du FULL", c.services.length === 6 && (c.services[0].paras?.length ?? 0) >= 2 && (c.services[0].bullets?.length ?? 0) >= 3);
check("service slug propre", c.services[0].slug === "leak-repair");
check("formAction prospect", c.formAction === "https://gosite.digital/api/site-form/1952");
check("emergency247 false (Mon-Fri)", c.emergency247 === false);
check("email none -> null", c.email === null);
check("images locales", c.images.hero === "images/hero.jpg" && c.images.gallery.length === 6);
check("socials none -> vides", !c.socials.instagram && !c.socials.facebook);
check("horaires parsés", c.hours?.weekday === "Mon-Fri 8-6" && c.hours?.sun === "Closed");

// Rating 0.0 → null partout
const c0 = buildSiteConfig({ ...base, GOOGLE_RATING: "0.0", REVIEW_COUNT: "0" }, 1);
check("rating 0 -> null", c0.rating === null && c0.reviewCount === null);

// 24/7 → emergency true
const c24 = buildSiteConfig({ ...base, HOURS_WEEKDAY: "Open 24/7" }, 1);
check("24/7 -> emergency", c24.emergency247 === true);

// SERVICES invalide → repli niche (deterministic, pas de trou)
const cBad = buildSiteConfig({ ...base, SERVICES: "pas du json", SERVICES_FULL: "" }, 1);
check("SERVICES invalide -> repli >= 5", cBad.services.length >= 5 && cBad.services[0].paras.length >= 2 && !!cBad.services[0].slug);

// DOMAIN custom prioritaire
const cDom = buildSiteConfig({ ...base, DOMAIN: "https://positiflo-dfw.com" }, 1);
check("DOMAIN custom prioritaire", cDom.domain === "https://positiflo-dfw.com");

// AREAS csv
const cAr = buildSiteConfig({ ...base, AREAS: "Dallas, Plano, Irving" }, 1);
check("areas csv", cAr.areas.length === 3 && cAr.areas[1] === "Plano");
check("areas défaut = city", buildSiteConfig({ ...base }, 1).areas.length >= 1);

process.exit(fail ? 1 : 0);
