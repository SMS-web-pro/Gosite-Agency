// Phase 12 (spec 5.2) — rendu HTML : les 4 heros, structure du bundle,
// échappement, URLs canoniques et images.

import { renderFullSite } from "./_lib/render.ts";
import { specFixture, specSheet } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const sheet = {
  ...specSheet,
  DOMAIN: "https://demo.gosite.digital",
  HERO_IMAGE_URL: "https://img.example.com/hero.jpg",
  ABOUT_IMAGE_URL: "https://img.example.com/about.jpg",
  GALLERY_IMAGE_URLS: "https://img.example.com/g1.jpg,https://img.example.com/g2.jpg",
};
const BALANCE_TAGS = ["div", "section", "main", "header", "footer", "article", "nav", "ul", "li", "span", "h1", "h2", "h3"];

const unbalanced = (html: string, tag: string) => {
  const open = (html.match(new RegExp(`<${tag}\\b`, "g")) || []).length;
  const close = (html.match(new RegExp(`</${tag}>`, "g")) || []).length;
  return open !== close;
};

// ── 4 styles de hero : rendu valide, échappé, sans .vercel.app ──────────────
for (const style of ["split", "centered", "fullwidth-bg", "minimal"] as const) {
  const spec = clone(specFixture);
  const hero = spec.homeSections[0];
  if (hero.type === "hero") hero.style = style;
  const home = renderFullSite(spec, sheet)["index.html"] ?? "";
  check(`hero ${style}: rendu + headline`, home.includes("<h1>Plomberie fiable à Dallas, jour et nuit</h1>"));
  check(`hero ${style}: balises fermées`, BALANCE_TAGS.every((t) => !unbalanced(home, t)));
  check(`hero ${style}: aucun .vercel.app`, !home.includes(".vercel.app"));
  const imgs = [...home.matchAll(/<img[^>]+src="([^"]*)"/g)].map((m) => m[1]);
  check(`hero ${style}: images absolues ou locales`, imgs.length > 0 && imgs.every((s) => /^https:\/\/|^\//.test(s)));
}

// ── Échappement du contenu injecté (headline, chips, description) ───────────
{
  const evil = clone(specFixture);
  const hero = evil.homeSections[0];
  if (hero.type === "hero") {
    hero.headline = "Plomberie <script>alert(1)</script> & fiable";
    hero.chips = ["<b>gratuit</b>", "24/7", "garanti"];
  }
  const home = renderFullSite(evil, sheet)["index.html"] ?? "";
  check("escape: script non exécutable", !home.includes("<script>alert(1)"));
  check("escape: headline échappée", home.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  check("escape: chips échappées", !home.includes("<b>gratuit</b>") && home.includes("&lt;b&gt;gratuit&lt;/b&gt;"));
}

// ── Bundle complet : toutes les pages + SEO ─────────────────────────────────
{
  const bundle = renderFullSite(specFixture, sheet);
  const slugs = specFixture.servicePages.map((s) => s.slug);
  const expected = ["index.html", "about.html", "privacy.html", "terms.html", "404.html", "sitemap.xml", "robots.txt", "site.webmanifest", "vercel.json", "favicon.svg", "og-image.svg", ...slugs.map((s) => `services/${s}.html`)];
  check("bundle: 14 fichiers attendus", expected.every((k) => (bundle[k] ?? "").length > 0) && Object.keys(bundle).length === 14);

  const sitemap = bundle["sitemap.xml"] ?? "";
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check("sitemap: home + pages fixes + services", locs.length === 7 && locs.includes("https://demo.gosite.digital/") && locs.includes("https://demo.gosite.digital/services/debouchage") && locs.includes("https://demo.gosite.digital/privacy"));
  check("robots: sitemap correct", (bundle["robots.txt"] ?? "").includes("Sitemap: https://demo.gosite.digital/sitemap.xml"));
  check("canonical: baseUrl (pas vercel.app)", (bundle["index.html"] ?? "").includes('<link rel="canonical" href="https://demo.gosite.digital/">') && !Object.values(bundle).join("").includes(".vercel.app"));

  const html = Object.entries(bundle).filter(([k]) => k.endsWith(".html"));
  check("html: toutes les pages lang=fr", html.every(([, v]) => v.includes('<html lang="fr" dir="ltr">')));
  check("html: aucune image cassée", html.every(([, v]) => [...v.matchAll(/<img[^>]+src="([^"]*)"/g)].every((m) => /^https:\/\/|^\//.test(m[1]))));
  check("legal: privacy FR", (bundle["privacy.html"] ?? "").includes("<h1>Politique de confidentialité</h1>") && (bundle["privacy.html"] ?? "").includes("Dernière mise à jour"));
  check("legal: terms FR", (bundle["terms.html"] ?? "").includes("<h1>Conditions générales</h1>") && (bundle["terms.html"] ?? "").includes("Garantie"));
}

process.exit(fail ? 1 : 0);
