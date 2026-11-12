import { buildSiteBundle } from "./_lib/coder.ts";
import { buildSiteConfig } from "./_lib/site-config.ts";

let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`ok   ${name}`);
  else {
    console.log(`FAIL ${name}`);
    fail++;
  }
}
const JPEG_15K = Buffer.alloc(15360, 7).buffer as ArrayBuffer;

const sheet: Record<string, string> = {
  BUSINESS_NAME: "Positiflo",
  BUSINESS_TYPE: "plumber",
  TAGLINE: "Plomberie rapide et honnête",
  DESCRIPTION: "Plombier à Dallas. Interventions rapides, devis clair.",
  CITY: "Dallas",
  ZIP: "75201",
  COUNTRY: "United States",
  CURRENCY: "USD",
  PHONE: "+1 469-555-3810",
  PHONE_LINK: "+14695553810",
  EMAIL: "team@positiflo.example",
  ADDRESS: "1200 Main St",
  MAPS_LINK: "https://maps.google.com/?q=Positiflo+Dallas",
  HOURS_WEEKDAY: "Mon-Fri 8-6",
  HOURS_SAT: "Sat 9-2",
  HOURS_SUN: "Closed",
  GOOGLE_RATING: "4.8",
  REVIEW_COUNT: "64",
  LANG: "en",
  LANG_DIR: "ltr",
  LOCALE: "en-US",
  SCHEMA_TYPE: "Plumber",
  PRIMARY_COLOR: "#12294b",
  ACCENT_COLOR: "#ff7a1a",
  NEUTRAL_BG: "#f6f8fc",
  DISPLAY_FONT: "Fraunces",
  SERVICES: JSON.stringify([
    { title: "Leak Repair", desc: "Fast leak detection and repair." },
    { title: "Drain Cleaning", desc: "Clogs cleared the same day." },
    { title: "Water Heaters", desc: "Repair and installation." },
    { title: "Slab Leaks", desc: "Slab leak specialists." },
    { title: "Repiping", desc: "Whole-home repiping." },
    { title: "Emergency Plumbing", desc: "24/7 response." },
  ]),
  SERVICES_FULL: JSON.stringify([
    { slug: "leak-repair", title: "Leak Repair", short: "Fast leak detection", paras: ["Slab leaks found fast in Dallas.", "You approve the plan first."], bullets: ["Same-day visit", "Upfront quote"] },
    { slug: "drain-cleaning", title: "Drain Cleaning", short: "Clogs cleared same day", paras: ["Drains cleared in Dallas homes.", "No mess left behind."], bullets: ["Camera inspection", "Flat pricing"] },
    { slug: "water-heaters", title: "Water Heaters", short: "Repair and install", paras: ["Water heaters fixed in Dallas.", "Tank or tankless."], bullets: ["All brands", "Same-day install"] },
    { slug: "slab-leaks", title: "Slab Leaks", short: "Slab leak specialists", paras: ["Slab leaks stopped fast.", "Minimal demolition."], bullets: ["Electronic detection", "Insurance-friendly"] },
    { slug: "repiping", title: "Repiping", short: "Whole-home repiping", paras: ["Repiping done in days.", "PEX or copper."], bullets: ["Lifetime labor", "Clean walls patch"] },
    { slug: "emergency-plumbing", title: "Emergency Plumbing", short: "24/7 response", paras: ["Emergency calls answered.", "Trucks ready to roll."], bullets: ["Nights and weekends", "Fast dispatch"] },
  ]),
  ABOUT_SOURCE: "Family-owned plumbing company serving Dallas since day one.",
  AREAS: "Dallas, Plano, Garland",
};

// Gemini mock : echo une longue HTML contenant la formAction du prompt
const geminiOk = async (opts: { user: string }) => {
  const formAction = /FORM_ACTION.*?api\/site-form\/(\d+)/.exec(opts.user)?.[1] ?? "0";
  const page = `<!DOCTYPE html><html><head><title>Mock</title></head><body><p>${"x".repeat(9000)}</p><p>FORM ${formAction}</p></body></html>`;
  return page;
};

// 1. Gemini OK → engine gemini, bundle complet
{
  const r = await buildSiteBundle(sheet, 1952, geminiOk as never, (async () => new Response(JPEG_15K, { status: 200, headers: { "content-type": "image/jpeg" } })) as typeof fetch);
  const keys = Object.keys(r.bundle);
  check("bundle: index + aux + images", ["index.html", "vercel.json", "robots.txt", "sitemap.xml", "site.webmanifest", "favicon.svg", "privacy.html", "terms.html", "404.html", "images/hero.jpg", "images/about.jpg"].every((k) => keys.includes(k)));
  check("bundle: pages services >= 5", keys.filter((k) => k.startsWith("services/")).length >= 5);
  check("bundle: engine gemini", r.engine === "gemini");
  check("bundle: index = html stocké", r.bundle["index.html"] === r.html);
  check("bundle: prompt portait formAction (echo mock)", r.html.includes("FORM 1952"));
  check("bundle: TODO >= 4", r.todoList.length >= 4);
}

// 2. Gemini KO → fallback déterministe
{
  const r = await buildSiteBundle(sheet, 1952, (async () => null) as never, (async () => new Response(JPEG_15K, { status: 200, headers: { "content-type": "image/jpeg" } })) as typeof fetch);
  check("fallback: engine fallback", r.engine === "fallback");
  check("fallback: index conforme", r.html.includes("mobile-bar") && r.html.includes("api/site-form/1952") && r.html.includes("Positiflo"));
  check("fallback: hero local présent", r.html.includes("images/hero.jpg"));
  const cfg = buildSiteConfig({ ...sheet, FORM_ACTION: "https://gosite.digital/api/site-form/1952" }, 1952);
  check("fallback: sitemap cohérent config", r.bundle["sitemap.xml"].includes(`https://${cfg.domain.replace("https://", "")}/services/leak-repair`));
}

// 3. Images KO → slots null, dégradés CSS, TODO photo
{
  const r = await buildSiteBundle(sheet, 1952, (async () => null) as never, (async () => {
    throw new Error("down");
  }) as typeof fetch);
  check("img-down: hero null", !r.bundle["images/hero.jpg"]);
  check("img-down: fallback sans img src externe", !/<img[^>]+src="https?:\/\//.test(r.html));
  check("img-down: TODO contient photo", r.todoList.some((t) => /photo|image/i.test(t)));
}

process.exit(fail ? 1 : 0);
