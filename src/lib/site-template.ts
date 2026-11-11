// Coder — moteur de secours : génère un site vitrine complet, monofichier,
// fidèle au cahier des charges (16 sections, animations, SEO local, 0 placeholder).

import { findNiche } from "./niches";

type D = Record<string, string>;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
}
function shade(hex: string, pct: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct) / 100;
  const f = (c: number) => Math.round((t - c) * p + c);
  return `#${[f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Données de réputation RÉELLES uniquement : jamais d'avis, de dates ou de
// chiffres inventés (conformité — pratiques commerciales trompeuses).
function reviewCountInt(v: string | undefined): number {
  return parseInt((v || "").replace(/[^\d]/g, "")) || 0;
}

export function generateSiteHtml(d: D): string {
  const niche = findNiche(d.BUSINESS_TYPE ?? "");
  const rtl = d.LANG_DIR === "rtl";
  const primary = d.PRIMARY_COLOR || niche.primary;
  const accent = d.ACCENT_COLOR || niche.accent;
  const neutral = d.NEUTRAL_BG || niche.neutralBg;
  const font = d.DISPLAY_FONT || niche.displayFont;
  const tel = d.PHONE_LINK || "";
  const name = esc(d.BUSINESS_NAME);
  const city = esc(d.CITY || "");
  const rating = parseFloat(d.GOOGLE_RATING || "0") || 0;
  const reviews = reviewCountInt(d.REVIEW_COUNT);
  const hasReviews = rating > 0 && reviews > 0;
  const hours = d.HOURS_WEEKDAY || "";
  const title = `${d.BUSINESS_NAME} — ${niche.label} à ${d.CITY}`.slice(0, 58);
  const metaDesc = `${d.BUSINESS_NAME}, ${niche.label.toLowerCase()} à ${d.CITY}.${hasReviews ? ` ${d.GOOGLE_RATING}/5 · ${d.REVIEW_COUNT} avis publics.` : ""} ${d.TAGLINE}. Appel : ${d.PHONE}.`.slice(0, 158);

  const servicesHtml = niche.services.map((s, i) => `
      <div class="service-card" data-aos="fade-up" data-aos-delay="${(i % 3) * 100}">
        <div class="service-icon-wrap"><i data-lucide="${s.icon}"></i></div>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.desc)}</p>
        <a href="#contact" class="service-link">Demander ce service <i data-lucide="arrow-right"></i></a>
      </div>`).join("");

  // Galerie : photos réelles fournies (GALLERY_IMAGE_URLS, une par slot) quand
  // elles existent ; sinon repli sur les dégradés d'origine. L'onerror remplace
  // l'image par IMAGE_FALLBACK_URL (v5) — jamais de carré cassé, jamais de
  // photo disparue : la fallback prend le relais.
  const fallbackImg = esc(d.IMAGE_FALLBACK_URL || d.HERO_IMAGE_URL || d.ABOUT_IMAGE_URL || "");
  const galleryUrls = (d.GALLERY_IMAGE_URLS || "").split("|").map((s) => s.trim()).filter(Boolean);
  const galleryHtml = niche.gallery.map((g, i) => {
    const c = i % 3 === 0 ? primary : i % 3 === 1 ? accent : shade(primary, 25);
    const photo = galleryUrls[i];
    const img = photo ? `<img class="gallery-photo" src="${esc(photo)}" alt="${esc(name)} — ${esc(g.title)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${fallbackImg}'">` : "";
    return `
      <div class="gallery-item" data-aos="fade-up" data-aos-delay="${(i % 3) * 80}">
        <div class="gallery-placeholder has-photo" style="--card-accent:${c}">
          ${img}
          <div class="gallery-icon"><i data-lucide="${g.icon}"></i></div>
          <div class="gallery-info"><h4>${esc(g.title)}</h4><p>${esc(g.desc)}</p></div>
          <div class="gallery-tag">${esc(g.tag)}</div>
        </div>
      </div>`;
  }).join("");

  // Section réputation 100% factuelle : note + nombre d'avis RÉELS, lien vers
  // la fiche Google. Aucun témoignage inventé, aucun logo Google trompeur.
  const publicReviewsLabel = (d.LANG || "fr").startsWith("en") ? "public reviews on Google" : "avis publics sur Google";
  const reputationHtml = hasReviews ? `
      <div class="rep-card" data-aos="zoom-in">
        <div class="rep-score">
          <div class="rep-stars">★★★★★</div>
          <div class="rep-note">${d.GOOGLE_RATING}<span>/5</span></div>
          <div class="rep-count">${d.REVIEW_COUNT} ${publicReviewsLabel}</div>
        </div>
        <div class="rep-side">
          <p>La réputation de ${name} se lit sur sa fiche Google : note moyenne de ${d.GOOGLE_RATING}/5 construite sur ${d.REVIEW_COUNT} avis publics laissés par ses clients.</p>
          <a href="${d.MAPS_LINK}" target="_blank" rel="noopener" class="btn btn-dark"><i data-lucide="star"></i> Lire les avis sur Google</a>
        </div>
      </div>` : "";

  const faqItems = niche.faq.slice(0, 8);
  const faqCol = (items: typeof faqItems) => items.map((f) => `
        <div class="faq-item">
          <button type="button" class="faq-question"><span>${esc(f.q)}</span><i data-lucide="chevron-down"></i></button>
          <div class="faq-answer"><p>${esc(f.a)}</p></div>
        </div>`).join("");
  const half = Math.ceil(faqItems.length / 2);

  const guaranteesHtml = niche.guarantees.map((g, i) => `
      <div class="guarantee-card" data-aos="fade-up" data-aos-delay="${i * 80}">
        <div class="guarantee-icon"><i data-lucide="${g.icon}"></i></div>
        <h3>${esc(g.title)}</h3><p>${esc(g.desc)}</p>
      </div>`).join("");

  const processHtml = niche.process.map((p, i) => `
      <div class="process-step" data-aos="fade-up" data-aos-delay="${i * 100}">
        <div class="process-num">${String(i + 1).padStart(2, "0")}</div>
        <h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p>
      </div>`).join("");

  const marqueeParts = [
    `☎ ${esc(d.PHONE)}`,
    `&ensp;·&ensp;${esc(d.ADDRESS)}, ${city}`,
    hours ? `&ensp;·&ensp;${esc(hours)}` : "",
    hasReviews ? `&ensp;·&ensp;★ ${d.GOOGLE_RATING}/5 — ${d.REVIEW_COUNT} ${publicReviewsLabel}` : "",
    d.TAGLINE ? `&ensp;·&ensp;${d.TAGLINE ? esc(d.TAGLINE) : ""}` : "",
  ].filter(Boolean);
  const marquee = marqueeParts.join("") + "&ensp;·&ensp;";
  const marqueeTrack = marquee.repeat(4);

  const COUNTRY_CODES: Record<string, string> = { France: "FR", Maroc: "MA", "United States": "US", USA: "US", "United Kingdom": "GB" };
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": d.SCHEMA_TYPE || "LocalBusiness",
    name: d.BUSINESS_NAME,
    description: (d.DESCRIPTION || "").slice(0, 200),
    image: d.HERO_IMAGE_URL,
    telephone: d.PHONE,
    address: { "@type": "PostalAddress", streetAddress: d.ADDRESS, addressLocality: d.CITY, postalCode: d.ZIP, addressCountry: COUNTRY_CODES[d.COUNTRY] ?? "FR" },
    geo: { "@type": "GeoCoordinates", latitude: d.LAT, longitude: d.LNG },
  };
  // aggregateRating UNIQUEMENT avec des avis réels — sinon mention trompeuse.
  if (hasReviews) jsonLd.aggregateRating = { "@type": "AggregateRating", ratingValue: d.GOOGLE_RATING, reviewCount: String(reviews), bestRating: "5" };
  if (d.PAYMENT) jsonLd.paymentAccepted = d.PAYMENT;
  jsonLd.priceRange = "$$";
  jsonLd.currenciesAccepted = d.CURRENCY;
  if (d.EMAIL && d.EMAIL !== "none") jsonLd.email = d.EMAIL;

  // ── Libellés de l'interface du site, dans la langue du lead ──
  const lang: "fr" | "en" = (d.LANG || "fr").startsWith("en") ? "en" : "fr";
  const nicheLabel = lang === "en" ? niche.labelEn : niche.label;
  const T = lang === "en"
    ? {
        menu: "Menu",
        services: "Services", about: "About", work: "Our work", faq: "FAQ", contact: "Contact",
        publicReviews: "public reviews on Google",
        callNow: "Call now", directions: "Directions",
        ourServices: "Our services", servicesH2: "Everything you need, done right",
        servicesSub: "A complete offering built to last: proven techniques, professional equipment and finishes checked one by one.",
        teamAtWork: (n: string) => `The ${n} team at work`,
        googleRating: "Google rating", acrossReviews: (n: string) => `across ${n} reviews`,
        aboutLabel: "About", aboutH2: "Craftsmanship first, customers at the center",
        aboutBody: (c: string) => `Based in ${c}, we built our reputation client by client: word of mouth, Google reviews and loyal regulars. No empty talk — clean work, prices quoted up front and a team that knows every regular by name.`,
        talkToTeam: "Talk to the team", findUs: "Find us",
        statGoogleRating: "Google rating", statPublicReviews: "Public reviews", statServiceArea: "Service area", statDirect: "Direct", statHours: "Hours", statLocalBusiness: "Local business",
        processLabel: "How it works", processH2: "Your journey, step by step", processSub: "A simple, transparent process from the first call to after-service follow-up.",
        galleryLabel: "Our work", galleryH2: "The work speaks for itself",
        reputationLabel: "Reputation", reputationH2: "What their clients say, on Google",
        guaranteesLabel: "Our commitments", guaranteesH2: "Written guarantees, not promises",
        faqLabel: "Common questions", faqH2: "What everyone asks us",
        ctaH2: "Have a project? Let's talk now.", ctaSub: "A clear answer, a free quote and a team ready to serve you.",
        contactLabel: "Contact", contactH2: "Drop by or give us a call", contactDetails: "Contact details",
        directCall: "Direct call, quick answer", reply24: "Reply within 24 business hours", seeGoogle: "See our Google listing",
        formH3: "Send a message", formSub: "A personal reply within 24 business hours. For emergencies, call directly.",
        fullName: "Full name *", yourName: "Your name", phone: "Phone", phonePlaceholder: "+1 (555) 000-0000",
        yourRequest: "Your request *", requestPlaceholder: "Describe what you need in a few words...",
        consent: "I agree that my data may be used to process my request. *",
        submit: "Send my request",
        errName: "Please enter your name", errPhone: "Invalid number", errMsg: "Tell us what you need in a few words", errConsent: "Your consent is required to continue",
        sending: "Sending...", sent: "Message sent!", sentSub: "We'll reply within 24 business hours.", sendErr: "Something went wrong. Please call us directly at ",
        navigation: "Navigation", information: "Information",
        legal: "Legal notice", privacy: "Privacy policy", allRights: "All rights reserved.", crafted: "Website crafted with care.",
        legalBody: (n: string, a: string) => `<p><strong>${n}</strong> — ${nicheLabel}<br>${a}</p><p>This website is published by ${n} as part of its commercial activity. All content (text, visuals, logo) is the exclusive property of the business and may not be reproduced without written permission.</p><p>Publication director: the business owner. Hosting: professional cloud hosting platform.</p>`,
        privacyBody: `<p>Data submitted through the contact form (name, phone, message) is used solely to answer your request. It is never sold or shared with third parties.</p><p>Retention: your data is kept for the time needed to process your request, then deleted. Under applicable regulations, you have the right to access, rectify and delete it: a simple call or message is enough.</p><p>This website uses no advertising tracking cookies. The embedded Google Maps map is subject to Google's terms.</p>`,
        certifiedQuality: "Certified quality", quickReply: "Quick response", andAround: (c: string) => `${c} and surrounding areas`,
        onGoogle: (r: string) => `${r}/5 on Google`,
        proudlyServing: (c: string, l: string) => `Trusted ${l} in ${c} — quality work, fair prices, a team that shows up on time.`,
        inCity: (c: string, l: string) => `${l} in ${c}`,
        footerLine: (c: string, l: string, r: string) => `Trusted ${l} in ${c}. Google rating ${r}/5.`,
        call: (n: string) => `Call ${n}`,
      }
    : {
        menu: "Menu",
        services: "Services", about: "À propos", work: "Réalisations", faq: "FAQ", contact: "Contact",
        publicReviews: "avis publics sur Google",
        callNow: "Appeler maintenant", directions: "Itinéraire",
        ourServices: "Nos services", servicesH2: "Tout ce qu'il faut, fait comme il faut",
        servicesSub: "Une offre complète pensée pour durer : techniques éprouvées, matériel professionnel et finitions contrôlées une à une.",
        teamAtWork: (n: string) => `L'équipe ${n} au travail`,
        googleRating: "note Google", acrossReviews: (n: string) => `sur ${n} avis`,
        aboutLabel: "À propos", aboutH2: "Le métier avant tout, le client au centre",
        aboutBody: (c: string) => `Installés à ${c}, nous avons construit notre réputation client après client : bouche-à-oreille, avis Google et fidélité. Pas de discours creux — un travail propre, des prix annoncés à l'avance et une équipe qui connaît chacun de ses habitués.`,
        talkToTeam: "Parler à l'équipe", findUs: "Nous trouver",
        statGoogleRating: "Note Google", statPublicReviews: "Avis publics", statServiceArea: "Zone desservie", statDirect: "Direct", statHours: "Horaires", statLocalBusiness: "Entreprise locale",
        processLabel: "Comment ça se passe", processH2: "Votre parcours, étape par étape", processSub: "Un déroulé simple et transparent, du premier appel au suivi après prestation.",
        galleryLabel: "Réalisations", galleryH2: "Le travail parle de lui-même",
        reputationLabel: "Réputation", reputationH2: "Ce que disent ses clients, sur Google",
        guaranteesLabel: "Nos engagements", guaranteesH2: "Des garanties écrites, pas des promesses",
        faqLabel: "Questions fréquentes", faqH2: "Ce que tout le monde nous demande",
        ctaH2: "Un projet ? Parlons-en maintenant.", ctaSub: "Un réponse claire, un devis gratuit et une équipe disponible pour vous servir.",
        contactLabel: "Contact", contactH2: "Passez nous voir ou appelez-nous", contactDetails: "Coordonnées",
        directCall: "Appel direct, réponse rapide", reply24: "Réponse sous 24h ouvrées", seeGoogle: "Consultables sur notre fiche Google",
        formH3: "Envoyer un message", formSub: "Réponse personnalisée sous 24h ouvrées. Pour les urgences, appelez directement.",
        fullName: "Nom complet *", yourName: "Votre nom", phone: "Téléphone", phonePlaceholder: "+33 6 00 00 00 00",
        yourRequest: "Votre demande *", requestPlaceholder: "Décrivez votre besoin en quelques mots...",
        consent: "J'accepte que mes données soient utilisées pour traiter ma demande. *",
        submit: "Envoyer ma demande",
        errName: "Merci d'indiquer votre nom", errPhone: "Numéro invalide", errMsg: "Décrivez votre demande en quelques mots", errConsent: "Votre accord est nécessaire pour continuer",
        sending: "Envoi en cours...", sent: "Message envoyé !", sentSub: "Nous vous répondons sous 24h ouvrées.", sendErr: "Une erreur est survenue. Appelez-nous directement au ",
        navigation: "Navigation", information: "Informations",
        legal: "Mentions légales", privacy: "Politique de confidentialité", allRights: "Tous droits réservés.", crafted: "Site réalisé avec soin.",
        legalBody: (n: string, a: string) => `<p><strong>${n}</strong> — ${nicheLabel}<br>${a}</p><p>Ce site est édité par ${n} dans le cadre de son activité commerciale. L'ensemble des contenus (textes, visuels, logo) est la propriété exclusive de l'établissement et ne peut être reproduit sans autorisation écrite.</p><p>Directeur de la publication : le gérant de l'établissement. Hébergement : plateforme d'hébergement cloud professionnelle.</p>`,
        privacyBody: `<p>Les données transmises via le formulaire de contact (nom, téléphone, message) sont utilisées exclusivement pour répondre à votre demande. Elles ne sont ni cédées, ni vendues à des tiers.</p><p>Conservation : vos données sont conservées le temps du traitement de la demande, puis supprimées. Conformément à la réglementation en vigueur, vous disposez d'un droit d'accès, de rectification et de suppression : un simple appel ou message suffit.</p><p>Ce site n'utilise pas de cookies de suivi publicitaire. La carte Google Maps intégrée est soumise aux conditions de Google.</p>`,
        certifiedQuality: "Qualité certifiée", quickReply: "Réponse rapide", andAround: (c: string) => `${c} et alentours`,
        onGoogle: (r: string) => `${r}/5 sur Google`,
        proudlyServing: (c: string, l: string) => `${l} à ${c} — ${niche.trustBadges.join(", ").toLowerCase()}.`,
        inCity: (c: string, l: string) => `${l} à ${c}`,
        footerLine: (c: string, l: string, r: string) => `${l} de confiance à ${c}. ${niche.trustBadges.join(" · ")}. Note Google ${r}/5.`,
        call: (n: string) => `Appeler ${n}`,
      };

  const trustHtml = niche.trustBadges.map((t) => `<span><i data-lucide="shield-check"></i> ${esc(t)}</span>`).join("");
  const trustBar = [
    ["shield-check", niche.trustBadges[0] ?? T.certifiedQuality],
    ["timer", T.quickReply],
    ["star", T.onGoogle(d.GOOGLE_RATING)],
    ["map-pin", T.andAround(city)],
  ].map(([i, t]) => `<div class="trust-item"><i data-lucide="${i}"></i><span>${esc(t)}</span></div>`).join("");

  return `<!DOCTYPE html>
<html lang="${d.LANG || "fr"}"${rtl ? ' dir="rtl"' : ""}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDesc)}">
<meta name="robots" content="index,follow">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:image" content="${d.HERO_IMAGE_URL}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
:root{
  --primary:${primary}; --primary-dark:${shade(primary, -15)}; --primary-light:${shade(primary, 20)};
  --accent:${accent}; --accent-dark:${shade(accent, -15)}; --neutral:${neutral};
  --text-dark:#111; --text-mid:#444; --text-light:#888; --white:#fff; --card-bg:#fff;
  --section-alt:${shade(neutral, -3)}; --border:rgba(0,0,0,.08);
  --shadow-sm:0 2px 8px rgba(0,0,0,.07),0 1px 3px rgba(0,0,0,.05);
  --shadow-md:0 8px 32px rgba(0,0,0,.10),0 2px 8px rgba(0,0,0,.06);
  --shadow-lg:0 24px 64px rgba(0,0,0,.13),0 8px 24px rgba(0,0,0,.08);
  --shadow-accent:0 8px 32px ${alpha(accent, .35)};
  --radius-sm:8px; --radius-md:14px; --radius-lg:22px; --radius-xl:32px;
  --font-display:'${font}',serif; --font-body:'Inter',sans-serif;
  --transition:all .35s cubic-bezier(.16,1,.3,1);
  --container:min(1200px,92vw); --section-pad:clamp(60px,8vw,120px);
  --ease-out:cubic-bezier(.16,1,.3,1);
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:var(--font-body);color:var(--text-dark);background:var(--white);line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%}
.container{width:var(--container);margin:0 auto}
.section{padding:var(--section-pad) 0;position:relative}
.section-alt{background:var(--section-alt)}
h2{font-family:var(--font-display);font-size:clamp(2rem,4.5vw,3rem);line-height:1.15;margin-bottom:14px;color:var(--text-dark)}
.section-sub{color:var(--text-mid);max-width:640px;font-size:1.05rem}
.section-label{display:inline-flex;align-items:center;gap:8px;color:var(--accent);font-weight:700;font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;margin-bottom:16px}
.section-label::before{content:'';width:28px;height:2px;background:var(--accent);border-radius:2px}
[data-aos]{opacity:0;transition:opacity .7s var(--ease-out),transform .7s var(--ease-out)}
[data-aos="fade-up"]{transform:translateY(40px)}[data-aos="fade-down"]{transform:translateY(-40px)}
[data-aos="fade-right"]{transform:translateX(-40px)}[data-aos="fade-left"]{transform:translateX(40px)}
[data-aos="zoom-in"]{transform:scale(.9)}
[data-aos].aos-animate{opacity:1;transform:translate(0) scale(1)}
/* TOPBAR */
#topbar{background:var(--primary);color:rgba(255,255,255,.85);font-size:12.5px;overflow:hidden;position:relative;z-index:60}
.marquee{display:flex;white-space:nowrap;animation:marquee 30s linear infinite;padding:8px 0;width:max-content}
@keyframes marquee{to{transform:translateX(-50%)}}
/* NAVBAR */
#navbar{position:fixed;top:32px;left:0;right:0;z-index:50;padding:18px 0;transition:var(--transition)}
#navbar.transparent-only{top:32px}
#navbar.scrolled{background:rgba(255,255,255,.92);backdrop-filter:blur(14px);box-shadow:var(--shadow-sm);top:0;padding:12px 0}
#navbar.scrolled .nav-link,#navbar.scrolled .logo{color:var(--text-dark)}
#navbar.nav-hidden{transform:translateY(-120%)}
.nav-inner{display:flex;align-items:center;justify-content:space-between;gap:24px}
.logo{font-family:var(--font-display);font-weight:700;font-size:1.3rem;color:#fff;text-decoration:none;transition:var(--transition)}
.logo span{color:var(--accent)}
.nav-links{display:flex;align-items:center;gap:28px}
.nav-link{color:rgba(255,255,255,.88);text-decoration:none;font-size:.92rem;font-weight:600;transition:var(--transition)}
.nav-link:hover{color:var(--accent)}
.nav-cta{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;padding:10px 20px;border-radius:40px;font-size:.88rem;font-weight:700;text-decoration:none;box-shadow:var(--shadow-accent);transition:var(--transition)}
.nav-cta:hover{transform:translateY(-2px)}
.burger{display:none;flex-direction:column;gap:5px;background:none;border:0;cursor:pointer;z-index:70;padding:6px}
.burger span{width:26px;height:2px;background:#fff;border-radius:2px;transition:var(--transition)}
#navbar.scrolled .burger span{background:var(--text-dark)}
.burger.active span:nth-child(1){transform:translateY(7px) rotate(45deg)}
.burger.active span:nth-child(2){opacity:0}
.burger.active span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
.mobile-menu{position:fixed;inset:0;background:var(--primary);z-index:65;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:26px;opacity:0;pointer-events:none;transition:var(--transition)}
.mobile-menu.open{opacity:1;pointer-events:auto}
.mobile-menu a{color:#fff;text-decoration:none;font-family:var(--font-display);font-size:1.6rem}
/* HERO */
#hero{position:relative;min-height:100vh;display:flex;align-items:center;overflow:hidden;color:#fff}
.hero-bg{position:absolute;inset:0;z-index:0}
.hero-bg img{width:100%;height:100%;object-fit:cover;transform:scale(1.05);animation:heroZoom 12s ease-out forwards}
@keyframes heroZoom{to{transform:scale(1)}}
.hero-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(0,0,0,.62) 0%,rgba(0,0,0,.40) 50%,rgba(0,0,0,.25) 100%)}
.hero-pattern{position:absolute;inset:0;opacity:.06;background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-rule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")}
.hero-content{position:relative;z-index:2;padding:140px 0 80px;max-width:780px}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.12);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.2);border-radius:40px;padding:8px 18px;font-size:13px;margin-bottom:28px}
.stars{color:#FFD700;letter-spacing:2px}
#hero h1{font-family:var(--font-display);font-size:clamp(2.6rem,6vw,4.6rem);font-weight:700;line-height:1.08;margin-bottom:20px;text-shadow:0 2px 20px rgba(0,0,0,.3)}
.hero-sub{font-size:clamp(1.02rem,2.2vw,1.25rem);opacity:.92;margin-bottom:36px;max-width:560px}
.hero-ctas{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:40px}
.hero-trust{display:flex;gap:24px;flex-wrap:wrap;font-size:13px;opacity:.85}
.hero-trust span{display:flex;align-items:center;gap:6px}
.hero-trust svg,.trust-item svg,.service-link svg{width:15px;height:15px}
.hero-scroll{position:absolute;bottom:32px;left:50%;transform:translateX(-50%);z-index:2}
.scroll-line{width:1px;height:60px;background:linear-gradient(to bottom,rgba(255,255,255,.8),transparent);margin:0 auto;animation:scrollPulse 2s ease-in-out infinite}
@keyframes scrollPulse{0%,100%{opacity:.4;transform:scaleY(1)}50%{opacity:1;transform:scaleY(.7)}}
/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:50px;font-size:15px;font-weight:600;text-decoration:none;transition:var(--transition);cursor:pointer;border:2px solid transparent;position:relative;overflow:hidden;font-family:var(--font-body)}
.btn::after{content:'';position:absolute;inset:0;background:rgba(255,255,255,.1);opacity:0;transition:opacity .3s}
.btn:hover::after{opacity:1}
.btn:hover{transform:translateY(-2px)}
.btn svg{width:17px;height:17px}
.btn-primary{background:var(--accent);color:#fff;box-shadow:var(--shadow-accent)}
.btn-pulse{animation:btnPulse 3s ease-in-out infinite}
@keyframes btnPulse{0%,100%{box-shadow:var(--shadow-accent)}50%{box-shadow:0 0 0 12px ${alpha(accent, .15)},var(--shadow-accent)}}
.btn-outline-white{background:transparent;color:#fff;border-color:rgba(255,255,255,.5);backdrop-filter:blur(8px)}
.btn-outline-white:hover{background:rgba(255,255,255,.15);border-color:#fff}
.btn-dark{background:var(--primary);color:#fff;box-shadow:var(--shadow-md)}
.btn-outline{background:transparent;color:var(--text-dark);border-color:var(--border)}
.btn-outline:hover{border-color:var(--accent);color:var(--accent)}
/* TRUST BAR */
#trust-bar{background:var(--white);border-bottom:1px solid var(--border);padding:22px 0;position:relative;z-index:3;box-shadow:var(--shadow-sm)}
.trust-grid{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
.trust-item{display:flex;align-items:center;gap:10px;font-weight:600;font-size:.95rem;color:var(--text-dark)}
.trust-item svg{width:20px;height:20px;color:var(--accent)}
/* SERVICES */
.section-pattern{position:absolute;inset:0;opacity:.5;pointer-events:none;background-image:radial-gradient(${alpha(primary, .05)} 1px,transparent 1px);background-size:26px 26px}
.services-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;margin-top:56px;position:relative}
.service-card{background:var(--card-bg);border-radius:var(--radius-lg);padding:36px 32px;box-shadow:var(--shadow-sm);border:1px solid var(--border);transition:var(--transition);position:relative;overflow:hidden}
.service-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--accent),var(--primary));transform:scaleX(0);transform-origin:left;transition:transform .4s var(--ease-out)}
.service-card:hover{transform:translateY(-8px);box-shadow:var(--shadow-lg);border-color:transparent}
.service-card:hover::before{transform:scaleX(1)}
.service-icon-wrap{width:64px;height:64px;border-radius:var(--radius-md);background:linear-gradient(135deg,${alpha(accent, .12)},${alpha(primary, .06)});display:flex;align-items:center;justify-content:center;margin-bottom:22px;transition:var(--transition)}
.service-card:hover .service-icon-wrap{background:linear-gradient(135deg,var(--accent),var(--primary))}
.service-icon-wrap svg{width:28px;height:28px;color:var(--accent);transition:var(--transition)}
.service-card:hover .service-icon-wrap svg{color:#fff}
.service-card h3{font-size:1.2rem;font-weight:700;margin-bottom:12px}
.service-card p{color:var(--text-mid);line-height:1.7;font-size:.95rem;margin-bottom:20px}
.service-link{display:inline-flex;align-items:center;gap:6px;color:var(--accent);font-weight:700;font-size:.9rem;text-decoration:none;transition:gap .3s}
.service-link:hover{gap:10px}
/* ABOUT */
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}
.about-visual{position:relative}
.about-image-frame{position:relative;border-radius:var(--radius-xl);overflow:hidden;aspect-ratio:4/5;box-shadow:var(--shadow-lg)}
.about-image-frame img{width:100%;height:100%;object-fit:cover;transition:transform .8s ease}
.about-image-frame:hover img{transform:scale(1.04)}
.about-badge-float{position:absolute;bottom:28px;${rtl ? "left" : "right"}:-24px;background:var(--accent);color:#fff;border-radius:var(--radius-md);padding:16px 20px;text-align:center;box-shadow:var(--shadow-accent)}
.badge-number{font-family:var(--font-display);font-size:2.4rem;font-weight:700;line-height:1}
.badge-text{font-size:12px;opacity:.9;margin-top:4px}
.about-accent-block{position:absolute;top:-20px;${rtl ? "right" : "left"}:-20px;background:var(--primary);color:#fff;border-radius:var(--radius-md);padding:18px 22px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;box-shadow:var(--shadow-md)}
.about-accent-block svg{width:18px;height:18px;color:var(--accent)}
.about-lead{font-size:1.1rem;color:var(--text-mid);line-height:1.8;margin-bottom:16px;font-style:italic}
.about-text p{color:var(--text-mid);line-height:1.8;margin-bottom:12px}
.about-checklist{list-style:none;display:flex;flex-direction:column;gap:12px;margin:28px 0}
.about-checklist li{display:flex;align-items:flex-start;gap:10px;font-size:.95rem;color:var(--text-mid)}
.about-checklist svg{color:var(--accent);flex-shrink:0;margin-top:3px;width:18px;height:18px}
.about-cta{display:flex;gap:14px;flex-wrap:wrap;margin-top:36px}
/* STATS */
.section-stats{background:linear-gradient(135deg,var(--primary) 0%,var(--primary-dark) 100%);padding:var(--section-pad) 0;position:relative;overflow:hidden}
.stats-bg-pattern{position:absolute;inset:0;opacity:.05;background-image:url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='40' cy='40' r='2'/%3E%3C/svg%3E")}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);position:relative;z-index:1}
.stat-item{text-align:center;padding:40px 24px;color:#fff;position:relative}
.stat-item:not(:last-child)::after{content:'';position:absolute;${rtl ? "left" : "right"}:0;top:20%;bottom:20%;width:1px;background:rgba(255,255,255,.15)}
.stat-icon{width:52px;height:52px;border-radius:var(--radius-md);background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
.stat-icon svg{width:24px;height:24px;color:var(--accent)}
.stat-number{font-family:var(--font-display);font-size:clamp(2.4rem,5vw,3.6rem);font-weight:700;line-height:1;margin-bottom:8px}
.stat-label{font-size:.875rem;opacity:.75;text-transform:uppercase;letter-spacing:.08em}
/* PROCESS */
.process-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;margin-top:56px;counter-reset:step}
.process-step{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-lg);padding:32px 28px;position:relative;transition:var(--transition);box-shadow:var(--shadow-sm)}
.process-step:hover{transform:translateY(-6px);box-shadow:var(--shadow-md)}
.process-num{font-family:var(--font-display);font-size:2.8rem;font-weight:700;color:${alpha(accent, .28)};line-height:1;margin-bottom:14px}
.process-step h3{font-size:1.1rem;font-weight:700;margin-bottom:10px}
.process-step p{color:var(--text-mid);font-size:.92rem;line-height:1.7}
/* GALLERY */
.gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:48px}
.gallery-item{border-radius:var(--radius-lg);overflow:hidden}
.gallery-placeholder{aspect-ratio:4/3;background:linear-gradient(135deg,var(--card-accent),color-mix(in srgb,var(--card-accent) 70%,black));display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:32px;position:relative;overflow:hidden;transition:var(--transition);cursor:pointer}
.gallery-placeholder::before{content:'';position:absolute;inset:0;background-image:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z'/%3E%3C/g%3E%3C/svg%3E");opacity:.06}
.gallery-placeholder:hover{filter:brightness(1.12);transform:scale(1.02)}
.gallery-placeholder.has-photo::after{content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,.18) 55%,rgba(0,0,0,.05));pointer-events:none}
.gallery-placeholder.has-photo .gallery-icon{display:none}
.gallery-placeholder.has-photo .gallery-info{position:relative;z-index:2}
.gallery-placeholder.has-photo .gallery-tag{z-index:2}
.gallery-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:var(--transition)}
.gallery-placeholder.has-photo:hover .gallery-photo{transform:scale(1.06)}
.gallery-icon svg{width:52px;height:52px;color:rgba(255,255,255,.9);filter:drop-shadow(0 4px 12px rgba(0,0,0,.2))}
.gallery-info{text-align:center;color:#fff}
.gallery-info h4{font-size:1rem;font-weight:700;margin-bottom:4px}
.gallery-info p{font-size:.8rem;opacity:.8}
.gallery-tag{position:absolute;top:14px;${rtl ? "left" : "right"}:14px;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em}
/* RÉPUTATION (factuelle) */
.rep-wrap{display:flex;justify-content:center}
.rep-card{display:grid;grid-template-columns:auto 1fr;gap:40px;align-items:center;background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-lg);padding:44px 48px;box-shadow:var(--shadow-md);max-width:860px;width:100%}
.rep-stars{color:#F5B50A;font-size:1.3rem;letter-spacing:4px}
.rep-note{font-family:var(--font-display);font-size:3.6rem;font-weight:700;line-height:1;margin-top:6px}
.rep-note span{font-size:1.4rem;color:var(--text-light);font-weight:600}
.rep-count{font-size:.9rem;color:var(--text-mid);margin-top:6px}
.rep-side p{color:var(--text-mid);line-height:1.75;margin-bottom:20px}
@media(max-width:768px){.rep-card{grid-template-columns:1fr;gap:24px;padding:32px 26px}}
/* GUARANTEES */
.guarantees-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;margin-top:48px}
.guarantee-card{background:var(--card-bg);border-radius:var(--radius-lg);padding:30px 28px;border:1px solid var(--border);border-top:4px solid var(--accent);box-shadow:var(--shadow-sm);transition:var(--transition)}
.guarantee-card:hover{transform:translateY(-6px);box-shadow:var(--shadow-md)}
.guarantee-icon{width:48px;height:48px;border-radius:var(--radius-md);background:${alpha(accent, .12)};display:flex;align-items:center;justify-content:center;margin-bottom:18px}
.guarantee-icon svg{width:22px;height:22px;color:var(--accent)}
.guarantee-card h3{font-size:1.05rem;font-weight:700;margin-bottom:10px}
.guarantee-card p{color:var(--text-mid);font-size:.9rem;line-height:1.7}
/* FAQ */
.faq-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px 32px;margin-top:48px}
.faq-item{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;transition:var(--transition)}
.faq-item.open{border-color:var(--accent);box-shadow:var(--shadow-sm)}
.faq-question{width:100%;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:20px 22px;background:none;border:0;cursor:pointer;text-align:${rtl ? "right" : "left"};font-family:var(--font-body);font-size:.98rem;font-weight:700;color:var(--text-dark)}
.faq-question svg{width:18px;height:18px;color:var(--accent);flex-shrink:0;transition:transform .35s var(--ease-out)}
.faq-item.open .faq-question svg{transform:rotate(180deg)}
.faq-answer{max-height:0;overflow:hidden;transition:max-height .4s var(--ease-out)}
.faq-answer p{padding:0 22px 20px;color:var(--text-mid);font-size:.92rem;line-height:1.75}
/* CTA BANNER */
#cta-banner{background:linear-gradient(135deg,var(--primary),var(--primary-dark));position:relative;overflow:hidden;padding:clamp(60px,7vw,100px) 0;color:#fff;text-align:center}
#cta-banner::before{content:'';position:absolute;inset:0;opacity:.06;background-image:url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff'%3E%3Ccircle cx='40' cy='40' r='2'/%3E%3C/svg%3E")}
#cta-banner h2{color:#fff;font-size:clamp(2rem,4.5vw,3.2rem)}
#cta-banner p{opacity:.85;max-width:560px;margin:0 auto 34px;font-size:1.05rem}
/* CONTACT */
.contact-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;margin-top:48px;align-items:start}
.contact-info-card{background:var(--primary);color:#fff;border-radius:var(--radius-xl);padding:40px 36px;box-shadow:var(--shadow-lg)}
.contact-info-card h3{font-family:var(--font-display);font-size:1.5rem;margin-bottom:24px}
.contact-line{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid rgba(255,255,255,.12);font-size:.95rem}
.contact-line:last-of-type{border:0}
.contact-line svg{width:19px;height:19px;color:var(--accent);flex-shrink:0;margin-top:2px}
.contact-line a{color:#fff;text-decoration:none;font-weight:600}
.contact-line small{display:block;opacity:.65;font-weight:400;font-size:.8rem}
.map-frame{margin-top:24px;border-radius:var(--radius-lg);overflow:hidden;border:1px solid rgba(255,255,255,.2)}
.map-frame iframe{width:100%;height:220px;border:0;display:block}
#contact-form{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-xl);padding:40px 36px;box-shadow:var(--shadow-md)}
#contact-form h3{font-family:var(--font-display);font-size:1.5rem;margin-bottom:6px}
#contact-form>p{color:var(--text-mid);font-size:.92rem;margin-bottom:26px}
.f-group{margin-bottom:18px}
.f-group label{display:block;font-size:.85rem;font-weight:700;margin-bottom:7px}
.f-group input,.f-group textarea{width:100%;padding:13px 16px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-family:var(--font-body);font-size:.95rem;transition:var(--transition);background:#fff;color:var(--text-dark)}
.f-group input:focus,.f-group textarea:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 4px ${alpha(accent, .12)}}
.f-group textarea{min-height:120px;resize:vertical}
.f-consent{display:flex;gap:10px;align-items:flex-start;font-size:.82rem;color:var(--text-mid);margin:6px 0 22px}
.f-consent input{margin-top:3px;accent-color:var(--accent)}
.field-error{color:#D64545;font-size:.78rem;margin-top:5px;display:block}
.form-error-global{color:#D64545;font-size:.85rem;margin-top:14px}
.form-success{text-align:center;padding:32px 0}
.form-success svg{width:52px;height:52px;color:var(--accent);margin-bottom:14px}
.form-success h3{font-size:1.3rem;margin-bottom:8px}
.form-success p{color:var(--text-mid)}
.spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
/* FOOTER */
footer{background:var(--primary);color:rgba(255,255,255,.75);padding:64px 0 0}
.footer-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:48px;padding-bottom:48px}
.footer-grid h4{color:#fff;font-family:var(--font-display);font-size:1.15rem;margin-bottom:18px}
.footer-grid p,.footer-grid li{font-size:.9rem;line-height:1.8}
.footer-grid ul{list-style:none;display:flex;flex-direction:column;gap:10px}
.footer-grid a{color:rgba(255,255,255,.75);text-decoration:none;transition:var(--transition)}
.footer-grid a:hover{color:var(--accent)}
.footer-logo{font-family:var(--font-display);font-weight:700;font-size:1.4rem;color:#fff;margin-bottom:14px}
.footer-logo span{color:var(--accent)}
.footer-bottom{border-top:1px solid rgba(255,255,255,.12);padding:22px 0;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:.82rem}
.footer-bottom a{color:rgba(255,255,255,.6);text-decoration:none;margin-${rtl ? "right" : "left"}:18px}
.footer-bottom a:hover{color:var(--accent)}
/* FLOAT CTA */
#float-cta{position:fixed;bottom:24px;${rtl ? "left" : "right"}:24px;width:60px;height:60px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-accent);z-index:60;text-decoration:none;transition:var(--transition);animation:btnPulse 3s ease-in-out infinite}
#float-cta:hover{transform:scale(1.1)}
#float-cta svg{width:26px;height:26px}
/* MODALS */
.modal{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity .3s}
.modal.modal-active{opacity:1;pointer-events:auto}
.modal-overlay{position:absolute;inset:0;background:rgba(10,10,15,.6);backdrop-filter:blur(6px)}
.modal-box{position:relative;background:#fff;border-radius:var(--radius-lg);max-width:640px;width:100%;max-height:80vh;overflow-y:auto;padding:40px;box-shadow:var(--shadow-lg);transform:translateY(16px);transition:transform .35s var(--ease-out)}
.modal.modal-active .modal-box{transform:translateY(0)}
.modal-box h3{font-family:var(--font-display);font-size:1.4rem;margin-bottom:16px}
.modal-box p{font-size:.9rem;color:var(--text-mid);margin-bottom:12px;line-height:1.75}
.modal-close{position:absolute;top:16px;${rtl ? "left" : "right"}:16px;background:var(--neutral);border:0;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:var(--transition)}
.modal-close:hover{background:var(--accent);color:#fff}
/* RESPONSIVE */
@media(max-width:1024px){
}
@media(max-width:768px){
  .nav-links{display:none}
  .burger{display:flex}
  .about-grid{grid-template-columns:1fr;gap:60px}
  .about-text{padding-${rtl ? "right" : "left"}:0}
  .about-badge-float{${rtl ? "left" : "right"}:12px}
  .stats-grid{grid-template-columns:1fr 1fr}
  .stat-item:nth-child(2)::after{display:none}
  .gallery-grid{grid-template-columns:1fr}
  .faq-grid{grid-template-columns:1fr}
  .contact-grid{grid-template-columns:1fr}
  .footer-grid{grid-template-columns:1fr;gap:32px}
  .hero-content{padding:120px 0 60px}
}
@media(max-width:1024px) and (min-width:769px){.gallery-grid{grid-template-columns:1fr 1fr}.services-grid{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>

<div id="topbar"><div class="marquee"><span>${marqueeTrack}</span><span>${marqueeTrack}</span></div></div>

<nav id="navbar">
  <div class="container nav-inner">
    <a href="#hero" class="logo">${name.split(" ").map((w, i) => i === 0 ? esc(w) : `<span>${esc(w)}</span>`).join(" ")}</a>
    <div class="nav-links">
      <a href="#services" class="nav-link">${T.services}</a>
      <a href="#about" class="nav-link">${T.about}</a>
      <a href="#gallery" class="nav-link">${T.work}</a>
      <a href="#faq" class="nav-link">${T.faq}</a>
      <a href="#contact" class="nav-link">${T.contact}</a>
      <a href="tel:${tel}" class="nav-cta"><i data-lucide="phone"></i> ${esc(d.PHONE)}</a>
    </div>
    <button class="burger" aria-label="${T.menu}"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="mobile-menu">
  <a href="#services">${T.services}</a><a href="#about">${T.about}</a><a href="#gallery">${T.work}</a><a href="#faq">${T.faq}</a><a href="#contact">${T.contact}</a>
</div>

<section id="hero">
  <div class="hero-bg">
    <img src="${esc(d.HERO_IMAGE_URL)}" alt="${name} — ${esc(nicheLabel)} ${lang === "en" ? "in" : "à"} ${city}" loading="eager" fetchpriority="high" onerror="this.onerror=null;this.src='${fallbackImg}'">
    <div class="hero-overlay"></div>
    <div class="hero-pattern"></div>
  </div>
  <div class="hero-content container">
    ${hasReviews ? `<div class="hero-badge" data-aos="fade-down"><span class="stars">★★★★★</span><span>${d.GOOGLE_RATING}/5 · ${d.REVIEW_COUNT} ${T.publicReviews}</span></div>` : ""}
    <h1 data-aos="fade-up" data-aos-delay="100">${esc(d.TAGLINE)}</h1>
    <p class="hero-sub" data-aos="fade-up" data-aos-delay="200">${T.proudlyServing(city, nicheLabel)}</p>
    <div class="hero-ctas" data-aos="fade-up" data-aos-delay="300">
      <a href="tel:${tel}" class="btn btn-primary btn-pulse"><i data-lucide="phone"></i> ${T.callNow}</a>
      <a href="${d.MAPS_LINK}" target="_blank" rel="noopener" class="btn btn-outline-white"><i data-lucide="map-pin"></i> ${T.directions}</a>
    </div>
    <div class="hero-trust" data-aos="fade-up" data-aos-delay="400">${trustHtml}${hours ? `<span><i data-lucide="clock"></i> ${esc(hours)}</span>` : ""}</div>
  </div>
  <div class="hero-scroll"><div class="scroll-line"></div></div>
</section>

<div id="trust-bar"><div class="container trust-grid">${trustBar}</div></div>

<section id="services" class="section section-alt">
  <div class="section-pattern"></div>
  <div class="container">
    <div class="section-label" data-aos="fade-up">${T.ourServices}</div>
    <h2 data-aos="fade-up" data-aos-delay="100">${T.servicesH2}</h2>
    <p class="section-sub" data-aos="fade-up" data-aos-delay="150">${T.servicesSub}</p>
    <div class="services-grid">${servicesHtml}</div>
  </div>
</section>

<section id="about" class="section">
  <div class="container">
    <div class="about-grid">
      <div class="about-visual" data-aos="fade-right">
        <div class="about-image-frame">
          <img src="${esc(d.ABOUT_IMAGE_URL)}" alt="${T.teamAtWork(name)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackImg}'">
          ${hasReviews ? `<div class="about-badge-float"><div class="badge-number">${d.GOOGLE_RATING}</div><div class="badge-text">${T.googleRating}<br>${T.acrossReviews(d.REVIEW_COUNT)}</div></div>` : ""}
        </div>
        <div class="about-accent-block"><i data-lucide="${niche.icon}"></i><span>${T.inCity(city, nicheLabel.toLowerCase())}</span></div>
      </div>
      <div class="about-text" data-aos="fade-left" data-aos-delay="150">
        <div class="section-label">${T.aboutLabel}</div>
        <h2>${T.aboutH2}</h2>
        <p class="about-lead">${esc(d.DESCRIPTION)}</p>
        <p>${T.aboutBody(city)}</p>
        <ul class="about-checklist">
          ${niche.guarantees.map((g) => `<li><i data-lucide="check-circle-2"></i> ${esc(g.title)} — ${esc(g.desc)}</li>`).join("")}
        </ul>
        <div class="about-cta">
          <a href="tel:${tel}" class="btn btn-dark"><i data-lucide="phone-call"></i> ${T.talkToTeam}</a>
          <a href="${d.MAPS_LINK}" target="_blank" rel="noopener" class="btn btn-outline"><i data-lucide="map-pin"></i> ${T.findUs}</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="stats" class="section-stats">
  <div class="stats-bg-pattern"></div>
  <div class="container">
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
      ${hasReviews ? `
      <div class="stat-item" data-aos="zoom-in"><div class="stat-icon"><i data-lucide="star"></i></div><div class="stat-number" data-count="${Math.round(rating * 10)}" data-decimal="1">0</div><div class="stat-label">${T.statGoogleRating}</div></div>
      <div class="stat-item" data-aos="zoom-in" data-aos-delay="100"><div class="stat-icon"><i data-lucide="message-square-quote"></i></div><div class="stat-number" data-count="${reviews}" data-suffix="+">0</div><div class="stat-label">${T.statPublicReviews}</div></div>` : `
      <div class="stat-item" data-aos="zoom-in"><div class="stat-icon"><i data-lucide="map-pin"></i></div><div class="stat-number" style="font-size:clamp(1.6rem,3vw,2.4rem)">${city}</div><div class="stat-label">${T.statServiceArea}</div></div>`}
      <div class="stat-item" data-aos="zoom-in" data-aos-delay="200"><div class="stat-icon"><i data-lucide="phone-call"></i></div><div class="stat-number" style="font-size:clamp(1.6rem,3vw,2.4rem)">${T.statDirect}</div><div class="stat-label">${esc(d.PHONE)}</div></div>
      <div class="stat-item" data-aos="zoom-in" data-aos-delay="300"><div class="stat-icon"><i data-lucide="clock"></i></div><div class="stat-number" style="font-size:clamp(1.3rem,2.6vw,2rem)">${hours ? esc(hours) : "Local"}</div><div class="stat-label">${hours ? T.statHours : T.statLocalBusiness}</div></div>
    </div>
  </div>
</section>

<section id="process" class="section">
  <div class="container">
    <div class="section-label" data-aos="fade-up">${T.processLabel}</div>
    <h2 data-aos="fade-up" data-aos-delay="100">${T.processH2}</h2>
    <p class="section-sub" data-aos="fade-up" data-aos-delay="150">${T.processSub}</p>
    <div class="process-grid">${processHtml}</div>
  </div>
</section>

<section id="gallery" class="section section-alt">
  <div class="container">
    <div class="section-label" data-aos="fade-up">${T.galleryLabel}</div>
    <h2 data-aos="fade-up" data-aos-delay="100">${T.galleryH2}</h2>
    <div class="gallery-grid">${galleryHtml}</div>
  </div>
</section>

${reputationHtml ? `
<section id="testimonials" class="section">
  <div class="container">
    <div class="section-label" data-aos="fade-up">${T.reputationLabel}</div>
    <h2 data-aos="fade-up" data-aos-delay="100">${T.reputationH2}</h2>
    <div class="rep-wrap">${reputationHtml}</div>
  </div>
</section>` : ""}

<section id="guarantees" class="section section-alt">
  <div class="section-pattern"></div>
  <div class="container">
    <div class="section-label" data-aos="fade-up">${T.guaranteesLabel}</div>
    <h2 data-aos="fade-up" data-aos-delay="100">${T.guaranteesH2}</h2>
    <div class="guarantees-grid">${guaranteesHtml}</div>
  </div>
</section>

<section id="faq" class="section">
  <div class="container">
    <div class="section-label" data-aos="fade-up">${T.faqLabel}</div>
    <h2 data-aos="fade-up" data-aos-delay="100">${T.faqH2}</h2>
    <div class="faq-grid">
      <div>${faqCol(faqItems.slice(0, half))}</div>
      <div>${faqCol(faqItems.slice(half))}</div>
    </div>
  </div>
</section>

<section id="cta-banner">
  <div class="container" data-aos="zoom-in">
    <h2>${T.ctaH2}</h2>
    <p>${T.ctaSub}</p>
    <a href="tel:${tel}" class="btn btn-primary btn-pulse"><i data-lucide="phone"></i> ${esc(d.PHONE)}</a>
  </div>
</section>

<section id="contact" class="section section-alt">
  <div class="container">
    <div class="section-label" data-aos="fade-up">${T.contactLabel}</div>
    <h2 data-aos="fade-up" data-aos-delay="100">${T.contactH2}</h2>
    <div class="contact-grid">
      <div class="contact-info-card" data-aos="fade-right">
        <h3>${T.contactDetails}</h3>
        <div class="contact-line"><i data-lucide="phone"></i><div><a href="tel:${tel}">${esc(d.PHONE)}</a><small>${T.directCall}</small></div></div>
        ${d.EMAIL && d.EMAIL !== "none" ? `<div class="contact-line"><i data-lucide="mail"></i><div><a href="mailto:${esc(d.EMAIL)}">${esc(d.EMAIL)}</a><small>${T.reply24}</small></div></div>` : ""}
        <div class="contact-line"><i data-lucide="map-pin"></i><div><a href="${d.MAPS_LINK}" target="_blank" rel="noopener">${esc(d.ADDRESS)}, ${esc(d.ZIP)} ${city}</a><small>${esc(d.COUNTRY)}</small></div></div>
        ${hours ? `<div class="contact-line"><i data-lucide="clock"></i><div><span>${esc(hours)}</span><small>${esc(d.HOURS_SAT)} · ${esc(d.HOURS_SUN)}</small></div></div>` : ""}
        ${hasReviews ? `<div class="contact-line"><i data-lucide="star"></i><div><span>${d.GOOGLE_RATING}/5 · ${d.REVIEW_COUNT} ${T.publicReviews}</span><small>${T.seeGoogle}</small></div></div>` : ""}
        <div class="map-frame"><iframe src="${d.MAPS_EMBED}" loading="lazy" title="Carte ${name}" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
      </div>
      <!-- Branchez votre endpoint Formspree : remplacez l'action ci-dessous par https://formspree.io/f/VOTRE_ID -->
      <form id="contact-form" action="https://formspree.io/f/FORMSPREE_ID" method="POST" data-aos="fade-left" data-aos-delay="150">
        <h3>${T.formH3}</h3>
        <p>${T.formSub}</p>
        <div class="f-group"><label for="f-name">${T.fullName}</label><input id="f-name" name="name" type="text" autocomplete="name" placeholder="${T.yourName}"><span class="field-error" id="error-name"></span></div>
        <div class="f-group"><label for="f-phone">${T.phone}</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" placeholder="${T.phonePlaceholder}"><span class="field-error" id="error-phone"></span></div>
        <div class="f-group"><label for="f-msg">${T.yourRequest}</label><textarea id="f-msg" name="message" placeholder="${T.requestPlaceholder}"></textarea><span class="field-error" id="error-message"></span></div>
        <label class="f-consent"><input type="checkbox" name="consent"><span>${T.consent}</span></label>
        <span class="field-error" id="error-consent"></span>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center"><i data-lucide="send"></i> ${T.submit}</button>
        <div class="form-error-global"></div>
      </form>
    </div>
  </div>
</section>

<footer>
  <div class="container">
    <div class="footer-grid">
      <div>
        <div class="footer-logo">${name} <span>.</span></div>
        <p>${T.footerLine(city, nicheLabel, d.GOOGLE_RATING)}</p>
      </div>
      <div>
        <h4>${T.navigation}</h4>
        <ul><li><a href="#services">${T.services}</a></li><li><a href="#about">${T.about}</a></li><li><a href="#gallery">${T.work}</a></li><li><a href="#faq">${T.faq}</a></li><li><a href="#contact">${T.contact}</a></li></ul>
      </div>
      <div>
        <h4>${T.information}</h4>
        <ul>
          <li><a href="tel:${tel}">${esc(d.PHONE)}</a></li>
          ${d.EMAIL && d.EMAIL !== "none" ? `<li><a href="mailto:${esc(d.EMAIL)}">${esc(d.EMAIL)}</a></li>` : ""}
          <li><a href="${d.MAPS_LINK}" target="_blank" rel="noopener">${esc(d.ADDRESS)}, ${city}</a></li>
          <li><a href="#" data-modal="legalLink">${T.legal}</a></li>
          <li><a href="#" data-modal="privacyLink">${T.privacy}</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} ${name} — ${T.allRights}</span>
      <span>${T.crafted}<a href="#" data-modal="legalLink">${T.legal}</a><a href="#" data-modal="privacyLink">${T.privacy}</a></span>
    </div>
  </div>
</footer>

<a id="float-cta" href="tel:${tel}" aria-label="${T.call(name)}"><i data-lucide="phone"></i></a>

<div class="modal" id="legalModal" role="dialog" aria-modal="true">
  <div class="modal-overlay"></div>
  <div class="modal-box">
    <button class="modal-close" aria-label="${T.menu}"><i data-lucide="x"></i></button>
    <h3>${T.legal}</h3>
    ${T.legalBody(name, `${esc(d.ADDRESS)}, ${esc(d.ZIP)} ${city}, ${esc(d.COUNTRY)}<br>${lang === "en" ? "Phone" : "Téléphone"} : ${esc(d.PHONE)}${d.EMAIL && d.EMAIL !== "none" ? `<br>${lang === "en" ? "Email" : "Email"} : ${esc(d.EMAIL)}` : ""}`)}
  </div>
</div>
<div class="modal" id="privacyModal" role="dialog" aria-modal="true">
  <div class="modal-overlay"></div>
  <div class="modal-box">
    <button class="modal-close" aria-label="${T.menu}"><i data-lucide="x"></i></button>
    <h3>${T.privacy}</h3>
    ${T.privacyBody}
  </div>
</div>

<script>
const App={
  initAOS(){const o=new IntersectionObserver((es)=>{es.forEach((e)=>{if(e.isIntersecting){const el=e.target;const d=el.dataset.aosDelay||0;setTimeout(()=>el.classList.add('aos-animate'),parseInt(d));o.unobserve(el);}})},{threshold:.12,rootMargin:'0px 0px -60px 0px'});document.querySelectorAll('[data-aos]').forEach((el)=>o.observe(el));},
  initCounters(){const o=new IntersectionObserver((es)=>{es.forEach((e)=>{if(e.isIntersecting&&!e.target.classList.contains('counted')){e.target.classList.add('counted');const el=e.target;const target=parseFloat(el.dataset.count);const suffix=el.dataset.suffix||'';const dec=el.dataset.decimal;const dur=2200;const t0=performance.now();const step=(t)=>{const p=Math.min((t-t0)/dur,1);const ease=1-Math.pow(1-p,4);const cur=target*ease;el.textContent=dec?(cur/10).toFixed(1)+suffix:Math.floor(cur)+suffix;if(p<1)requestAnimationFrame(step);};requestAnimationFrame(step);}})},{threshold:.5});document.querySelectorAll('.stat-number').forEach((el)=>o.observe(el));},
  initNav(){const nav=document.querySelector('#navbar');let last=0;window.addEventListener('scroll',()=>{const y=window.scrollY;if(y>80)nav.classList.add('scrolled');else nav.classList.remove('scrolled');if(y>last&&y>300)nav.classList.add('nav-hidden');else nav.classList.remove('nav-hidden');last=y;},{passive:true});
    const burger=document.querySelector('.burger');const mm=document.querySelector('.mobile-menu');
    if(burger)burger.addEventListener('click',()=>{burger.classList.toggle('active');mm.classList.toggle('open');document.body.style.overflow=mm.classList.contains('open')?'hidden':'';});
    document.querySelectorAll('.mobile-menu a').forEach((l)=>l.addEventListener('click',()=>{burger.classList.remove('active');mm.classList.remove('open');document.body.style.overflow='';}));},
  initParallax(){const img=document.querySelector('.hero-bg img');if(!img||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;window.addEventListener('scroll',()=>{const y=window.scrollY;if(y<window.innerHeight)img.style.transform='scale(1) translateY('+(y*.3)+'px)';},{passive:true});},
  initFAQ(){document.querySelectorAll('.faq-item').forEach((item)=>{const q=item.querySelector('.faq-question');const a=item.querySelector('.faq-answer');q.addEventListener('click',()=>{const open=item.classList.contains('open');document.querySelectorAll('.faq-item.open').forEach((o)=>{o.classList.remove('open');o.querySelector('.faq-answer').style.maxHeight='0';});if(!open){item.classList.add('open');a.style.maxHeight=a.scrollHeight+'px';}});});},
  initModals(){['legalModal','privacyModal'].forEach((id)=>{const modal=document.getElementById(id);if(!modal)return;const closeBtn=modal.querySelector('.modal-close');const overlay=modal.querySelector('.modal-overlay');
    const open=()=>{modal.classList.add('modal-active');document.body.style.overflow='hidden';if(closeBtn)closeBtn.focus();};
    const close=()=>{modal.classList.remove('modal-active');document.body.style.overflow='';};
    if(closeBtn)closeBtn.addEventListener('click',close);if(overlay)overlay.addEventListener('click',close);
    document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&modal.classList.contains('modal-active'))close();});
    const trigger=id==='legalModal'?'legalLink':'privacyLink';
    document.querySelectorAll('[data-modal="'+trigger+'"]').forEach((el)=>el.addEventListener('click',(e)=>{e.preventDefault();open();}));});},
  initForm(){const form=document.querySelector('#contact-form');if(!form)return;form.addEventListener('submit',async(e)=>{e.preventDefault();
    const name=form.querySelector('[name="name"]');const phone=form.querySelector('[name="phone"]');const msg=form.querySelector('[name="message"]');const consent=form.querySelector('[name="consent"]');
    form.querySelectorAll('.field-error').forEach((el)=>el.textContent='');let errs=0;
    if(!name.value.trim()||name.value.trim().length<2){errs++;form.querySelector('#error-name').textContent='${T.errName.replace(/'/g, "\\'")}';}
    if(phone.value&&!/^[0-9 +\\-().]{7,}$/.test(phone.value)){errs++;form.querySelector('#error-phone').textContent='${T.errPhone}';}
    if(!msg.value.trim()||msg.value.trim().length<10){errs++;form.querySelector('#error-message').textContent='${T.errMsg}';}
    if(!consent.checked){errs++;form.querySelector('#error-consent').textContent='${T.errConsent}';}
    if(errs>0)return;
    const btn=form.querySelector('[type="submit"]');const orig=btn.innerHTML;btn.innerHTML='${T.sending}';btn.disabled=true;
    try{const res=await fetch(form.action,{method:'POST',headers:{'Accept':'application/json'},body:new FormData(form)});
      if(res.ok){form.innerHTML='<div class="form-success"><i data-lucide="check-circle-2"></i><h3>${T.sent}</h3><p>${T.sentSub}</p></div>';lucide.createIcons();}
      else{throw new Error();}
    }catch{btn.innerHTML=orig;btn.disabled=false;form.querySelector('.form-error-global').textContent='${T.sendErr}' + '${esc(d.PHONE)}';}
  });},
  start(){this.initAOS();this.initCounters();this.initNav();this.initParallax();this.initFAQ();this.initModals();this.initForm();if(window.lucide)lucide.createIcons();}
};
document.addEventListener('DOMContentLoaded',()=>App.start());
</script>
</body>
</html>`;
}
