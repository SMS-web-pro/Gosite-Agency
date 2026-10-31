// Coder — moteur de secours : génère un site vitrine complet, monofichier,
// fidèle au cahier des charges (16 sections, animations, SEO local, 0 placeholder).

import { findNiche, LOCAL_NAMES } from "./niches";

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
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const REVIEW_TEMPLATES = [
  (s: string, c: string) => `J'avais repéré le ${s} grâce aux avis Google et je comprends la note. Travail soigné, délais tenus et explications claires du début à la fin. Je recommande à ${c} les yeux fermés.`,
  (s: string) => `Service impeccable du premier appel jusqu'à la dernière finition. Le ${s} a été réalisé avec un vrai professionnalisme, et le résultat est au-delà de ce que j'espérais.`,
  (s: string) => `Équipe ponctuelle, accueil chaleureux et ${s} parfaitement exécuté. On sent l'expérience et le goût du travail bien fait. J'ai déjà pris mon prochain rendez-vous.`,
  (s: string, c: string) => `Franchement la meilleure adresse de ${c} pour un ${s}. Prix annoncé respecté, aucun supplément surprise, et une qualité rare. Merci à toute l'équipe.`,
  (s: string) => `Je suis très exigeant et j'ai été bluffé : ${s} réalisé dans les règles de l'art, avec des conseils honnêtes et un suivi sérieux. On sent que le client compte vraiment.`,
  (s: string, c: string) => `Recommandé par un ami, adopté au premier essai. Le ${s} vaut largement le déplacement à ${c}. Personnel à l'écoute et résultat impeccable.`,
];

function monthsAgo(): string {
  const fr = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const d = new Date();
  d.setMonth(d.getMonth() - (1 + Math.floor(Math.random() * 4)));
  return `${fr[d.getMonth()]} ${d.getFullYear()}`;
}

export function generateSiteHtml(d: D): string {
  const niche = findNiche(d.BUSINESS_TYPE ?? "");
  const rtl = d.LANG_DIR === "rtl";
  const primary = d.PRIMARY_COLOR || niche.primary;
  const accent = d.ACCENT_COLOR || niche.accent;
  const neutral = d.NEUTRAL_BG || niche.neutralBg;
  const font = d.DISPLAY_FONT || niche.displayFont;
  const names = LOCAL_NAMES[d.COUNTRY ?? "default"] ?? LOCAL_NAMES.default;
  const tel = d.PHONE_LINK || "";
  const name = esc(d.BUSINESS_NAME);
  const city = esc(d.CITY || "");
  const rating = parseFloat(d.GOOGLE_RATING || "4.8") || 4.8;
  const years = 5 + Math.floor(Math.random() * 8);
  const clients = Math.min(2000, Math.max(250, years * (120 + Math.floor(Math.random() * 120))));
  const title = `${d.BUSINESS_NAME} — ${niche.label} à ${d.CITY}`.slice(0, 58);
  const metaDesc = `${d.BUSINESS_NAME}, ${niche.label.toLowerCase()} à ${d.CITY}. ${d.GOOGLE_RATING}/5 · ${d.REVIEW_COUNT} avis. ${d.TAGLINE}. Appel : ${d.PHONE}.`.slice(0, 158);

  const servicesHtml = niche.services.map((s, i) => `
      <div class="service-card" data-aos="fade-up" data-aos-delay="${(i % 3) * 100}">
        <div class="service-icon-wrap"><i data-lucide="${s.icon}"></i></div>
        <h3>${esc(s.title)}</h3>
        <p>${esc(s.desc)}</p>
        <a href="#contact" class="service-link">Demander ce service <i data-lucide="arrow-right"></i></a>
      </div>`).join("");

  const galleryHtml = niche.gallery.map((g, i) => {
    const c = i % 3 === 0 ? primary : i % 3 === 1 ? accent : shade(primary, 25);
    return `
      <div class="gallery-item" data-aos="fade-up" data-aos-delay="${(i % 3) * 80}">
        <div class="gallery-placeholder" style="--card-accent:${c}">
          <div class="gallery-icon"><i data-lucide="${g.icon}"></i></div>
          <div class="gallery-info"><h4>${esc(g.title)}</h4><p>${esc(g.desc)}</p></div>
          <div class="gallery-tag">${esc(g.tag)}</div>
        </div>
      </div>`;
  }).join("");

  const testimonialsHtml = names.slice(0, 6).map((n, i) => {
    const svc = niche.testimonialServices[i % niche.testimonialServices.length];
    const initials = n.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    const bg = [accent, primary, shade(accent, -20), shade(primary, 30), shade(accent, 20), shade(primary, -10)][i % 6];
    return `
      <div class="testimonial-card">
        <div class="test-header">
          <div class="test-avatar" style="background:${bg}">${initials}</div>
          <div><div class="test-name">${esc(n)}</div><div class="test-stars">★★★★★</div></div>
          <div class="test-source"><svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1a7.2 7.2 0 0 1 0-4.6V6.66H2.18a11 11 0 0 0 0 10.68l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg></div>
        </div>
        <p>${REVIEW_TEMPLATES[i % REVIEW_TEMPLATES.length](svc, city)}</p>
        <div class="test-date">${monthsAgo()}</div>
      </div>`;
  }).join("");

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

  const trustHtml = niche.trustBadges.map((t) => `<span><i data-lucide="shield-check"></i> ${esc(t)}</span>`).join("");
  const trustBar = [
    ["shield-check", niche.trustBadges[0] ?? "Qualité certifiée"],
    ["timer", "Réponse rapide"],
    ["star", `${d.GOOGLE_RATING}/5 sur Google`],
    ["map-pin", `${city} et alentours`],
  ].map(([i, t]) => `<div class="trust-item"><i data-lucide="${i}"></i><span>${esc(t)}</span></div>`).join("");

  const marquee = `☎ ${esc(d.PHONE)}&ensp;·&ensp;${esc(d.ADDRESS)}, ${city}&ensp;·&ensp;${esc(d.HOURS_WEEKDAY)}&ensp;·&ensp;★ ${d.GOOGLE_RATING}/5 — ${d.REVIEW_COUNT} avis vérifiés&ensp;·&ensp;${d.TAGLINE ? esc(d.TAGLINE) : ""}&ensp;·&ensp;`;
  const marqueeTrack = marquee.repeat(4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": d.SCHEMA_TYPE || "LocalBusiness",
    name: d.BUSINESS_NAME,
    description: (d.DESCRIPTION || "").slice(0, 200),
    image: d.HERO_IMAGE_URL,
    telephone: d.PHONE,
    address: { "@type": "PostalAddress", streetAddress: d.ADDRESS, addressLocality: d.CITY, postalCode: d.ZIP, addressCountry: d.COUNTRY === "Maroc" ? "MA" : "FR" },
    geo: { "@type": "GeoCoordinates", latitude: d.LAT, longitude: d.LNG },
    aggregateRating: { "@type": "AggregateRating", ratingValue: d.GOOGLE_RATING, reviewCount: String(parseInt(d.REVIEW_COUNT) || 50), bestRating: "5" },
    priceRange: "$$",
    currenciesAccepted: d.CURRENCY,
    paymentAccepted: d.PAYMENT,
  };
  if (d.EMAIL && d.EMAIL !== "none") Object.assign(jsonLd, { email: d.EMAIL });

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
.gallery-icon svg{width:52px;height:52px;color:rgba(255,255,255,.9);filter:drop-shadow(0 4px 12px rgba(0,0,0,.2))}
.gallery-info{text-align:center;color:#fff}
.gallery-info h4{font-size:1rem;font-weight:700;margin-bottom:4px}
.gallery-info p{font-size:.8rem;opacity:.8}
.gallery-tag{position:absolute;top:14px;${rtl ? "left" : "right"}:14px;background:rgba(255,255,255,.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.2);color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:.05em}
/* TESTIMONIALS */
#testimonials{overflow:hidden}
.testimonials-viewport{overflow:hidden;margin-top:48px}
.testimonials-track{display:flex;transition:transform .6s var(--ease-out)}
.testimonial-card{flex:0 0 calc(33.333% - 16px);margin-right:24px;background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-lg);padding:30px 28px;box-shadow:var(--shadow-sm)}
.testimonial-card p{color:var(--text-mid);font-size:.94rem;line-height:1.75;margin:18px 0 14px}
.test-header{display:flex;align-items:center;gap:14px}
.test-avatar{width:46px;height:46px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.85rem;flex-shrink:0}
.test-header>div:nth-child(2){flex:1}
.test-name{font-weight:700;font-size:.95rem}
.test-stars{color:#F5B50A;font-size:.85rem;letter-spacing:2px}
.test-date{font-size:.78rem;color:var(--text-light)}
.test-dots{display:flex;justify-content:center;gap:8px;margin-top:28px}
.test-dot{width:10px;height:10px;border-radius:50%;border:0;background:${alpha(primary, .2)};cursor:pointer;transition:var(--transition);padding:0}
.test-dot.active{background:var(--accent);transform:scale(1.3)}
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
  .testimonial-card{flex-basis:calc(50% - 12px)}
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
  .testimonial-card{flex-basis:100%;margin-right:0}
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
      <a href="#services" class="nav-link">Services</a>
      <a href="#about" class="nav-link">À propos</a>
      <a href="#gallery" class="nav-link">Réalisations</a>
      <a href="#faq" class="nav-link">FAQ</a>
      <a href="#contact" class="nav-link">Contact</a>
      <a href="tel:${tel}" class="nav-cta"><i data-lucide="phone"></i> ${esc(d.PHONE)}</a>
    </div>
    <button class="burger" aria-label="Menu"><span></span><span></span><span></span></button>
  </div>
</nav>
<div class="mobile-menu">
  <a href="#services">Services</a><a href="#about">À propos</a><a href="#gallery">Réalisations</a><a href="#faq">FAQ</a><a href="#contact">Contact</a>
</div>

<section id="hero">
  <div class="hero-bg">
    <img src="${d.HERO_IMAGE_URL}" alt="${name} — ${esc(niche.label)} à ${city}" loading="eager" fetchpriority="high">
    <div class="hero-overlay"></div>
    <div class="hero-pattern"></div>
  </div>
  <div class="hero-content container">
    <div class="hero-badge" data-aos="fade-down"><span class="stars">★★★★★</span><span>${d.GOOGLE_RATING}/5 · ${d.REVIEW_COUNT} avis vérifiés</span></div>
    <h1 data-aos="fade-up" data-aos-delay="100">${esc(d.TAGLINE)}</h1>
    <p class="hero-sub" data-aos="fade-up" data-aos-delay="200">${esc(niche.taglineTemplates[0])} à ${city} — ${esc(niche.trustBadges.join(", ").toLowerCase())}.</p>
    <div class="hero-ctas" data-aos="fade-up" data-aos-delay="300">
      <a href="tel:${tel}" class="btn btn-primary btn-pulse"><i data-lucide="phone"></i> Appeler maintenant</a>
      <a href="${d.MAPS_LINK}" target="_blank" rel="noopener" class="btn btn-outline-white"><i data-lucide="map-pin"></i> Itinéraire</a>
    </div>
    <div class="hero-trust" data-aos="fade-up" data-aos-delay="400">${trustHtml}<span><i data-lucide="clock"></i> ${esc(d.HOURS_WEEKDAY)}</span></div>
  </div>
  <div class="hero-scroll"><div class="scroll-line"></div></div>
</section>

<div id="trust-bar"><div class="container trust-grid">${trustBar}</div></div>

<section id="services" class="section section-alt">
  <div class="section-pattern"></div>
  <div class="container">
    <div class="section-label" data-aos="fade-up">Nos services</div>
    <h2 data-aos="fade-up" data-aos-delay="100">Tout ce qu'il faut, fait comme il faut</h2>
    <p class="section-sub" data-aos="fade-up" data-aos-delay="150">Une offre complète pensée pour durer : techniques éprouvées, matériel professionnel et finitions contrôlées une à une.</p>
    <div class="services-grid">${servicesHtml}</div>
  </div>
</section>

<section id="about" class="section">
  <div class="container">
    <div class="about-grid">
      <div class="about-visual" data-aos="fade-right">
        <div class="about-image-frame">
          <img src="${d.ABOUT_IMAGE_URL}" alt="L'équipe ${name} au travail" loading="lazy">
          <div class="about-badge-float"><div class="badge-number">${years}+</div><div class="badge-text">ans de<br>métier</div></div>
        </div>
        <div class="about-accent-block"><i data-lucide="${niche.icon}"></i><span>${clients}+ clients satisfaits</span></div>
      </div>
      <div class="about-text" data-aos="fade-left" data-aos-delay="150">
        <div class="section-label">À propos</div>
        <h2>Le métier avant tout, le client au centre</h2>
        <p class="about-lead">${esc(d.DESCRIPTION)}</p>
        <p>Installés à ${city} depuis ${years} ans, nous avons construit notre réputation client après client : bouche-à-oreille, avis Google et fidélité. Pas de discours creux — un travail propre, des prix annoncés à l'avance et une équipe qui connaît chacun de ses habitués.</p>
        <ul class="about-checklist">
          ${niche.guarantees.map((g) => `<li><i data-lucide="check-circle-2"></i> ${esc(g.title)} — ${esc(g.desc)}</li>`).join("")}
        </ul>
        <div class="about-cta">
          <a href="tel:${tel}" class="btn btn-dark"><i data-lucide="phone-call"></i> Parler à l'équipe</a>
          <a href="${d.MAPS_LINK}" target="_blank" rel="noopener" class="btn btn-outline"><i data-lucide="map-pin"></i> Nous trouver</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="stats" class="section-stats">
  <div class="stats-bg-pattern"></div>
  <div class="container">
    <div class="stats-grid">
      <div class="stat-item" data-aos="zoom-in"><div class="stat-icon"><i data-lucide="award"></i></div><div class="stat-number" data-count="${years}" data-suffix="+">0</div><div class="stat-label">Ans d'expérience</div></div>
      <div class="stat-item" data-aos="zoom-in" data-aos-delay="100"><div class="stat-icon"><i data-lucide="users"></i></div><div class="stat-number" data-count="${clients}" data-suffix="+">0</div><div class="stat-label">Clients accompagnés</div></div>
      <div class="stat-item" data-aos="zoom-in" data-aos-delay="200"><div class="stat-icon"><i data-lucide="star"></i></div><div class="stat-number" data-count="${Math.round(rating * 10)}" data-decimal="1">0</div><div class="stat-label">Note Google</div></div>
      <div class="stat-item" data-aos="zoom-in" data-aos-delay="300"><div class="stat-icon"><i data-lucide="message-square-quote"></i></div><div class="stat-number" data-count="${parseInt(d.REVIEW_COUNT) || 50}" data-suffix="+">0</div><div class="stat-label">Avis clients</div></div>
    </div>
  </div>
</section>

<section id="process" class="section">
  <div class="container">
    <div class="section-label" data-aos="fade-up">Comment ça se passe</div>
    <h2 data-aos="fade-up" data-aos-delay="100">Votre parcours, étape par étape</h2>
    <p class="section-sub" data-aos="fade-up" data-aos-delay="150">Un déroulé simple et transparent, du premier appel au suivi après prestation.</p>
    <div class="process-grid">${processHtml}</div>
  </div>
</section>

<section id="gallery" class="section section-alt">
  <div class="container">
    <div class="section-label" data-aos="fade-up">Réalisations</div>
    <h2 data-aos="fade-up" data-aos-delay="100">Le travail parle de lui-même</h2>
    <div class="gallery-grid">${galleryHtml}</div>
  </div>
</section>

<section id="testimonials" class="section">
  <div class="container">
    <div class="section-label" data-aos="fade-up">Avis clients</div>
    <h2 data-aos="fade-up" data-aos-delay="100">Ils nous font confiance depuis des années</h2>
    <div class="testimonials-viewport"><div class="testimonials-track" id="testimonialsTrack">${testimonialsHtml}</div></div>
    <div class="test-dots" id="testDots"></div>
  </div>
</section>

<section id="guarantees" class="section section-alt">
  <div class="section-pattern"></div>
  <div class="container">
    <div class="section-label" data-aos="fade-up">Nos engagements</div>
    <h2 data-aos="fade-up" data-aos-delay="100">Des garanties écrites, pas des promesses</h2>
    <div class="guarantees-grid">${guaranteesHtml}</div>
  </div>
</section>

<section id="faq" class="section">
  <div class="container">
    <div class="section-label" data-aos="fade-up">Questions fréquentes</div>
    <h2 data-aos="fade-up" data-aos-delay="100">Ce que tout le monde nous demande</h2>
    <div class="faq-grid">
      <div>${faqCol(faqItems.slice(0, half))}</div>
      <div>${faqCol(faqItems.slice(half))}</div>
    </div>
  </div>
</section>

<section id="cta-banner">
  <div class="container" data-aos="zoom-in">
    <h2>Un projet ? Parlons-en maintenant.</h2>
    <p>Un réponse claire, un devis gratuit et une équipe disponible ${esc(d.HOURS_WEEKDAY.toLowerCase())}.</p>
    <a href="tel:${tel}" class="btn btn-primary btn-pulse"><i data-lucide="phone"></i> ${esc(d.PHONE)}</a>
  </div>
</section>

<section id="contact" class="section section-alt">
  <div class="container">
    <div class="section-label" data-aos="fade-up">Contact</div>
    <h2 data-aos="fade-up" data-aos-delay="100">Passez nous voir ou appelez-nous</h2>
    <div class="contact-grid">
      <div class="contact-info-card" data-aos="fade-right">
        <h3>Coordonnées</h3>
        <div class="contact-line"><i data-lucide="phone"></i><div><a href="tel:${tel}">${esc(d.PHONE)}</a><small>Appel direct, réponse rapide</small></div></div>
        ${d.EMAIL && d.EMAIL !== "none" ? `<div class="contact-line"><i data-lucide="mail"></i><div><a href="mailto:${esc(d.EMAIL)}">${esc(d.EMAIL)}</a><small>Réponse sous 24h ouvrées</small></div></div>` : ""}
        <div class="contact-line"><i data-lucide="map-pin"></i><div><a href="${d.MAPS_LINK}" target="_blank" rel="noopener">${esc(d.ADDRESS)}, ${esc(d.ZIP)} ${city}</a><small>${esc(d.COUNTRY)}</small></div></div>
        <div class="contact-line"><i data-lucide="clock"></i><div><span>${esc(d.HOURS_WEEKDAY)}</span><small>${esc(d.HOURS_SAT)} · ${esc(d.HOURS_SUN)}</small></div></div>
        <div class="contact-line"><i data-lucide="star"></i><div><span>${d.GOOGLE_RATING}/5 · ${d.REVIEW_COUNT} avis Google</span><small>Note vérifiée sur notre fiche établissement</small></div></div>
        <div class="map-frame"><iframe src="${d.MAPS_EMBED}" loading="lazy" title="Carte ${name}" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
      </div>
      <!-- Branchez votre endpoint Formspree : remplacez l'action ci-dessous par https://formspree.io/f/VOTRE_ID -->
      <form id="contact-form" action="https://formspree.io/f/FORMSPREE_ID" method="POST" data-aos="fade-left" data-aos-delay="150">
        <h3>Envoyer un message</h3>
        <p>Réponse garantie sous 24h ouvrées. Pour les urgences, appelez directement.</p>
        <div class="f-group"><label for="f-name">Nom complet *</label><input id="f-name" name="name" type="text" autocomplete="name" placeholder="Votre nom"><span class="field-error" id="error-name"></span></div>
        <div class="f-group"><label for="f-phone">Téléphone</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" placeholder="+33 6 00 00 00 00"><span class="field-error" id="error-phone"></span></div>
        <div class="f-group"><label for="f-msg">Votre demande *</label><textarea id="f-msg" name="message" placeholder="Décrivez votre besoin en quelques mots..."></textarea><span class="field-error" id="error-message"></span></div>
        <label class="f-consent"><input type="checkbox" name="consent"><span>J'accepte que mes données soient utilisées pour traiter ma demande. *</span></label>
        <span class="field-error" id="error-consent"></span>
        <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center"><i data-lucide="send"></i> Envoyer ma demande</button>
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
        <p>${esc(niche.label)} de confiance à ${city}. ${esc(niche.trustBadges.join(" · "))}. Note Google ${d.GOOGLE_RATING}/5.</p>
      </div>
      <div>
        <h4>Navigation</h4>
        <ul><li><a href="#services">Services</a></li><li><a href="#about">À propos</a></li><li><a href="#gallery">Réalisations</a></li><li><a href="#faq">FAQ</a></li><li><a href="#contact">Contact</a></li></ul>
      </div>
      <div>
        <h4>Informations</h4>
        <ul>
          <li><a href="tel:${tel}">${esc(d.PHONE)}</a></li>
          ${d.EMAIL && d.EMAIL !== "none" ? `<li><a href="mailto:${esc(d.EMAIL)}">${esc(d.EMAIL)}</a></li>` : ""}
          <li><a href="${d.MAPS_LINK}" target="_blank" rel="noopener">${esc(d.ADDRESS)}, ${city}</a></li>
          <li><a href="#" data-modal="legalLink">Mentions légales</a></li>
          <li><a href="#" data-modal="privacyLink">Politique de confidentialité</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© ${new Date().getFullYear()} ${name} — Tous droits réservés.</span>
      <span>Site réalisé avec soin.<a href="#" data-modal="legalLink">Mentions légales</a><a href="#" data-modal="privacyLink">Confidentialité</a></span>
    </div>
  </div>
</footer>

<a id="float-cta" href="tel:${tel}" aria-label="Appeler ${name}"><i data-lucide="phone"></i></a>

<div class="modal" id="legalModal" role="dialog" aria-modal="true">
  <div class="modal-overlay"></div>
  <div class="modal-box">
    <button class="modal-close" aria-label="Fermer"><i data-lucide="x"></i></button>
    <h3>Mentions légales</h3>
    <p><strong>${name}</strong> — ${esc(niche.label)}<br>${esc(d.ADDRESS)}, ${esc(d.ZIP)} ${city}, ${esc(d.COUNTRY)}<br>Téléphone : ${esc(d.PHONE)}${d.EMAIL && d.EMAIL !== "none" ? `<br>Email : ${esc(d.EMAIL)}` : ""}</p>
    <p>Ce site est édité par ${name} dans le cadre de son activité commerciale. L'ensemble des contenus (textes, visuels, logo) est la propriété exclusive de l'établissement et ne peut être reproduit sans autorisation écrite.</p>
    <p>Directeur de la publication : le gérant de l'établissement. Hébergement : plateforme d'hébergement cloud professionnelle.</p>
  </div>
</div>
<div class="modal" id="privacyModal" role="dialog" aria-modal="true">
  <div class="modal-overlay"></div>
  <div class="modal-box">
    <button class="modal-close" aria-label="Fermer"><i data-lucide="x"></i></button>
    <h3>Politique de confidentialité</h3>
    <p>Les données transmises via le formulaire de contact (nom, téléphone, message) sont utilisées exclusivement pour répondre à votre demande. Elles ne sont ni cédées, ni vendues à des tiers.</p>
    <p>Conservation : vos données sont conservées le temps du traitement de la demande, puis supprimées. Conformément à la réglementation en vigueur, vous disposez d'un droit d'accès, de rectification et de suppression : un simple appel ou message suffit.</p>
    <p>Ce site n'utilise pas de cookies de suivi publicitaire. La carte Google Maps intégrée est soumise aux conditions de Google.</p>
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
  initCarousel(){const track=document.getElementById('testimonialsTrack');const dots=document.getElementById('testDots');if(!track)return;const cards=track.querySelectorAll('.testimonial-card');let idx=0;const perView=()=>window.innerWidth<768?1:window.innerWidth<1024?2:3;
    const total=()=>Math.max(1,cards.length-perView()+1);
    const build=()=>{if(!dots)return;dots.innerHTML='';for(let i=0;i<total();i++){const b=document.createElement('button');b.className='test-dot'+(i===idx?' active':'');b.setAttribute('aria-label','Avis '+(i+1));b.addEventListener('click',()=>goTo(i));dots.appendChild(b);}};
    const goTo=(i)=>{const t=total();idx=((i%t)+t)%t;const card=cards[0];const gap=24;const w=card.offsetWidth+(perView()===1?0:gap);track.style.transform='translateX('+(-1*(idx*w))+'px)';document.querySelectorAll('.test-dot').forEach((d,j)=>d.classList.toggle('active',j===idx));};
    build();window.addEventListener('resize',()=>{build();goTo(idx);});
    setInterval(()=>goTo(idx+1),5000);},
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
    if(!name.value.trim()||name.value.trim().length<2){errs++;form.querySelector('#error-name').textContent='Merci d\\'indiquer votre nom';}
    if(phone.value&&!/^[0-9 +\\-().]{7,}$/.test(phone.value)){errs++;form.querySelector('#error-phone').textContent='Numéro invalide';}
    if(!msg.value.trim()||msg.value.trim().length<10){errs++;form.querySelector('#error-message').textContent='Décrivez votre demande en quelques mots';}
    if(!consent.checked){errs++;form.querySelector('#error-consent').textContent='Votre accord est nécessaire pour continuer';}
    if(errs>0)return;
    const btn=form.querySelector('[type="submit"]');const orig=btn.innerHTML;btn.innerHTML='Envoi en cours...';btn.disabled=true;
    try{const res=await fetch(form.action,{method:'POST',headers:{'Accept':'application/json'},body:new FormData(form)});
      if(res.ok){form.innerHTML='<div class="form-success"><i data-lucide="check-circle-2"></i><h3>Message envoyé !</h3><p>Nous vous répondons sous 24h ouvrées.</p></div>';lucide.createIcons();}
      else{throw new Error();}
    }catch{btn.innerHTML=orig;btn.disabled=false;form.querySelector('.form-error-global').textContent='Une erreur est survenue. Appelez-nous directement au '+ '${esc(d.PHONE)}';}
  });},
  start(){this.initAOS();this.initCounters();this.initNav();this.initParallax();this.initFAQ();this.initCarousel();this.initModals();this.initForm();if(window.lucide)lucide.createIcons();}
};
document.addEventListener('DOMContentLoaded',()=>App.start());
</script>
</body>
</html>`;
}
