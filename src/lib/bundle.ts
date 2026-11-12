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

/** Index de secours déterministe — utilisé quand Gemini échoue. Conforme v6 :
 *  tokens, data-reveal, 3 dividers, barre mobile, form API, zéro hotlink,
 *  zéro fait inventé (rating omis si absent, section testimonials omise). */
export function renderFallbackIndex(config: SiteConfig): string {
  const en = config.lang === "en";
  const heroImg = config.images.hero ? `<div class="hero-img" style="background-image:url('${config.images.hero}')"></div>` : `<div class="hero-img hero-plain"></div>`;
  const gallery = config.images.gallery.map((p, i) => `
      <div class="g-item" data-reveal><div class="g-photo${p ? "" : " g-plain"}" style="${p ? `background-image:url('${p}')` : ""}">${p ? `<img src="${p}" alt="${attr(config.name)} — job ${i + 1}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${config.images.about}'">` : ""}</div></div>`).join("");
  const services = config.services.map((s) => `
      <a class="s-card" href="/services/${s.slug}" data-reveal>
        <div class="s-icon"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.1 2.1-2-2 2.1-2.1z"/></svg></div>
        <h3>${esc(s.title)}</h3><p>${esc(s.short)}</p><span class="s-more">${en ? "Learn more" : "En savoir plus"} →</span>
      </a>`).join("");
  const faq: [string, string][] = en
    ? [["How much does it cost?", "Every job is quoted upfront after an honest assessment — you approve the price before we start."], ["Do you offer emergency service?", config.emergency247 ? "Yes — call anytime, we answer 24/7." : "Call us and we will fit you in as fast as possible, often the same day."], ["Do you warranty your work?", "Yes, workmanship is covered — the exact terms are on your invoice."], ["What payment methods do you take?", "Cards, checks and common digital payments — whatever is easiest for you."], ["Do I need a permit?", `For jobs that require one in ${config.city}, we handle the paperwork and inspection.`], ["Which areas do you serve?", config.areas.join(", ") + "."]]
    : [["Combien ça coûte ?", "Chaque chantier est chiffré à l'avance après une évaluation honnête — vous validez le prix avant le début."], ["Intervenez-vous en urgence ?", config.emergency247 ? "Oui — appelez à tout moment, nous répondons 24h/24." : "Appelez-nous, nous intervenons au plus vite, souvent le jour même."], ["Votre travail est-il garanti ?", "Oui, la main-d'œuvre est garantie — les termes exacts figurent sur votre facture."], ["Quels moyens de paiement acceptez-vous ?", "Cartes, chèques et paiements numériques courants."], ["Faut-il un permis ?", `Pour les travaux qui l'exigent à ${config.city}, nous gérons la paperasse et l'inspection.`], ["Quelles zones desservez-vous ?", config.areas.join(", ") + "."]];
  const faqHtml = faq.map(([q, a], i) => `
      <div class="faq-item" data-reveal><button type="button" class="faq-q" aria-expanded="${i === 0}"><span>${esc(q)}</span><span class="faq-x">+</span></button><div class="faq-a" ${i === 0 ? "" : 'hidden'}><p>${esc(a)}</p></div></div>`).join("");
  const faqLd = JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }).replace(/</g, "\\u003c");
  const googleBlock = config.rating !== null && config.reviewCount !== null
    ? `<section id="reviews" class="sec sec-light"><div class="wrap"><div class="g-card" data-reveal><div class="g-badge">G</div><div class="g-score"><span class="g-num">${config.rating}</span><span class="g-stars" aria-hidden="true">★★★★★</span><p>${config.reviewCount} ${en ? "verified public reviews on Google" : "avis publics vérifiés sur Google"}</p></div><a class="btn btn-ghost" href="${attr(config.mapUrl)}" target="_blank" rel="noopener">${en ? "See reviews on Google" : "Voir les avis sur Google"}</a></div></div></section>`
    : "";
  const why = en
    ? [["Upfront pricing", "You approve the quote before we start — no surprise line items."], ["On-time arrival", "We respect your schedule and call ahead if anything shifts."], ["Clean job site", "We leave your home as clean as we found it — drop cloths and cleanup included."], ["Local and responsive", `Based in ${config.city}, we answer the phone and follow up after the job.`]]
    : [["Prix annoncé", "Vous validez le devis avant le début — aucune ligne surprise."], ["Ponctualité", "Nous respectons votre agenda et prévenons si quoi que ce soit bouge."], ["Chantier propre", "Nous repartons chez vous aussi propre qu'en arrivant."], ["Local et joignable", `Basés à ${config.city}, nous répondons au téléphone et faisons le suivi après le chantier.`]];
  const whyHtml = why.map(([t, d]) => `<div class="w-card" data-reveal><h3>${esc(t)}</h3><p>${esc(d)}</p></div>`).join("");
  const steps = en ? ["Call or send the form", "Honest assessment + upfront quote", "Work done right, site cleaned", "Follow-up call to confirm"] : ["Appel ou formulaire", "Évaluation honnête + devis annoncé", "Travail bien fait, chantier propre", "Appel de suivi pour confirmer"];
  const stepsHtml = steps.map((s, i) => `<div class="p-step" data-reveal><div class="p-num">${i + 1}</div><p>${esc(s)}</p></div>`).join("<div class='p-line' aria-hidden='true'></div>");
  const topbar = config.emergency247
    ? `<div class="topbar">${en ? "24/7 Emergency Service · Call" : "Urgences 24h/24 · Appelez le"} <a href="tel:${attr(config.phoneLink)}">${esc(config.phone)}</a></div>`
    : config.hours ? `<div class="topbar">${esc(config.hours.weekday)}${config.hours.sat ? ` · ${esc(config.hours.sat)}` : ""} · ${en ? "Call" : "Appelez le"} <a href="tel:${attr(config.phoneLink)}">${esc(config.phone)}</a></div>` : "";
  const trust = `<section class="trustbar"><div class="wrap trust-in">${config.rating !== null && config.reviewCount !== null ? `<span><strong>${config.rating} ★</strong> · ${config.reviewCount} ${en ? "Google reviews" : "avis Google"}</span>` : ""}<span>${en ? "Residential & Commercial" : "Résidentiel & Commercial"}</span>${config.hours ? `<span>${esc(config.hours.weekday)}</span>` : ""}<span>${esc(config.city)}${config.areas.length > 1 ? ` + ${config.areas.length - 1} ${en ? "nearby cities" : "villes voisines"}` : ""}</span></div></section>`;
  const serviceOptions = config.services.map((s) => `<option>${esc(s.title)}</option>`).join("");
  const title = en ? `${config.name} | ${config.nicheLabel} in ${config.city}` : `${config.name} | ${config.nicheLabel} à ${config.city}`;
  const desc = en ? `${config.tagline} ${config.name} serves ${config.city} and nearby. Call ${config.phone}.` : `${config.tagline} ${config.name} intervient à ${config.city} et alentours. Appelez le ${config.phone}.`;
  const nav = [["services", en ? "Services" : "Services"], ["projects", en ? "Projects" : "Réalisations"], ["about", en ? "About" : "À propos"], ["faq", "FAQ"], ["contact", en ? "Contact" : "Contact"]];
  const navHtml = nav.map(([id, label]) => `<a href="#${id}">${label}</a>`).join("");

  return `<!DOCTYPE html>
<html lang="${config.lang}" dir="${config.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${attr(config.domain)}/">
<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${attr(config.domain)}/"><meta property="og:image" content="${attr(config.domain)}/images/hero.jpg">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${attr(config.domain)}/images/hero.jpg">
<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="manifest" href="/site.webmanifest">
<style>:root{--c-primary:${config.primaryColor};--c-accent:${config.accentColor};--c-neutral:${config.neutralBg};--radius-sm:6px;--radius-md:14px;--radius-lg:24px;--radius-pill:999px;--shadow-1:0 2px 8px rgba(10,20,40,.06);--shadow-2:0 8px 24px rgba(10,20,40,.12);--shadow-3:0 16px 48px rgba(10,20,40,.18)}
${SHARED_CSS}
.topbar{background:var(--c-primary);color:#fff;text-align:center;padding:8px 16px;font-size:.85rem}
.topbar a{color:var(--c-accent);font-weight:700}
#navbar{position:sticky;top:0;z-index:60;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-bottom:1px solid rgba(18,41,75,.08)}
.nav-in{max-width:1120px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.nav-links{display:flex;gap:22px;font-weight:600;font-size:.95rem}
.nav-links a:hover{color:var(--c-accent)}
.hero{position:relative;color:#fff;overflow:hidden}
.hero-img{position:absolute;inset:0;background-size:cover;background-position:center}
.hero-plain{background:linear-gradient(135deg,var(--c-primary),#1c3a6b)}
.hero-img::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,rgba(10,18,32,.82) 0%,rgba(10,18,32,.55) 55%,rgba(10,18,32,.25))}
.hero-in{position:relative;z-index:2;max-width:1120px;margin:0 auto;padding:96px 24px 110px}
.hero-tag{display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(8px);border-radius:var(--radius-pill);padding:6px 16px;font-size:.8rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:18px}
.hero h1{font-size:clamp(2.6rem,5.2vw,4.4rem);line-height:1.06;letter-spacing:-.02em;text-wrap:balance;max-width:14ch}
.hero h1 em{font-style:normal;color:var(--c-accent)}
.hero p{max-width:52ch;margin:18px 0 26px;font-size:clamp(1.05rem,1.4vw,1.2rem);color:rgba(255,255,255,.92)}
.hero-cta{display:flex;gap:14px;flex-wrap:wrap}
.hero-chips{display:flex;gap:10px;flex-wrap:wrap;margin-top:26px}
.chip{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(8px);border-radius:var(--radius-pill);padding:8px 16px;font-size:.8rem;font-weight:600}
.sec{padding:clamp(64px,9vw,100px) 0}
.wrap{max-width:1120px;margin:0 auto;padding:0 24px}
.sec h2{font-size:clamp(1.9rem,3.4vw,3rem);color:var(--c-primary);text-wrap:balance;margin-bottom:8px}
.sec .kicker{color:var(--c-accent);font-weight:700;font-size:.8rem;letter-spacing:.08em;text-transform:uppercase}
.s-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:36px}
.s-card{background:#fff;border:1px solid rgba(18,41,75,.08);border-radius:var(--radius-md);padding:26px;box-shadow:var(--shadow-1);transition:transform .2s ease,box-shadow .2s ease,border-color .2s ease}
.s-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-2);border-color:var(--c-accent)}
.s-icon{width:52px;height:52px;border-radius:var(--radius-md);background:var(--c-neutral);color:var(--c-accent);display:flex;align-items:center;justify-content:center;margin-bottom:14px}
.s-card h3{font-size:1.15rem;color:var(--c-primary)}
.s-card p{color:#5a6b7d;font-size:.95rem;margin:8px 0 12px}
.s-more{color:var(--c-accent);font-weight:700;font-size:.9rem}
.trustbar{background:var(--c-primary);color:#fff;padding:18px 0}
.trust-in{display:flex;gap:28px;flex-wrap:wrap;justify-content:center;font-size:.92rem}
.trust-in strong{color:var(--c-accent)}
.w-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:36px}
.w-card{background:#fff;border:1px solid rgba(18,41,75,.08);border-radius:var(--radius-md);padding:24px;box-shadow:var(--shadow-1)}
.w-card h3{font-size:1.05rem;color:var(--c-primary);margin-bottom:6px}
.w-card p{color:#5a6b7d;font-size:.92rem}
.p-flow{display:grid;grid-template-columns:repeat(4,1fr) auto;align-items:center;gap:10px;margin-top:36px}
.p-step{background:#fff;border:1px solid rgba(18,41,75,.08);border-radius:var(--radius-md);padding:20px;box-shadow:var(--shadow-1);text-align:center;font-size:.92rem;font-weight:600;color:var(--c-primary)}
.p-num{width:34px;height:34px;border-radius:var(--radius-pill);background:var(--c-accent);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 10px}
.p-line{width:100%;height:2px;background:linear-gradient(90deg,var(--c-accent),rgba(255,122,26,.15))}
.g-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:36px}
.g-item{border-radius:var(--radius-md);overflow:hidden;box-shadow:var(--shadow-1)}
.g-photo{aspect-ratio:4/3;background-size:cover;background-position:center;position:relative}
.g-photo img{width:100%;height:100%;object-fit:cover}
.g-plain,.hero-plain{background:linear-gradient(135deg,var(--c-primary),var(--c-accent));opacity:.92}
.g-card{display:flex;align-items:center;gap:28px;flex-wrap:wrap;background:#fff;border:1px solid rgba(18,41,75,.08);border-radius:var(--radius-lg);padding:34px;box-shadow:var(--shadow-2)}
.g-badge{width:52px;height:52px;border-radius:var(--radius-pill);background:#4285F4;color:#fff;font-weight:800;font-size:1.6rem;display:flex;align-items:center;justify-content:center}
.g-stars{color:#FBBC04;font-size:1.3rem;letter-spacing:.15em}
.g-num{font-size:2.6rem;font-weight:800;color:var(--c-primary);margin-right:10px}
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:36px;align-items:center;margin-top:36px}
.about-photo{aspect-ratio:4/5;border-radius:var(--radius-lg);background-size:cover;background-position:center;box-shadow:var(--shadow-2);background-image:url('${config.images.about}')}
.about-photo img{width:100%;height:100%;object-fit:cover;border-radius:var(--radius-lg)}
.faq-item{background:#fff;border:1px solid rgba(18,41,75,.08);border-radius:var(--radius-md);margin-bottom:10px;overflow:hidden}
.faq-q{width:100%;background:none;border:0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:18px 22px;font:inherit;font-weight:700;color:var(--c-primary);text-align:left;min-height:44px}
.faq-a{padding:0 22px 18px;color:#5a6b7d}
.contact-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:36px;align-items:stretch}
.c-form{background:#fff;border:1px solid rgba(18,41,75,.08);border-radius:var(--radius-lg);padding:30px;box-shadow:var(--shadow-2);display:flex;flex-direction:column;gap:14px}
.c-form label{font-size:.85rem;font-weight:700;color:var(--c-primary)}
.c-form input,.c-form select,.c-form textarea{width:100%;padding:12px 14px;border:1.5px solid rgba(18,41,75,.16);border-radius:var(--radius-sm);font:inherit;font-size:16px;background:#fff}
.c-form input:focus,.c-form select:focus,.c-form textarea:focus{outline:3px solid var(--c-accent);outline-offset:1px;border-color:var(--c-accent)}
.c-form input:-webkit-autofill{box-shadow:0 0 0 40px #fff inset}
.c-info{background:var(--c-primary);color:#fff;border-radius:var(--radius-lg);padding:30px;display:flex;flex-direction:column;gap:14px}
.c-info a{color:var(--c-accent);font-weight:700}
.c-map{border-radius:var(--radius-md);overflow:hidden;min-height:200px}
.c-map iframe{width:100%;height:100%;min-height:200px;border:0}
.hp{position:absolute;left:-9999px;opacity:0;tabindex:-1}
.consent{display:flex;gap:10px;align-items:flex-start;font-size:.85rem;color:#5a6b7d}
.f-msg{display:none;border-radius:var(--radius-sm);padding:12px 14px;font-size:.9rem}
.f-ok{display:none;background:#e7f6ec;color:#136c34;border-radius:var(--radius-sm);padding:12px 14px;font-size:.9rem}
.footer{background:var(--c-primary);color:#fff;padding:52px 0 90px;margin-top:0}
.footer a{color:rgba(255,255,255,.85)}
.footer a:hover{color:var(--c-accent)}
.foot-grid{display:grid;grid-template-columns:1.4fr 1fr 1.2fr;gap:32px}
.foot-bar2{margin-top:32px;padding-top:16px;border-top:1px solid rgba(255,255,255,.14);font-size:.85rem;color:rgba(255,255,255,.65)}
.section-divider{display:block;width:100%;height:clamp(48px,7vw,90px);margin-top:-1px;pointer-events:none}
.mobile-bar{position:fixed;left:0;right:0;bottom:0;z-index:90;display:none;grid-template-columns:1fr 1fr;gap:1px;background:var(--c-accent);padding-bottom:env(safe-area-inset-bottom)}
.mobile-bar a{display:flex;align-items:center;justify-content:center;min-height:56px;font-weight:800;color:#fff;text-decoration:none}
.mobile-bar .mb-quote{background:var(--c-primary)}
[data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1)}
[data-reveal].in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){[data-reveal]{opacity:1;transform:none;transition:none}}
@media(max-width:900px){.w-grid{grid-template-columns:repeat(2,1fr)}.about-grid,.contact-grid{grid-template-columns:1fr}.foot-grid{grid-template-columns:1fr}}
@media(max-width:768px){.s-grid{grid-template-columns:repeat(2,1fr)}.g-grid{grid-template-columns:repeat(2,1fr)}.p-flow{grid-template-columns:1fr}.p-line{display:none}.nav-links{display:none}.mobile-bar{display:grid}.sec{padding:56px 0}}
@media(max-width:480px){.s-grid,.g-grid{grid-template-columns:1fr}}
</style>
<script type="application/ld+json">${ldBusiness(config)}</script>
<script type="application/ld+json">${faqLd}</script>
</head>
<body>
${topbar}
<nav id="navbar" aria-label="Main"><div class="nav-in">
<a class="logo" href="${attr(config.domain)}/"><span class="logo-dot">${esc(initials(config.name))}</span>${esc(config.name)}</a>
<div class="nav-links">${navHtml}</div>
<a class="btn btn-accent" href="tel:${attr(config.phoneLink)}">${en ? "Call Now" : "Appeler"}</a>
</div></nav>
<header class="hero">
${heroImg}
<div class="hero-in">
<span class="hero-tag">${en ? "Top Rated Local Service" : "Service local bien noté"}</span>
<h1>${esc(config.tagline.split(" ").slice(0, -2).join(" "))} <em>${esc(config.tagline.split(" ").slice(-2).join(" "))}</em></h1>
<p>${esc(en ? `${config.name} handles ${config.services[0]?.title.toLowerCase() ?? "the job"} and everything around it across ${config.city} — upfront pricing, clean work, no drama.` : `${config.name} assure ${config.services[0]?.title.toLowerCase() ?? "le chantier"} et tout ce qui l'entoure à ${config.city} — prix annoncé, chantier propre, sans stress.`)}</p>
<div class="hero-cta"><a class="btn btn-accent" href="tel:${attr(config.phoneLink)}">${en ? "Call Now" : "Appeler"} — ${esc(config.phone)}</a><a class="btn btn-ghost" href="#contact" style="border-color:rgba(255,255,255,.4);color:#fff">${en ? "Get a Free Quote" : "Devis gratuit"}</a></div>
<div class="hero-chips"><span class="chip">${en ? "Upfront Pricing" : "Prix annoncé"}</span><span class="chip">${en ? "Same-Day Service" : "Service rapide"}</span><span class="chip">${en ? "Residential & Commercial" : "Résidentiel & Commercial"}</span></div>
</div>
</header>
${trust}
<section id="services" class="sec"><div class="wrap"><span class="kicker">${en ? "Services" : "Services"}</span><h2>${en ? "What we handle" : "Ce que nous prenons en charge"}</h2><div class="s-grid">${services}</div></div></section>
<svg class="section-divider" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0,64 C360,10 1080,10 1440,64 L1440,90 L0,90 Z" fill="#12294b"/></svg>
<section class="sec" style="background:var(--c-primary);color:#fff"><div class="wrap"><span class="kicker" style="color:var(--c-accent)">${en ? "Why choose us" : "Pourquoi nous choisir"}</span><h2 style="color:#fff">${en ? "The four things we never compromise" : "Les quatre choses non négociables"}</h2><div class="w-grid">${whyHtml}</div><div class="p-flow">${stepsHtml}</div></div></section>
<svg class="section-divider" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0,0 L1440,0 L1440,26 C1080,80 360,80 0,26 Z" fill="#12294b"/></svg>
<section id="projects" class="sec sec-light"><div class="wrap"><span class="kicker">${en ? "Projects" : "Réalisations"}</span><h2>${en ? "Recent work around " : "Chantiers récents autour de "}${esc(config.city)}</h2><div class="g-grid">${gallery}</div></div></section>
${googleBlock ? `<svg class="section-divider" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0,64 C360,10 1080,10 1440,64 L1440,90 L0,90 Z" fill="${config.neutralBg}"/></svg>${googleBlock}` : ""}
<section id="area" class="sec"><div class="wrap"><span class="kicker">${en ? "Service area" : "Zone d'intervention"}</span><h2>${en ? "Proudly serving" : "Fièrement au service de"}</h2><p class="muted" style="font-size:1.1rem">${esc(config.areas.join(" · "))}</p></div></section>
<section id="about" class="sec sec-light"><div class="wrap"><div class="about-grid"><div><span class="kicker">${en ? "About" : "À propos"}</span><h2>${esc(config.name)}</h2><p>${esc(en ? `${config.name} is a ${config.nicheLabel.toLowerCase()} business serving ${config.city} and the surrounding area. Every job starts with an honest assessment and a price you approve before we start.` : `${config.name} est une entreprise de ${config.nicheLabel.toLowerCase()} au service de ${config.city} et des environs. Chaque chantier commence par une évaluation honnête et un prix que vous validez avant le début.`)}</p><p>${esc(en ? "We answer the phone, show up when we say we will, and clean up before we leave. That is the whole secret." : "Nous répondons au téléphone, nous arrivons à l'heure et nous nettoyons avant de partir. Tout le secret est là.")}</p></div><div class="about-photo">${config.images.about ? `<img src="${config.images.about}" alt="${attr(config.name)} team at work in ${attr(config.city)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='images/about.jpg'">` : ""}</div></div></div></section>
<section id="faq" class="sec"><div class="wrap"><span class="kicker">FAQ</span><h2>${en ? "Questions people actually ask" : "Les questions qu'on nous pose vraiment"}</h2><div style="margin-top:28px">${faqHtml}</div></div></section>
<svg class="section-divider" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true"><path d="M0,64 C360,10 1080,10 1440,64 L1440,90 L0,90 Z" fill="var(--c-primary)"/></svg>
<section id="contact" class="sec" style="background:var(--c-primary);color:#fff"><div class="wrap"><span class="kicker" style="color:var(--c-accent)">${en ? "Contact" : "Contact"}</span><h2 style="color:#fff">${en ? "Tell us what you need" : "Dites-nous ce qu'il vous faut"}</h2>
<div class="contact-grid">
<form class="c-form" action="${attr(config.formAction)}" method="POST" id="quote-form" style="color:var(--c-primary)">
<input type="text" name="website" class="hp" aria-hidden="true" autocomplete="off">
<label for="f-name">${en ? "Name *" : "Nom *"}</label><input id="f-name" name="name" required minlength="2" autocomplete="name">
<label for="f-phone">${en ? "Phone *" : "Téléphone *"}</label><input id="f-phone" name="phone" type="tel" required autocomplete="tel">
<label for="f-email">${en ? "Email" : "Email"}</label><input id="f-email" name="email" type="email" autocomplete="email">
<label for="f-zip">${en ? "ZIP code *" : "Code postal *"}</label><input id="f-zip" name="zip" required autocomplete="postal-code">
<label for="f-service">${en ? "Service needed *" : "Service demandé *"}</label><select id="f-service" name="service" required>${serviceOptions}</select>
<label for="f-msg">${en ? "Message *" : "Message *"}</label><textarea id="f-msg" name="message" rows="4" required minlength="10" autocomplete="off"></textarea>
<label class="consent"><input type="checkbox" name="consent" required> ${en ? "I agree to be contacted about my request." : "J'accepte d'être contacté au sujet de ma demande."}</label>
<p class="f-msg" id="f-err" style="background:#fdecea;color:#a33"></p>
<p class="f-ok" id="f-ok">${en ? "Thanks! We'll call you back during business hours." : "Merci ! Nous vous rappelons pendant les horaires d'ouverture."}</p>
<button class="btn btn-accent" type="submit" id="f-send" style="justify-content:center">${en ? "Send Request" : "Envoyer la demande"}</button>
</form>
<div class="c-info">
<h3 style="font-size:1.2rem">${esc(config.name)}</h3>
<p>${esc(config.address)}<br>${esc(config.city)} ${esc(config.zip)}</p>
<p><a href="tel:${attr(config.phoneLink)}">${esc(config.phone)}</a>${config.email ? `<br><a href="mailto:${attr(config.email)}">${esc(config.email)}</a>` : ""}</p>
${config.hours ? `<p>${esc(config.hours.weekday)}${config.hours.sat ? `<br>${esc(config.hours.sat)}` : ""}<br>${esc(config.hours.sun)}</p>` : ""}
<div class="c-map">${config.mapEmbed ? `<iframe src="${attr(config.mapEmbed)}" loading="lazy" title="${attr(config.name)} location" referrerpolicy="no-referrer-when-downgrade"></iframe>` : ""}<a href="${attr(config.mapUrl)}" target="_blank" rel="noopener" class="btn btn-ghost" style="margin-top:10px;border-color:rgba(255,255,255,.4);color:#fff">${en ? "Open in Google Maps" : "Ouvrir dans Google Maps"}</a></div>
</div>
</div></div></section>
<footer class="footer"><div class="wrap"><div class="foot-grid">
<div><span class="logo" style="color:#fff"><span class="logo-dot" style="background:var(--c-accent)">${esc(initials(config.name))}</span>${esc(config.name)}</span><p style="color:rgba(255,255,255,.8);margin-top:10px;max-width:40ch">${esc(desc)}</p></div>
<div><strong>${en ? "Explore" : "Explorer"}</strong><br><a href="#services">${en ? "Services" : "Services"}</a><br><a href="#projects">${en ? "Projects" : "Réalisations"}</a><br><a href="#faq">FAQ</a><br><a href="/privacy">${en ? "Privacy Policy" : "Politique de confidentialité"}</a><br><a href="/terms">${en ? "Terms of Service" : "Conditions d'utilisation"}</a></div>
<div><strong>${en ? "Contact" : "Contact"}</strong><br><a href="tel:${attr(config.phoneLink)}">${esc(config.phone)}</a>${config.email ? `<br><a href="mailto:${attr(config.email)}">${esc(config.email)}</a>` : ""}<br>${esc(config.city)} ${esc(config.zip)}${config.hours ? `<br>${esc(config.hours.weekday)}` : ""}</div>
</div><div class="foot-bar2">© ${config.year} ${esc(config.name)}. ${en ? "All rights reserved." : "Tous droits réservés."}</div></div></footer>
<div class="mobile-bar"><a href="tel:${attr(config.phoneLink)}">${en ? "Call Now" : "Appeler"}</a><a class="mb-quote" href="#contact">${en ? "Get Quote" : "Devis"}</a></div>
<script>
(function(){
"use strict";
var reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var io="IntersectionObserver" in window&&!reduce?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}})},{threshold:.12}):null;
document.querySelectorAll("[data-reveal]").forEach(function(el){io?io.observe(el):el.classList.add("in")});
var nb=document.getElementById("navbar"),last=0;
window.addEventListener("scroll",function(){var y=window.scrollY;if(y>80)nb.style.boxShadow="var(--shadow-2)";else nb.style.boxShadow="none";last=y;},{passive:true});
document.querySelectorAll(".faq-q").forEach(function(btn){btn.addEventListener("click",function(){var open=btn.getAttribute("aria-expanded")==="true";document.querySelectorAll(".faq-q").forEach(function(b){b.setAttribute("aria-expanded","false");b.nextElementSibling.hidden=true;});if(!open){btn.setAttribute("aria-expanded","true");btn.nextElementSibling.hidden=false;}});});
var form=document.getElementById("quote-form");
if(form){form.addEventListener("submit",function(ev){ev.preventDefault();
var err=document.getElementById("f-err"),ok=document.getElementById("f-ok");err.style.display="none";ok.style.display="none";
var d=new FormData(form);
if(String(d.get("website")||"")){ok.style.display="block";form.reset();return;}
if(String(d.get("name")||"").trim().length<2||String(d.get("message")||"").trim().length<10||!d.get("consent")){err.textContent="${en ? "Please fill in the required fields." : "Merci de remplir les champs requis."}";err.style.display="block";return;}
var send=document.getElementById("f-send");send.disabled=true;send.textContent="${en ? "Sending…" : "Envoi…"}";
fetch(form.action,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({name:d.get("name"),phone:d.get("phone"),email:d.get("email"),zip:d.get("zip"),service:d.get("service"),message:d.get("message"),consent:true,website:d.get("website")})}).then(function(r){return r.json()}).then(function(j){if(j.ok){ok.style.display="block";form.reset();}else{err.textContent=(j.errors&&j.errors[0])||"${en ? "Something went wrong — call us instead." : "Une erreur est survenue — appelez-nous."}";err.style.display="block";}}).catch(function(){err.textContent="${en ? "Network error — please call us." : "Erreur réseau — appelez-nous."}";err.style.display="block";}).finally(function(){send.disabled=false;send.textContent="${en ? "Send Request" : "Envoyer la demande"}";});
});}
})();
</script>
</body>
</html>`;
}

/** Checklist client dérivée de la config — injectée dans l'email de livraison.
 *  Jamais un fait inventé : chaque item = une donnée manquante à fournir. */export function generateTodoList(config: SiteConfig): string[] {
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
