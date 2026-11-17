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
check("fallback rating null -> aucune note + invitation", (() => {
  const i = renderFallbackIndex(buildSiteConfig({ ...sheet, GOOGLE_RATING: "", REVIEW_COUNT: "" }, 1));
  // « 4.8 » matcherait le path SVG de l'étoile (« 4.87 ») — on cible la note rendue.
  return !i.includes("4.8</span>") && !i.includes("4.8/5") && !i.includes("aggregateRating") && !i.includes("Google reviews") && i.includes("Your review matters");
})());
check("fallback mobile bar", idx.includes("mobile-bar") && idx.includes("tel:"));
check("fallback pas de FAB WhatsApp", !idx.toLowerCase().includes("whatsapp"));
check("fallback pas de modale légale", !idx.includes("legalModal"));
check("fallback liens légaux réels", idx.includes('href="/privacy"') && idx.includes('href="/terms"'));
check("fallback services cliquables", idx.includes('href="/services/leak-repair"'));
check("fallback hero overlay image locale", idx.includes("images/hero.jpg"));
check("fallback topbar une ligne", idx.includes("24/7 Emergency") === config.emergency247 && (config.emergency247 || idx.includes("Mon-Fri 8-6")));
check("fallback CTA contact neutre", idx.includes("Get in touch") && !idx.includes("Get Directions"));
check("fallback JSON-LD LocalBusiness + FAQ", idx.includes("application/ld+json") && idx.includes("FAQPage"));

// rating 0 -> pas de note affichée, la section devient une invitation honnête
const idx0 = renderFallbackIndex(buildSiteConfig({ ...sheet, GOOGLE_RATING: "0.0", REVIEW_COUNT: "0" }, 1));
check("fallback rating 0 -> invitation sans note", !idx0.includes("4.8</span>") && !idx0.includes("4.8/5") && !idx0.includes("See reviews on Google") && idx0.includes("Your review matters"));

// ── Voix éditoriale de la niche : un site FR de salle de sport ne doit JAMAIS
// parler « chantier/permis/devis » — la FAQ, les engagements, le parcours et
// les légendes de galerie viennent de niches.ts (gym).
const gymSheet = {
  ...sheet, BUSINESS_NAME: "SayFit Club", BUSINESS_TYPE: "salle de sport", TAGLINE: "Salle de sport haut de gamme à Marrakech",
  CITY: "Marrakech", COUNTRY: "Morocco", ZIP: "40000", LANG: "fr", LOCALE: "fr-FR",
  PHONE: "+212 661 23 45 67", PHONE_LINK: "+212661234567", EMAIL: "none",
  HOURS_WEEKDAY: "Lun-Sam 7h-22h", SCHEMA_TYPE: "ExerciseGym",
  PRIMARY_COLOR: "#0A0A0A", ACCENT_COLOR: "#E53935", NEUTRAL_BG: "#F2F2F2",
  SERVICES: JSON.stringify([
    { title: "Cours Collectifs", desc: "Des cours variés pour tous les niveaux." },
    { title: "Fitness", desc: "Des séances adaptées à votre rythme." },
    { title: "Coaching Personnel", desc: "Un suivi individuel et mesurable." },
    { title: "Musculation", desc: "Plateaux libres et machines complètes." },
    { title: "Cardio", desc: "Tapis, rameurs, vélos connectés." },
  ]),
  SERVICES_FULL: "",
};
const gym = renderFallbackIndex(buildSiteConfig(gymSheet, 2087));
check("gym: aucune trace de jargon BTP", !/chantier|permis|devis/i.test(gym));
check("gym: titre réalisations neutre", gym.includes("Réalisations récentes autour de Marrakech"));
check("gym: engagements de la niche", gym.includes("Coachs diplômés") && gym.includes("Séance découverte"));
check("gym: parcours de la niche", gym.includes("Bilan de départ") && gym.includes("Bilans réguliers"));
check("gym: FAQ de la niche", gym.includes("Puis-je essayer avant de m'abonner ?") && gym.includes("mixte et adaptée aux femmes"));
check("gym: légendes de galerie", gym.includes('class="g-cap"') && gym.includes("Plateau Libre") && gym.includes("Zone Cardio"));
check("gym: chips hero depuis la niche", gym.includes('class="chip">Formules flexibles<') && !gym.includes("Résidentiel & Commercial"));
check("gym: marqueurs v6 intacts", ["topbar", "trustbar", "w-card", "p-step", "faq-item", "t-star", "mobile-bar", "data-reveal", "api/site-form/"].every((m) => gym.includes(m)));
const gymEn = renderFallbackIndex(buildSiteConfig({ ...gymSheet, LANG: "en", LOCALE: "en-US", COUNTRY: "United States", CITY: "Dallas" }, 2087));
check("gym EN: FAQ de la niche (faqEn)", gymEn.includes("Can I try before I join?"));
check("gym EN: pas de caption fr", !gymEn.includes('class="g-cap"'));

process.exit(fail ? 1 : 0);
