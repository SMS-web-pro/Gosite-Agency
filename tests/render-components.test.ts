import { renderHeader } from "./_lib/header.ts";
import { renderFooter } from "./_lib/footer.ts";
import { renderMobileBar } from "./_lib/mobile-bar.ts";
import { renderHead } from "./_lib/seo-head.ts";
import { heroSplit } from "./_lib/hero-split.ts";
import { heroCentered } from "./_lib/hero-centered.ts";
import { heroFullwidth } from "./_lib/hero-fullwidth.ts";
import { heroMinimal } from "./_lib/hero-minimal.ts";
import { servicesGrid3 } from "./_lib/services-grid3.ts";
import { servicesGrid2 } from "./_lib/services-grid2.ts";
import { servicesList } from "./_lib/services-list.ts";
import { servicesCardsH } from "./_lib/services-cards-h.ts";
import { processTimeline } from "./_lib/process-timeline.ts";
import { processNumbered } from "./_lib/process-numbered.ts";
import { processIcons } from "./_lib/process-icons.ts";
import { aboutHighlights } from "./_lib/about-highlights.ts";
import { faqAccordion } from "./_lib/faq-accordion.ts";
import { testimonialsCards } from "./_lib/testimonials-cards.ts";
import { galleryMasonry } from "./_lib/gallery-masonry.ts";
import { galleryGrid } from "./_lib/gallery-grid.ts";
import { contactFormMap } from "./_lib/contact-form-map.ts";
import { trustBar } from "./_lib/trust-bar.ts";
import { COMPONENT_REGISTRY } from "./_lib/registry.ts";
import { BASE_CSS } from "./_lib/base.ts";
import { COMPONENTS_CSS } from "./_lib/components.ts";
import { specFixture, specSheet } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const sheet = {
  ...specSheet,
  PHONE_LINK: "+1 (469) 555-3810",
  WHATSAPP_URL: "https://wa.me/14695553810",
  FORM_ACTION: "https://api.gosite.digital/api/site-form/abc",
  HERO_IMAGE_URL: "https://img.example.com/hero.jpg",
  ABOUT_IMAGE_URL: "https://img.example.com/about.jpg",
  GALLERY_IMAGE_URLS: "https://img.example.com/g1.jpg|https://img.example.com/g2.jpg|https://img.example.com/g3.jpg",
  MAPS_EMBED: "https://www.google.com/maps/embed?pb=abc",
  NICHE_LABEL: "Plomberie",
};

const hero = {
  type: "hero",
  headline: "Plomberie fiable",
  subheadline: "Interventions rapides",
  primaryCta: { label: "Appeler", action: "call" },
  secondaryCta: { label: "Services", action: "scroll" },
  chips: ["24/7", "Devis gratuit"],
  style: "split",
};
const services = {
  type: "services",
  title: "Nos services",
  layout: "grid-3",
  items: [
    { title: "Réparation de fuites", slug: "reparation-fuites", shortDesc: "Détection rapide.", icon: "wrench" },
    { title: "Débouchage", slug: "debouchage", shortDesc: "Le jour même.", icon: "droplet" },
    { title: "Chauffe-eau", slug: "chauffe-eau", shortDesc: "Installation.", icon: "flame" },
  ],
};
const processSection = {
  type: "process",
  title: "Comment ça marche",
  layout: "timeline",
  steps: [
    { title: "Appel", desc: "Vous nous appelez." },
    { title: "Devis", desc: "Sous 24 h." },
    { title: "Intervention", desc: "Le jour même." },
  ],
};
const about = {
  type: "about",
  title: "À propos",
  paragraphs: ["Une équipe locale <b>depuis 15 ans</b>."],
  highlights: [{ value: "15+", label: "années" }],
};
const faq = {
  type: "faq",
  title: "Questions fréquentes",
  items: [
    { question: "Q1 ?", answer: "A1." },
    { question: "Q2 ?", answer: "A2." },
  ],
};
const testimonials = {
  type: "testimonials",
  title: "Avis clients",
  items: [
    { name: "Jean", role: "Client", text: "Parfait, rapide.", rating: 5 },
    { name: "Ana", text: "Bon travail.", rating: 3 },
  ],
};
const gallery = {
  type: "gallery",
  title: "Réalisations",
  layout: "masonry",
  captions: ["Salle de bain", "Cuisine", "Chauffe-eau"],
};
const contact = {
  type: "contact",
  title: "Contactez-nous",
  subtitle: "Parlons de votre projet",
  formFields: ["name", "email", "phone", "service-select", "message"],
  showMap: true,
};
const trust = {
  type: "trust",
  title: "Ils nous font confiance",
  items: [
    { value: "500+", label: "clients" },
    { value: "4.8/5", label: "note Google" },
    { value: "15+", label: "ans" },
  ],
};

// ── Header / Footer / Mobile bar ────────────────────────────────────────────
{
  const h = renderHeader(sheet, specFixture);
  check("header: marque", h.includes('class="brand" href="index.html">Test Co</a>'));
  check("header: ancre services", h.includes('href="index.html#services"'));
  check("header: page about", h.includes('href="about.html"'));
  check("header: ancre avis", h.includes('href="index.html#reviews"'));
  check("header: CTA tel", h.includes('href="tel:+14695553810"'));
  check("header: burger 3 lignes", (h.match(/burger-line/g) || []).length === 3);
  check("header: fr -> Accueil", h.includes(">Accueil</a>"));
  check("header: en -> Home", renderHeader(sheet, { ...specFixture, lang: "en" }).includes(">Home</a>"));

  const f = renderFooter(sheet, specFixture);
  check("footer: adresse", f.includes("1 Main St"));
  check("footer: legal", f.includes('href="privacy.html"') && f.includes('href="terms.html"'));
  check("footer: horaires", f.includes("Mon-Fri 8-6"));
  check("footer: année courante", f.includes(String(new Date().getFullYear())));
  check("footer: social neutralisé", !renderFooter({ ...sheet, FACEBOOK: "javascript:alert(1)" }, specFixture).includes("javascript:"));

  const mb = renderMobileBar(sheet, specFixture);
  check("mobile bar: tel + wa", mb.includes("mbar-call") && mb.includes("https://wa.me/14695553810"));
  check("mobile bar: vide sans contact", renderMobileBar({ BUSINESS_NAME: "X" }, specFixture) === "");
  check("mobile bar: lien contact sans wa", renderMobileBar({ PHONE_LINK: "+14695553810" }, specFixture).includes('href="#contact"'));
}

// ── SEO head ────────────────────────────────────────────────────────────────
{
  const head = renderHead({
    title: 'Titre "Test"',
    description: "Desc <x>",
    url: "https://demo.gosite.digital",
    lang: "fr",
    sheet,
    spec: specFixture,
    jsonLd: true,
  });
  check("head: title échappé", head.includes("&quot;Test&quot;"));
  check("head: description échappée", head.includes("&lt;x&gt;"));
  check("head: canonical", head.includes('<link rel="canonical" href="https://demo.gosite.digital/">'));
  check("head: og url", head.includes('property="og:url" content="https://demo.gosite.digital/"'));
  check("head: JSON-LD Plumber", head.includes('"@type":"Plumber"'));
  check("head: JSON-LD FAQPage", head.includes('"@type":"FAQPage"'));
  check("head: fonts fontshare", head.includes("api.fontshare.com"));
  check("head: theme-color", head.includes('name="theme-color" content="#112233"'));
  check("head: favicon", head.includes('href="favicon.svg"'));
  check("head: sans jsonLd, pas de script", !renderHead({ title: "T", description: "D", url: "https://x.y", lang: "fr", sheet, spec: specFixture }).includes("application/ld+json"));
}

// ── Héros x4 ────────────────────────────────────────────────────────────────
{
  const sp = heroSplit(hero, sheet, specFixture);
  check("hero-split: h1", sp.includes("<h1>Plomberie fiable</h1>"));
  check("hero-split: image eager", sp.includes('loading="eager"'));
  check("hero-split: chips", sp.includes("<li>24/7</li>"));
  check("hero-split: tel", sp.includes('href="tel:+14695553810"'));
  check("hero-split: scroll services", sp.includes('href="#services"'));

  const ce = heroCentered({ ...hero, style: "centered" }, sheet, specFixture);
  check("hero-centered: kicker niche", ce.includes('class="hero-kicker">Plomberie</p>'));
  check("hero-centered: centred", ce.includes("hero-centered-inner"));

  const fw = heroFullwidth({ ...hero, style: "fullwidth-bg" }, sheet, specFixture);
  check("hero-fullwidth: fond + overlay", fw.includes("hero-bg") && fw.includes("hero-overlay"));
  check("hero-fullwidth: bouton glass", fw.includes("btn-glass"));

  const mi = heroMinimal({ ...hero, style: "minimal" }, sheet, specFixture);
  check("hero-minimal: primary", mi.includes("btn-primary"));
}

// ── Services x4 ─────────────────────────────────────────────────────────────
{
  const g3 = servicesGrid3(services, sheet, specFixture);
  check("services: ancre id", g3.includes('id="services"'));
  check("services: 3 cartes", (g3.match(/class="service-card /g) || []).length === 3);
  check("services: lien page", g3.includes('href="services/reparation-fuites.html"'));
  check("services: badge initiale", g3.includes('class="icon-badge" aria-hidden="true">R</span>'));
  check("services grid2", servicesGrid2(services, sheet, specFixture).includes("services-grid-2"));
  const list = servicesList(services, sheet, specFixture);
  check("services list: numéros 01..03", list.includes(">01<") && list.includes(">03<"));
  check("services cards-h", servicesCardsH(services, sheet, specFixture).includes('class="services-h"'));
}

// ── Échappement / anti-injection ────────────────────────────────────────────
{
  const evil = {
    ...services,
    title: "<script>alert(1)</script>",
    items: [
      {
        title: "<img src=x onerror=alert(1)>",
        slug: 'a" onmouseover="alert(2)',
        shortDesc: "</article><script>bad()</script>",
        icon: "x",
      },
    ],
  };
  const out = servicesGrid3(evil, sheet, specFixture);
  check("injection: titre échappé", !out.includes("<script>alert(1)"));
  check("injection: desc échappée", !out.includes("<script>bad()"));
  check("injection: entités présentes", out.includes("&lt;script&gt;"));
  check("injection: attribut slug neutralisé", !out.includes('onmouseover="alert(2)"'));
  check("injection: image item jamais balise", !out.includes("<img src=x"));
  check("injection: héros échappé", !heroSplit({ ...hero, headline: "<script>x()</script>" }, sheet, specFixture).includes("<script>x()"));
  check("injection: contact action js neutralisée", !contactFormMap(contact, { ...sheet, FORM_ACTION: "javascript:alert(1)" }, specFixture).includes("javascript:"));
}

// ── Process x3 ──────────────────────────────────────────────────────────────
{
  check("process timeline: dot", processTimeline(processSection, sheet, specFixture).includes("timeline-dot"));
  const num = processNumbered({ ...processSection, layout: "numbered" }, sheet, specFixture);
  check("process numbered: 3 numéros", (num.match(/class="process-num"/g) || []).length === 3);
  const ico = processIcons({ ...processSection, layout: "icons-row" }, sheet, specFixture);
  check("process icons: 3 étapes", (ico.match(/process-icon-step/g) || []).length === 3);
}

// ── About / FAQ / Testimonials ──────────────────────────────────────────────
{
  const ab = aboutHighlights(about, sheet, specFixture);
  check("about: ancre id", ab.includes('id="about"'));
  check("about: highlight", ab.includes("15+") && ab.includes("années"));
  check("about: image", ab.includes("about.jpg"));
  check("about: paragraphe échappé", ab.includes("&lt;b&gt;"));

  const f = faqAccordion(faq, sheet, specFixture);
  check("faq: ancre id", f.includes('id="faq"'));
  check("faq: 2 details", (f.match(/<details/g) || []).length === 2);

  const t = testimonialsCards(testimonials, sheet, specFixture);
  check("testimonials: ancre reviews", t.includes('id="reviews"'));
  check("testimonials: étoiles", t.includes('role="img"') && t.includes("★★★★★"));
  check("testimonials: nom + rôle", t.includes("Jean") && t.includes("Client"));
  check("testimonials: rôle absent toléré", t.includes("Ana"));
}

// ── Galerie x2 ──────────────────────────────────────────────────────────────
{
  const gm = galleryMasonry(gallery, sheet, specFixture);
  check("gallery masonry: 3 figures", (gm.match(/<figure/g) || []).length === 3);
  check("gallery: image du sheet", gm.includes("g1.jpg"));
  check("gallery: caption", gm.includes("Salle de bain"));
  check("gallery slider: classe", galleryGrid({ ...gallery, layout: "slider" }, sheet, specFixture).includes("gallery-slider"));
  check("gallery full: classe", galleryGrid({ ...gallery, layout: "fullwidth" }, sheet, specFixture).includes("gallery-full"));
  check("gallery 2x2: classe", galleryGrid({ ...gallery, layout: "grid-2x2" }, sheet, specFixture).includes("gallery-grid-2x2"));
  check("gallery vide: pas d'img", !galleryMasonry(gallery, { ...sheet, GALLERY_IMAGE_URLS: "" }, specFixture).includes("<img"));
}

// ── Contact / Trust ─────────────────────────────────────────────────────────
{
  const ct = contactFormMap(contact, sheet, specFixture);
  check("contact: ancre id", ct.includes('id="contact"'));
  check("contact: action du sheet", ct.includes('action="https://api.gosite.digital/api/site-form/abc"'));
  check("contact: honeypot", ct.includes('class="hp-field"'));
  check("contact: champs", ct.includes('name="name"') && ct.includes('type="email"') && ct.includes('type="tel"') && ct.includes('name="message"'));
  check("contact: select services", ct.includes('name="service"') && ct.includes("Réparation de fuites"));
  check("contact: iframe map", ct.includes("google.com/maps/embed"));
  check("contact: sans FORM_ACTION", contactFormMap(contact, { ...sheet, FORM_ACTION: "" }, specFixture).includes('action="#"'));
  const noMap = contactFormMap({ ...contact, showMap: false }, sheet, specFixture);
  check("contact: showMap false", !noMap.includes("<iframe"));
  check("contact: map non http supprimée", !contactFormMap(contact, { ...sheet, MAPS_EMBED: "javascript:alert(1)" }, specFixture).includes("<iframe"));

  const tb = trustBar(trust, sheet, specFixture);
  check("trust: valeurs", tb.includes("500+") && tb.includes("4.8/5"));
  check("trust: labels", tb.includes("clients") && tb.includes("note Google"));
}

// ── Registre + CSS ──────────────────────────────────────────────────────────
{
  const expected = {
    hero: ["split", "centered", "fullwidth-bg", "minimal"],
    services: ["grid-3", "grid-2", "list", "cards-horizontal"],
    process: ["timeline", "numbered", "icons-row"],
    about: ["default"],
    faq: ["default"],
    testimonials: ["default"],
    gallery: ["masonry", "grid-2x2", "slider", "fullwidth"],
    contact: ["default"],
    trust: ["default"],
  };
  let complete = Object.keys(COMPONENT_REGISTRY).length === Object.keys(expected).length;
  for (const [k, layouts] of Object.entries(expected)) {
    for (const l of layouts) {
      if (typeof COMPONENT_REGISTRY[k]?.[l] !== "function") complete = false;
    }
  }
  check("registry: 9 types, toutes variantes", complete);

  const samples = { hero, services, process: processSection, about, faq, testimonials, gallery, contact, trust };
  let allRender = true;
  for (const [k, layouts] of Object.entries(expected)) {
    for (const l of layouts) {
      const out = COMPONENT_REGISTRY[k][l](samples[k], sheet, specFixture);
      if (typeof out !== "string" || !out.startsWith("<section")) allRender = false;
    }
  }
  check("registry: chaque entrée rend une section", allRender);
  check("registry: variante inconnue => undefined", COMPONENT_REGISTRY.hero["nope"] === undefined);

  check("base css: reset", BASE_CSS.includes("box-sizing:border-box"));
  check("base css: reveal no-js safe", BASE_CSS.includes("html.has-js .reveal"));
  check("base css: ancres sous header fixe", BASE_CSS.includes("scroll-margin-top:84px"));
  check("base css: boutons", BASE_CSS.includes(".btn-accent") && BASE_CSS.includes(".btn-ghost"));
  check("components css: header", COMPONENTS_CSS.includes(".site-header"));
  check("components css: heroes", COMPONENTS_CSS.includes(".hero-fullwidth") && COMPONENTS_CSS.includes(".hero-centered"));
  check("components css: galerie + contact", COMPONENTS_CSS.includes(".gallery-masonry") && COMPONENTS_CSS.includes(".contact-form"));
  check("components css: mobile bar", COMPONENTS_CSS.includes(".mobile-bar"));
  check("components css: breakpoints", COMPONENTS_CSS.includes("640px") && COMPONENTS_CSS.includes("768px") && COMPONENTS_CSS.includes("1024px"));
  check("css: aucun undefined", !BASE_CSS.includes("undefined") && !COMPONENTS_CSS.includes("undefined"));
  check("css: zéro import externe", !/@import/.test(BASE_CSS + COMPONENTS_CSS));
}

process.exit(fail ? 1 : 0);
