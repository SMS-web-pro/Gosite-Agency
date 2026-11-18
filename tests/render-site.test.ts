import { renderFullSite, resolveBaseUrl } from "./_lib/render.ts";
import { specFixture, specSheet } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const sheet = {
  ...specSheet,
  DOMAIN: "https://demo.gosite.digital",
  PHONE_LINK: "+1 (469) 555-3810",
  WHATSAPP_URL: "https://wa.me/14695553810",
  HERO_IMAGE_URL: "https://img.example.com/hero.jpg",
  ABOUT_IMAGE_URL: "https://img.example.com/about.jpg",
  GALLERY_IMAGE_URLS: "https://img.example.com/g1.jpg",
  NICHE_LABEL: "Plomberie",
};

const bundle = renderFullSite(specFixture, sheet);
const home = bundle["index.html"] ?? "";
const slugs = specFixture.servicePages.map((s) => s.slug);

// ── Base URL ────────────────────────────────────────────────────────────────
{
  check("base url: DOMAIN prioritaire", resolveBaseUrl({ DOMAIN: "https://a.com/", SITE_URL: "https://b.com" }) === "https://a.com");
  check("base url: SITE_URL", resolveBaseUrl({ SITE_URL: "https://b.com/" }) === "https://b.com");
  check("base url: DEPLOY_URL", resolveBaseUrl({ DEPLOY_URL: "https://c.vercel.app" }) === "https://c.vercel.app");
  check("base url: fallback slug", resolveBaseUrl({ SLUG: "test-co" }) === "https://test-co.gosite.digital");
  check("base url: jamais .vercel.app en dur", resolveBaseUrl({}) === "");
}

// ── Bundle : structure ──────────────────────────────────────────────────────
{
  const expected = ["index.html", "about.html", "privacy.html", "terms.html", "404.html", "sitemap.xml", "robots.txt", "site.webmanifest", "vercel.json", "favicon.svg", "og-image.svg", ...slugs.map((s) => `services/${s}.html`)];
  check("bundle: toutes les clés", expected.every((k) => typeof bundle[k] === "string" && bundle[k].length > 0));
  check("bundle: 14 fichiers", Object.keys(bundle).length === 14);
  check("bundle: aucun undefined", Object.values(bundle).every((v) => !v.includes("undefined")));
}

// ── Home ────────────────────────────────────────────────────────────────────
{
  check("home: doctype + lang + dir", home.startsWith("<!DOCTYPE html>") && home.includes('<html lang="fr" dir="ltr">'));
  check("home: main id", home.includes('<main id="main">'));
  check("home: header + footer", home.includes("site-header") && home.includes("site-footer") && home.includes("mobile-bar"));
  check("home: hero présent", home.includes("<h1>Plomberie fiable à Dallas, jour et nuit</h1>"));
  check("home: sections ancrées", home.includes('id="services"') && home.includes('id="faq"') && home.includes('id="about"') && home.includes('id="contact"'));
  check("home: CSS thème inline", home.includes("--color-primary: #112233;") && home.includes(".site-header"));
  check("home: reveal script", home.includes("IntersectionObserver") && home.includes('classList.add("has-js")'));
  check("home: pas de CSS externe", !/<style>[\s\S]*?@import/.test(home));
  check("home: pas de http://", !home.includes("http://"));
  check("home: canonical", home.includes('<link rel="canonical" href="https://demo.gosite.digital/">'));
  check("home: JSON-LD LocalBusiness", home.includes('"@type":"Plumber"'));
  check("home: aggregateRating réel", home.includes('"ratingValue":4.8') && home.includes('"reviewCount":64'));
  check("home: JSON-LD FAQPage", home.includes('"@type":"FAQPage"'));
  check("home: image lazy + eager", home.includes('loading="lazy"') && home.includes('loading="eager"'));
}

// ── Pages services ──────────────────────────────────────────────────────────
{
  const sp = bundle["services/reparation-fuites.html"] ?? "";
  check("service: h1 titre", sp.includes("<h1>Réparation de fuites</h1>"));
  check("service: breadcrumb", sp.includes('class="breadcrumb"') && sp.includes('href="index.html#services"'));
  check("service: heroSubtitle", sp.includes("Une fuite ? Nous la localisons"));
  check("service: bullets", (sp.match(/<li>/g) || []).length >= 3 && sp.includes("Intervention rapide"));
  check("service: CTA tel", sp.includes('class="btn btn-accent" href="tel:+14695553810"'));
  check("service: service lié", sp.includes('href="services/debouchage.html"'));
  check("service: canonical propre", sp.includes('<link rel="canonical" href="https://demo.gosite.digital/services/reparation-fuites/">'));
  check("service: pas de JSON-LD dupliqué", !sp.includes("application/ld+json"));
  check("service: header + footer", sp.includes("site-header") && sp.includes("site-footer"));

  const sp2 = bundle["services/debouchage.html"] ?? "";
  check("service form: CTA vers contact home", sp2.includes('href="index.html#contact"'));
}

// ── About / legal / 404 ─────────────────────────────────────────────────────
{
  const about = bundle["about.html"] ?? "";
  check("about: h1 metaTitle", about.includes("<h1>À propos — Plomberie Dallas</h1>"));
  check("about: story", about.includes("Fondée à Dallas"));
  check("about: mission", about.includes("Notre mission") && about.includes("plomberie honnête"));
  check("about: valeurs", about.includes("Nos valeurs") && about.includes("Honnêteté") && about.includes("Réactivité"));
  check("about: image", about.includes("about.jpg"));
  check("about: canonical", about.includes('href="https://demo.gosite.digital/about/"'));

  const privacy = bundle["privacy.html"] ?? "";
  check("privacy: titre + sections", privacy.includes("<h1>Politique de confidentialité</h1>") && privacy.includes("Données collectées") && privacy.includes("Conservation"));
  check("privacy: date", privacy.includes("Dernière mise à jour") && privacy.includes("2026-11-18"));

  const terms = bundle["terms.html"] ?? "";
  check("terms: titre + sections", terms.includes("<h1>Conditions générales</h1>") && terms.includes("Prestations") && terms.includes("Garantie"));

  const nf = bundle["404.html"] ?? "";
  check("404: code + titre FR", nf.includes(">404</p>") && nf.includes("Page introuvable"));
  check("404: retour accueil", nf.includes('href="index.html"'));
  check("404: EN localisé", (renderFullSite({ ...specFixture, lang: "en" }, sheet)["404.html"] ?? "").includes("Page not found"));
}

// ── SEO / hébergement ───────────────────────────────────────────────────────
{
  const sm = bundle["sitemap.xml"] ?? "";
  check("sitemap: xml + urlset", sm.startsWith('<?xml version="1.0" encoding="UTF-8"?>') && sm.includes("urlset"));
  check("sitemap: 7 URLs", (sm.match(/<loc>/g) || []).length === 7);
  check("sitemap: home racine", sm.includes("<loc>https://demo.gosite.digital/</loc>"));
  check("sitemap: service clean URL", sm.includes("<loc>https://demo.gosite.digital/services/chauffe-eau</loc>"));

  const robots = bundle["robots.txt"] ?? "";
  check("robots: allow + sitemap", robots.includes("User-agent: *") && robots.includes("Allow: /") && robots.includes("Sitemap: https://demo.gosite.digital/sitemap.xml"));

  let manifest: Record<string, unknown> | null = null;
  try { manifest = JSON.parse(bundle["site.webmanifest"] ?? ""); } catch { manifest = null; }
  check("manifest: JSON valide", manifest !== null);
  check("manifest: champs", manifest?.name === "Test Co" && manifest?.start_url === "/" && manifest?.theme_color === "#112233" && manifest?.lang === "fr");

  let vercel: Record<string, unknown> | null = null;
  try { vercel = JSON.parse(bundle["vercel.json"] ?? ""); } catch { vercel = null; }
  check("vercel.json: cleanUrls", vercel?.cleanUrls === true);
}

// ── Échappement de bout en bout ─────────────────────────────────────────────
{
  const evilSpec = { ...specFixture, metaTitle: "<script>alert(1)</script>", servicePages: specFixture.servicePages };
  const evilBundle = renderFullSite(evilSpec, { ...sheet, BUSINESS_NAME: "<b>Evil</b>" });
  const page = evilBundle["index.html"] ?? "";
  check("injection: metaTitle échappé", !page.includes("<script>alert(1)") && page.includes("&lt;script&gt;alert(1)"));
  check("injection: marque échappée", !page.includes("<b>Evil</b>") && page.includes("&lt;b&gt;Evil&lt;/b&gt;"));
  check("injection: toutes pages rendues", Object.keys(evilBundle).length === 14);
}

process.exit(fail ? 1 : 0);
