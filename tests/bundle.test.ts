import { renderAuxPages, generateTodoList, renderFallbackIndex } from "./_lib/bundle.ts";
import { buildSiteConfig } from "./_lib/site-config.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const sheet = {
  BUSINESS_NAME: "Positiflo", BUSINESS_TYPE: "plumbing", TAGLINE: "Dallas Plumbing Done Right",
  DESCRIPTION: "Residential and commercial plumbing.", SLUG: "positiflo-plumbing-dallas",
  PHONE: "+1 469-555-3810", PHONE_LINK: "+14695553810", EMAIL: "team@positiflo.com",
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
    { slug: "leak-repair", title: "Leak Repair", short: "Fast leak detection.", paras: ["Slab leaks are common in Dallas.", "We locate and fix them without tearing the house apart."], bullets: ["Same-day service", "Upfront pricing"] },
    { slug: "drain-cleaning", title: "Drain Cleaning", short: "Clogs cleared same day.", paras: ["Slow drains get worse fast.", "We clear them with the right tool."], bullets: ["No-dig camera checks"] },
  ]),
  IMAGE_SOURCE: "local",
};
const config = buildSiteConfig(sheet, 1952);

const bundle = renderAuxPages(config);
const keys = Object.keys(bundle);
check("pages attendues présentes", ["privacy.html", "terms.html", "404.html", "sitemap.xml", "robots.txt", "site.webmanifest", "favicon.svg", "vercel.json"].every((k) => keys.includes(k)));
check("pages services 5-6", keys.filter((k) => k.startsWith("services/")).length >= 5);

const privacy = bundle["privacy.html"];
check("privacy head complet", privacy.includes("<title>") && privacy.includes('rel="canonical"') && privacy.includes("og:image"));
check("privacy données réelles", privacy.includes("team@positiflo.com") && privacy.includes("+1 469-555-3810") && privacy.includes("https://positiflo-plumbing-dallas.vercel.app/privacy"));
check("privacy pas de lorem", !privacy.toLowerCase().includes("lorem"));
check("terms page", bundle["terms.html"].includes("Positiflo"));
check("404 brandée", bundle["404.html"].includes("Positiflo") && bundle["404.html"].includes('href="https://positiflo-plumbing-dallas.vercel.app/"'));

const sitemap = bundle["sitemap.xml"];
check("sitemap urlset + loc clean", sitemap.includes("<urlset") && sitemap.includes(`<loc>https://positiflo-plumbing-dallas.vercel.app/services/leak-repair</loc>`) && !sitemap.includes(".html"));
check("sitemap privacy + terms", sitemap.includes("/privacy") && sitemap.includes("/terms"));

check("robots + sitemap", bundle["robots.txt"].includes(`Sitemap: https://positiflo-plumbing-dallas.vercel.app/sitemap.xml`));
check("vercel.json cleanUrls", bundle["vercel.json"].includes('"cleanUrls": true'));
check("favicon monogramme", bundle["favicon.svg"].includes("<svg"));
check("manifest", bundle["site.webmanifest"].includes("Positiflo"));

const svc = bundle["services/leak-repair.html"];
check("service page contenu", svc.includes("Leak Repair") && svc.includes("Call Now") && svc.includes('rel="canonical"') && svc.includes("Slab leaks"));
check("service page CTA", svc.includes("tel:+14695553810"));

// JSON-LD LocalBusiness
const ld = bundle["services/leak-repair.html"].match(/application\/ld\+json">([\s\S]*?)<\/script>/);
check("JSON-LD parse", !!ld && JSON.parse(ld[1]).name === "Positiflo");
check("aggregateRating réel", ld && ld[1].includes("aggregateRating"));
check("OG image locale", svc.includes('property="og:image" content="https://positiflo-plumbing-dallas.vercel.app/images/hero.jpg"'));

// Rating 0 → pas d'aggregateRating nulle part
const c0 = buildSiteConfig({ ...sheet, GOOGLE_RATING: "0.0", REVIEW_COUNT: "0" }, 1);
const b0 = renderAuxPages(c0);
check("rating 0 -> pas d'aggregateRating", !b0["privacy.html"].includes("aggregateRating") && !b0["services/leak-repair.html"].includes("aggregateRating"));
check("rating 0 -> pas de faux bloc Google", !b0["services/leak-repair.html"].includes("4.8"));

// TODO list
const todo = generateTodoList(config);
check("TODO >= 4 items", todo.length >= 4);
check("TODO photos + licence + avis", todo.some((t) => /photo/i.test(t)) && todo.some((t) => /license/i.test(t)) && todo.some((t) => /review/i.test(t)));
check("TODO pas de photos si... (toujours liste)", todo.length >= 4);

// T4 — fallback index déterministe
const idx = renderFallbackIndex(config);
check("fallback doctype", idx.startsWith("<!DOCTYPE html>"));
check("fallback data-reveal", idx.includes("data-reveal") && !idx.includes("data-aos"));
check("fallback zéro hotlink", !/<img[^>]+src="https?:\/\//.test(idx));
check("fallback onerror substitution locale", idx.includes("this.onerror=null;this.src='images/about.jpg'"));
check("fallback 3 dividers", (idx.match(/section-divider/g) || []).length >= 3);
check("fallback form action + honeypot", idx.includes(`action="${config.formAction}"`) && idx.includes('name="website"'));
check("fallback rating null -> aucune note", (() => { const i = renderFallbackIndex(buildSiteConfig({ ...sheet, GOOGLE_RATING: "", REVIEW_COUNT: "" }, 1)); return !i.includes("4.8") && !i.includes("aggregateRating") && !i.includes("Google reviews"); })());
check("fallback mobile bar", idx.includes("mobile-bar") && idx.includes("tel:"));
check("fallback pas de FAB WhatsApp", !idx.toLowerCase().includes("whatsapp"));
check("fallback pas de modale légale", !idx.includes("legalModal"));
check("fallback liens légaux réels", idx.includes('href="/privacy"') && idx.includes('href="/terms"'));
check("fallback services cliquables", idx.includes('href="/services/leak-repair"'));
check("fallback hero overlay image locale", idx.includes("images/hero.jpg"));
check("fallback topbar une ligne", idx.includes("24/7 Emergency") === config.emergency247 && (config.emergency247 || idx.includes("Mon-Fri 8-6")));
check("fallback get a free quote", idx.includes("Get a Free Quote") && !idx.includes("Get Directions"));
check("fallback JSON-LD LocalBusiness + FAQ", idx.includes("application/ld+json") && idx.includes("FAQPage"));

// rating 0 -> section testimonials omise, aucune mention de note
const idx0 = renderFallbackIndex(buildSiteConfig({ ...sheet, GOOGLE_RATING: "0.0", REVIEW_COUNT: "0" }, 1));
check("fallback rating 0 -> pas de bloc avis", !idx0.includes("4.8") && !idx0.includes("reviews on Google"));

process.exit(fail ? 1 : 0);
