// Bundle v6 — pages auxiliaires déterministes rendues depuis SiteConfig.
// Gemini ne génère QUE index.html ; tout le reste (privacy, terms, 404,
// sitemap, robots, manifest, favicon, vercel.json, pages /services) est rendu
// ici : cohérence garantie, zéro fait inventé, zéro hotlink. Module PUR.

import type { SiteConfig, SiteService } from "./site-config";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const attr = (s: string): string => esc(s).replace(/&#39;/g, "%27");

export const SHARED_CSS = `
:root{--primary:${"var(--c-primary)"};--accent:${"var(--c-accent)"};--radius-sm:6px;--radius-md:14px;--radius-lg:24px;--radius-pill:999px;--shadow-1:0 2px 8px rgba(10,20,40,.06);--shadow-2:0 8px 24px rgba(10,20,40,.12);--shadow-3:0 16px 48px rgba(10,20,40,.18)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Inter,system-ui,sans-serif;font-size:1.05rem;line-height:1.7;color:#1c2733;background:#fff;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
img{max-width:100%;height:auto;display:block}
.page{max-width:860px;margin:0 auto;padding:48px 24px 80px}
.page h1{font-size:clamp(1.9rem,3.4vw,3rem);line-height:1.15;letter-spacing:-.02em;color:#12294b;text-wrap:balance}
.page h2{font-size:clamp(1.25rem,2vw,1.6rem);color:#12294b;margin:32px 0 10px}
.page p,.page li{max-width:68ch}
.page ul{padding-left:22px;margin:12px 0}
.page p{margin:12px 0}
.muted{color:#5a6b7d}
.top{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(18,41,75,.08)}
.top-in{max-width:1120px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{display:flex;align-items:center;gap:10px;font-weight:800;color:#12294b;letter-spacing:-.01em}
.logo-dot{width:30px;height:30px;border-radius:8px;background:var(--c-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800}
.btn{display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:var(--radius-pill);font-weight:700;font-size:.95rem;transition:transform .2s ease,box-shadow .2s ease;min-height:44px}
.btn-accent{background:var(--c-accent);color:#fff;box-shadow:var(--shadow-1)}
.btn-accent:hover{transform:translateY(-2px);box-shadow:var(--shadow-2)}
.btn-ghost{border:1.5px solid rgba(18,41,75,.25);color:#12294b}
.btn-ghost:hover{border-color:var(--c-accent);color:var(--c-accent)}
.foot{background:var(--c-primary);color:#fff;margin-top:64px;padding:48px 24px 32px}
.foot-in{max-width:1120px;margin:0 auto;display:grid;gap:24px}
.foot a{color:rgba(255,255,255,.85)}
.foot a:hover{color:var(--c-accent)}
.foot-bar{max-width:1120px;margin:32px auto 0;padding-top:16px;border-top:1px solid rgba(255,255,255,.14);font-size:.85rem;color:rgba(255,255,255,.65)}
.legal-toc{background:#f6f8fc;border:1px solid rgba(18,41,75,.08);border-radius:var(--radius-md);padding:18px 22px;margin:20px 0}
.legal-toc a{color:#1553b8}
:focus-visible{outline:3px solid var(--c-accent);outline-offset:2px;border-radius:4px}
@media(max-width:640px){.page{padding:32px 18px 64px}.foot{padding:36px 18px 24px}}
`;

function ldBusiness(config: SiteConfig): string {
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": config.schemaType,
    name: config.name,
    telephone: config.phone,
    email: config.email ?? undefined,
    url: `${config.domain}/`,
    address: { "@type": "PostalAddress", streetAddress: config.address, addressLocality: config.city, postalCode: config.zip, addressCountry: localeCountry(config.country) },
    areaServed: config.areas,
    openingHoursSpecification: config.hours ? hoursSpec(config) : undefined,
    sameAs: [config.socials.instagram, config.socials.facebook].filter(Boolean),
    ...(config.lat !== null && config.lng !== null ? { geo: { "@type": "GeoCoordinates", latitude: config.lat, longitude: config.lng } } : {}),
    ...(config.rating !== null && config.reviewCount !== null ? { aggregateRating: { "@type": "AggregateRating", ratingValue: config.rating, reviewCount: config.reviewCount } } : {}),
  };
  Object.keys(ld).forEach((k) => ld[k] === undefined && delete ld[k]);
  return JSON.stringify(ld).replace(/</g, "\\u003c");
}

function localeCountry(country: string): string {
  const c = country.toLowerCase();
  if (c.includes("united states") || c.includes("usa")) return "US";
  if (c.includes("canada")) return "CA";
  if (c.includes("united kingdom") || c.includes("uk")) return "GB";
  return "FR";
}

function hoursSpec(config: SiteConfig): Record<string, unknown>[] {
  const spec = (days: string[], t: string): { "@type": string; dayOfWeek: string[]; opens: string; closes: string } | null => {
    const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(?:am|pm|a\.m|A\.M|AM|PM)?\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?/);
    if (!m) return null;
    return { "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: m[1].padStart(2, "0") + ":" + (m[2] ?? "00"), closes: m[3].padStart(2, "0") + ":" + (m[4] ?? "00") };
  };
  const weekday = spec(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], config.hours?.weekday ?? "");
  const sat = spec(["Saturday"], config.hours?.sat ?? "");
  return [weekday, sat].filter(Boolean) as Record<string, unknown>[];
}

function pageChrome(config: SiteConfig, path: string, title: string, desc: string, bodyHtml: string, faqLd = ""): string {
  const url = `${config.domain}${path}`;
  return `<!DOCTYPE html>
<html lang="${config.lang}" dir="${config.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${attr(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${attr(url)}">
<meta property="og:image" content="${attr(config.domain)}/images/hero.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${attr(config.domain)}/images/hero.jpg">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="manifest" href="/site.webmanifest">
<style>:root{--c-primary:${config.primaryColor};--c-accent:${config.accentColor};--c-neutral:${config.neutralBg}}${SHARED_CSS}</style>
<script type="application/ld+json">${ldBusiness(config)}</script>
${faqLd ? `<script type="application/ld+json">${faqLd}</script>` : ""}
</head>
<body>
<header class="top"><div class="top-in">
<a class="logo" href="${attr(config.domain)}/"><span class="logo-dot">${esc(initials(config.name))}</span>${esc(config.name)}</a>
<a class="btn btn-accent" href="tel:${attr(config.phoneLink)}">Call Now</a>
</div></header>
<main class="page">
${bodyHtml}
</main>
<footer class="foot"><div class="foot-in">
<div><strong>${esc(config.name)}</strong><br>${esc(config.address)}, ${esc(config.city)} ${esc(config.zip)}<br><a href="tel:${attr(config.phoneLink)}">${esc(config.phone)}</a>${config.email ? ` · <a href="mailto:${attr(config.email)}">${esc(config.email)}</a>` : ""}</div>
<div><a href="${attr(config.domain)}/">Home</a> · <a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a>${config.hours ? `<br>${esc(config.hours.weekday)}${config.hours.sat ? ` · ${esc(config.hours.sat)}` : ""}` : ""}</div>
</div>
<div class="foot-bar">© ${config.year} ${esc(config.name)}. All rights reserved.</div>
</footer>
</body>
</html>`;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "GO";
}

const LEGAL_COMMON = (config: SiteConfig) => ({
  company: `${esc(config.name)} — ${esc(config.address)}, ${esc(config.city)} ${esc(config.zip)}, ${esc(config.country)}`,
  phone: esc(config.phone),
  email: config.email ? esc(config.email) : "",
  year: String(config.year),
});

function renderPrivacy(config: SiteConfig): string {
  const L = LEGAL_COMMON(config);
  const isEu = config.country.toLowerCase().includes("france") || config.country.toLowerCase().includes("europe");
  const body = `
<h1>Privacy Policy</h1>
<p class="muted">Last updated: ${config.year}</p>
<p>${L.company} ("we", "us") operates this website. This page explains exactly what data we collect and what happens to it. We collect the minimum needed to answer your request — nothing more.</p>
<h2>1. What we collect</h2>
<p>Only what you type into the contact form: your name, phone number, email address (optional), ZIP code, the service you need, and your message. We do not run analytics, advertising trackers or cookies on this site.</p>
<h2>2. Why we collect it</h2>
<p>To call or email you back about your request, and to schedule the work you asked about. That is the only purpose.</p>
<h2>3. Where it goes</h2>
<p>Your form submission is delivered to us by email through our website platform. It is stored in our records for up to 12 months, then deleted. We never sell or rent your information.</p>
<h2>4. Your rights</h2>
<p>${isEu ? "Under the GDPR you may request access to, correction of, or deletion of your personal data at any time." : "Depending on your state, you may request access to, correction of, or deletion of your personal data."} Write to us${L.email ? ` at ${L.email}` : ""} or call ${L.phone}.</p>
<h2>5. Children</h2>
<p>This site is not directed at children under 13 and we do not knowingly collect their data.</p>
<h2>6. Changes</h2>
<p>If this policy changes, the updated version will be posted on this page.</p>
<h2>7. Contact</h2>
<p>${L.company}<br>Phone: ${L.phone}${L.email ? `<br>Email: ${L.email}` : ""}</p>`;
  return pageChrome(config, "/privacy", `Privacy Policy — ${config.name}`, `How ${config.name} handles the information you send through the contact form.`, body);
}

function renderTerms(config: SiteConfig): string {
  const L = LEGAL_COMMON(config);
  const body = `
<h1>Terms of Service</h1>
<p class="muted">Last updated: ${config.year}</p>
<h2>1. Who we are</h2>
<p>${L.company}. By using this website you agree to these terms.</p>
<h2>2. Quotes and work</h2>
<p>Anything shown on this site, including prices or timeframes, is an estimate. The binding quote is the one we give you directly, in writing or by phone, after assessing the actual job.</p>
<h2>3. Appointments</h2>
<p>Appointment windows are best-effort. In an emergency we triage calls in the order they arrive.</p>
<h2>4. Payment</h2>
<p>Payment is due when the work is completed unless a different arrangement was agreed in writing.</p>
<h2>5. Warranty and liability</h2>
<p>Workmanship is covered as stated on your invoice. We are not liable for damage caused by third-party work, misuse, or circumstances beyond our control. Nothing here limits liability that cannot be limited by law.</p>
<h2>6. Website content</h2>
<p>Text and images on this site belong to ${esc(config.name)}. Do not reuse them without written permission.</p>
<h2>7. Governing law</h2>
<p>These terms are governed by the laws applicable in ${esc(config.city)}, ${esc(config.country)}.</p>
<h2>8. Contact</h2>
<p>Phone: ${L.phone}${L.email ? `<br>Email: ${L.email}` : ""}</p>`;
  return pageChrome(config, "/terms", `Terms of Service — ${config.name}`, `Terms under which ${config.name} provides services and operates this website.`, body);
}

function render404(config: SiteConfig): string {
  const body = `
<h1>Page not found</h1>
<p>The page you are looking for moved or never existed. Everything you need is on the home page.</p>
<p style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px">
<a class="btn btn-accent" href="${attr(config.domain)}/">Back to home</a>
<a class="btn btn-ghost" href="tel:${attr(config.phoneLink)}">Call ${esc(config.phone)}</a>
</p>`;
  return pageChrome(config, "/404.html", `Page not found — ${config.name}`, "This page does not exist. Head back to the home page.", body);
}

function renderServicePage(config: SiteConfig, s: SiteService): string {
  const path = `/services/${s.slug}`;
  const bullets = s.bullets.length
    ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
    : "";
  const body = `
<h1>${esc(s.title)} in ${esc(config.city)}</h1>
<p class="muted">${esc(config.name)} · ${esc(config.phone)}</p>
${s.paras.map((p) => `<p>${esc(p)}</p>`).join("")}
${bullets}
<h2>What you can expect</h2>
<p>We arrive on time, assess the job honestly, and give you a clear price before we start. If something changes mid-job, you hear it from us first — never from the invoice.</p>
<p>Need it handled now? Call ${esc(config.phone)} or send the form on our home page. We serve ${esc(config.areas.join(", "))}.</p>
<p style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px">
<a class="btn btn-accent" href="tel:${attr(config.phoneLink)}">Call Now — ${esc(config.phone)}</a>
<a class="btn btn-ghost" href="${attr(config.domain)}/#contact">Get a Free Quote</a>
</p>`;
  return pageChrome(config, path, `${s.title} in ${config.city} — ${config.name}`, `${s.short} ${config.name} serves ${config.city} and nearby. Call ${config.phone}.`, body);
}

function renderSitemap(config: SiteConfig, services: SiteService[]): string {
  const loc = (p: string) => `  <url><loc>${attr(config.domain)}${p}</loc></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${loc("/")}
${services.map((s) => loc(`/services/${s.slug}`)).join("\n")}
${loc("/privacy")}
${loc("/terms")}
</urlset>`;
}

function renderRobots(config: SiteConfig): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${config.domain}/sitemap.xml\n`;
}

function renderManifest(config: SiteConfig): string {
  return JSON.stringify({ name: config.name, short_name: config.name, start_url: `${config.domain}/`, display: "standalone", background_color: config.neutralBg, theme_color: config.primaryColor, icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }] }, null, 2);
}

function renderFavicon(config: SiteConfig): string {
  const ini = initials(config.name);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${config.primaryColor}"/><text x="32" y="42" font-family="Arial,sans-serif" font-size="28" font-weight="800" text-anchor="middle" fill="#fff">${esc(ini)}</text></svg>`;
}

const VERCEL_JSON = JSON.stringify({ cleanUrls: true }, null, 2) + "\n";

export function renderAuxPages(config: SiteConfig): Record<string, string> {
  const out: Record<string, string> = {
    "privacy.html": renderPrivacy(config),
    "terms.html": renderTerms(config),
    "404.html": render404(config),
    "sitemap.xml": renderSitemap(config, config.services),
    "robots.txt": renderRobots(config),
    "site.webmanifest": renderManifest(config),
    "favicon.svg": renderFavicon(config),
    "vercel.json": VERCEL_JSON,
  };
  for (const s of config.services) out[`services/${s.slug}.html`] = renderServicePage(config, s);
  return out;
}

/** Remplace la base (ancien domaine) dans les URLs absolues de l'index —
 *  utilisé quand un domaine custom est lié après le build. */
export function patchIndexDomain(html: string, fromBase: string, toBase: string): string {
  if (!fromBase || !toBase || fromBase === toBase) return html;
  const rx = new RegExp(fromBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  return html.replace(rx, toBase);
}

/** Checklist client dérivée de la config — injectée dans l'email de livraison.
 *  Jamais un fait inventé : chaque item = une donnée manquante à fournir. */
export function generateTodoList(config: SiteConfig): string[] {
  const en = config.lang === "en";
  const todo: string[] = [];
  const photos = 1 + 1 + config.images.gallery.length;
  todo.push(en ? `Replace the ${photos} placeholder photos (hero, about, gallery) with your own job photos — send them and we swap them the same day.` : `Remplacez les ${photos} photos génériques (héros, about, galerie) par vos propres photos de chantier — envoyez-les et nous les intégrons le jour même.`);
  if (!config.hours || !/24/.test(config.hours.weekday)) todo.push(en ? "Confirm your opening hours and emergency policy (currently shown from your Google listing)." : "Confirmez vos horaires et votre politique d'urgence (actuellement issus de votre fiche Google).");
  todo.push(en ? "Send your license number and insurance certificate to display them on the trust bar." : "Envoyez votre numéro de licence et votre attestation d'assurance pour les afficher dans la barre de confiance.");
  if (config.rating === null) todo.push(en ? "No Google rating found — send your Google Business Profile URL so we can show real reviews." : "Aucune note Google trouvée — envoyez l'URL de votre fiche Google Business pour afficher vos vrais avis.");
  else todo.push(en ? "Send 3 short customer reviews (or your Google Business Profile URL) to feature real testimonials." : "Envoyez 3 courts avis clients (ou l'URL de votre fiche Google) pour afficher de vrais témoignages.");
  todo.push(en ? "Optional: your logo files (SVG/PNG) to replace the generated monogram favicon." : "Optionnel : vos fichiers logo (SVG/PNG) pour remplacer le favicon monogramme généré.");
  todo.push(en ? "Optional: add Cloudflare Turnstile to the form for extra spam protection." : "Optionnel : ajouter Cloudflare Turnstile au formulaire pour une protection anti-spam renforcée.");
  return todo;
}
