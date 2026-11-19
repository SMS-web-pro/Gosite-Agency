// Phase 8 (spec 2.7) — intégration du moteur SiteSpec au pipeline coder.
// Zéro réseau : LLM injecté (fixture SiteSpec) + fetch d'images simulé.

import {
  ENGINE_MARKER,
  buildEngineSheet,
  buildSiteV7,
  imagesFromBundle,
  renderEngineBundle,
  renderRefreshedBundleV7,
} from "./_lib/coder-engine.ts";
import { isStaleSiteBundle } from "./_lib/bundle.ts";
import { specFixture, specSheet } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const sheet: Record<string, string> = { ...specSheet, PHONE_LINK: "+1 469-555-3810" };
const llmOk = async () => JSON.stringify(specFixture);
const fetchImg = (async () =>
  new Response(new Uint8Array(20_000).fill(7), {
    status: 200,
    headers: { "content-type": "image/jpeg" },
  })) as unknown as typeof fetch;

// ── Fiche moteur ────────────────────────────────────────────────────────────
{
  const s = buildEngineSheet(sheet, 42, "test-shop", { hero: "images/hero.jpg", about: null, gallery: ["images/work-1.jpg"] });
  check("sheet: DOMAIN = sous-domaine slug", s.DOMAIN === "https://test-shop.gosite.digital");
  check("sheet: SLUG conservé", s.SLUG === "test-shop");
  check("sheet: FORM_ACTION API exacte", s.FORM_ACTION === "https://gosite.digital/api/site-form/42");
  check("sheet: hero en URL absolue", s.HERO_IMAGE_URL === "https://test-shop.gosite.digital/images/hero.jpg");
  check("sheet: galerie absolue pipe", s.GALLERY_IMAGE_URLS === "https://test-shop.gosite.digital/images/work-1.jpg");
  check("sheet: OG déterministe", s.OG_IMAGE_URL === "https://test-shop.gosite.digital/og-image.svg");
  check("sheet: PHONE_LINK déduit", s.PHONE_LINK === "+1 469-555-3810");
  check("sheet: NICHE_LABEL renseigné", (s.NICHE_LABEL ?? "").length > 0);
  const custom = buildEngineSheet(sheet, 42, "test-shop", { hero: null, about: null, gallery: [] }, "https://client.example.com/");
  check("sheet: base personnalisée sans slash final", custom.DOMAIN === "https://client.example.com");
  check("sheet: aucune image → pas de clé hero", custom.HERO_IMAGE_URL === undefined);
  // Une URL d'image héritée de la fiche (mapper) ne doit JAMAIS survivre si le
  // fichier n'est pas embarqué : sinon hotlink externe ou 404.
  const inherited = buildEngineSheet(
    { ...sheet, HERO_IMAGE_URL: "https://images.unsplash.com/photo-x", GALLERY_IMAGE_URLS: "https://images.unsplash.com/photo-y" },
    42,
    "test-shop",
    { hero: null, about: null, gallery: [] },
    "https://client.example.com/",
  );
  check("sheet: image héritée supprimée", inherited.HERO_IMAGE_URL === undefined && inherited.GALLERY_IMAGE_URLS === undefined);
  check("sheet: data URI non préfixée", buildEngineSheet(sheet, 42, "t", { hero: "data:image/svg+xml,%3Csvg%3E", about: null, gallery: [] }).HERO_IMAGE_URL === "data:image/svg+xml,%3Csvg%3E");
}

// ── imagesFromBundle ────────────────────────────────────────────────────────
{
  const imgs = imagesFromBundle({
    "images/hero.jpg": "AAA",
    "images/about.jpg": "BBB",
    "images/work-2.jpg": "CCC",
    "images/work-1.jpg": "DDD",
    "index.html": "x",
  });
  check("bundle images: hero", imgs.hero === "images/hero.jpg");
  check("bundle images: about", imgs.about === "images/about.jpg");
  check("bundle images: galerie triée", imgs.gallery.join(",") === "images/work-1.jpg,images/work-2.jpg");
  check("bundle images: bundle vide", imagesFromBundle(null).gallery.length === 0);
}

// ── buildSiteV7 (LLM + images injectés) ─────────────────────────────────────
const built = await buildSiteV7(sheet, 42, { slug: "test-shop", llm: llmOk, fetchImpl: fetchImg });
const home = built.bundle["index.html"] ?? "";
const textFiles = Object.keys(built.bundle).filter((k) => !k.startsWith("images/"));

{
  check("build: engine = site-engine", built.engine === "site-engine");
  check("build: spec validée (metaTitle)", built.spec.metaTitle === specFixture.metaTitle);
  check("build: index non vide", home.length > 5_000);
  check("build: marqueur moteur v7", home.includes(ENGINE_MARKER));
  check("build: formulaire câblé", home.includes("api/site-form/42"));
  check("build: reveal + barre mobile", home.includes("reveal") && home.includes('class="mobile-bar"'));
  check("build: canonical sous-domaine slug", home.includes('href="https://test-shop.gosite.digital/"'));
  check("build: og-image déterministe", home.includes("https://test-shop.gosite.digital/og-image.svg"));
  check("build: assets déterministes", Boolean(built.bundle["favicon.svg"] && built.bundle["og-image.svg"]));
  check("build: 14 fichiers texte", textFiles.length === 14);
  check("build: pages services", specFixture.servicePages.every((s) => Boolean(built.bundle[`services/${s.slug}.html`])));
  check("build: pages fixes", ["about.html", "privacy.html", "terms.html", "404.html"].every((f) => Boolean(built.bundle[f])));
  check("build: sitemap/robots/manifest/vercel", ["sitemap.xml", "robots.txt", "site.webmanifest", "vercel.json"].every((f) => Boolean(built.bundle[f])));
  check("build: images locales embarquées (hero)", Boolean(built.bundle["images/hero.jpg"]));
  check("build: images locales embarquées (about)", Boolean(built.bundle["images/about.jpg"]));
  check("build: galerie embarquée", Object.keys(built.bundle).some((k) => k.startsWith("images/work-")));
  check("build: hero référencé en absolu", home.includes("https://test-shop.gosite.digital/images/hero.jpg"));
  check("build: aucune URL relative d'image sur la home", !home.includes('src="images/'));
  check("build: bundle v7 non obsolète", isStaleSiteBundle(built.bundle, null) === false);
  check("build: html v7 non obsolète", isStaleSiteBundle(null, home) === false);
}

// ── Re-rendu domaine (Deployer / Domainner) ─────────────────────────────────
{
  const nb = renderEngineBundle(built.spec, sheet, 42, "test-shop", "https://client-domain.com", built.bundle);
  const idx = nb["index.html"] ?? "";
  check("domain: canonical nouveau domaine", idx.includes('href="https://client-domain.com/"'));
  check("domain: ancienne base absente", !idx.includes("test-shop.gosite.digital"));
  check("domain: images préservées", nb["images/hero.jpg"] === built.bundle["images/hero.jpg"]);
  check("domain: OG nouveau domaine", idx.includes("https://client-domain.com/og-image.svg"));
  check("domain: pages régénérées (about)", (nb["about.html"] ?? "").includes("https://client-domain.com"));
  check("domain: bundle toujours v7", nb["index.html"].includes(ENGINE_MARKER));
}

// ── Pack R2 + repli SVG quand aucun téléchargement ne réussit ───────────────
{
  const noImg = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  const r = await buildSiteV7(sheet, 7, { slug: "fallback-shop", llm: llmOk, fetchImpl: noImg });
  const idx = r.bundle["index.html"] ?? "";
  check("repli: aucun fichier images/", Object.keys(r.bundle).every((k) => !k.startsWith("images/")));
  check("repli: aucune URL pack/hotlink", !idx.includes("gosite.digital/stock") && !idx.includes("images.unsplash.com"));
  check("repli: images SVG inline", idx.includes("data:image/svg+xml"));
  check("repli: bundle reste v7", idx.includes(ENGINE_MARKER));
}

// ── Pack R2 téléchargé localement (extension webp, zéro hotlink) ────────────
{
  const packOnly = (async (url: string | URL) => {
    if (!String(url).includes("gosite.digital/stock")) throw new Error("offline");
    return new Response(new Uint8Array(20_000).fill(8), { status: 200, headers: { "content-type": "image/webp" } });
  }) as unknown as typeof fetch;
  const r = await buildSiteV7(sheet, 8, { slug: "pack-shop", llm: llmOk, fetchImpl: packOnly });
  const idx = r.bundle["index.html"] ?? "";
  check("pack: hero webp embarqué", Boolean(r.bundle["images/hero.webp"]));
  check("pack: galerie webp embarquée", Object.keys(r.bundle).some((k) => /^images\/work-\d+\.webp$/.test(k)));
  check("pack: HTML pointe le fichier local", idx.includes("https://pack-shop.gosite.digital/images/hero.webp"));
  check("pack: aucune URL pack dans le HTML", !idx.includes("gosite.digital/stock"));
}

// ── Téléchargement partiel : jamais d'URL héritée dans le HTML ─────────────
{
  const partiel = (async (url: string | URL) => {
    if (String(url).includes("hero")) throw new Error("offline");
    return new Response(new Uint8Array(20_000).fill(9), { status: 200, headers: { "content-type": "image/jpeg" } });
  }) as unknown as typeof fetch;
  const r = await buildSiteV7(
    { ...sheet, HERO_IMAGE_URL: "https://images.unsplash.com/photo-hero" },
    9,
    { slug: "partial-shop", llm: llmOk, fetchImpl: partiel },
  );
  const idx = r.bundle["index.html"] ?? "";
  check("partiel: ancienne URL hero absente", !idx.includes("images.unsplash.com"));
  check("partiel: hero référencé dans le bundle", [...idx.matchAll(/<img[^>]+src="([^"]+)"/g)].every((m) => m[1].startsWith("data:") || Boolean(r.bundle[m[1].replace(/^https:\/\/[^/]+\//, "")])));
  check("partiel: hero repris d'une photo locale", Object.keys(r.bundle).some((k) => /^images\/hero\.(webp|jpg)$/.test(k)));
}

// ── Re-rendu domaine : hero repris d'une photo locale si absent ─────────────
{
  const old = {
    "index.html": "old",
    "images/about.jpg": "AAAA",
    "images/work-1.jpg": "BBBB",
    "images/work-2.jpg": "CCCC",
  };
  const r = renderEngineBundle(specFixture, sheet, 11, "domain-shop", "https://client.example.com", old);
  const idx = r["index.html"] ?? "";
  check("domaine: hero aliasé localement", Boolean(r["images/hero.jpg"]) && idx.includes("/images/hero.jpg"));
  check("domaine: pas de dégradé hero", !idx.includes("data:image/svg+xml") || idx.includes("/images/hero.jpg"));
  check("domaine: photos conservées", r["images/work-1.jpg"] === "BBBB" && r["images/hero.jpg"] === "BBBB");
}

// ── Rafraîchissement sans LLM : spec conservé + images locales ──────────────
{
  const r = await renderRefreshedBundleV7(specFixture, sheet, 10, "refresh-shop", undefined, fetchImg);
  const idx = r["index.html"] ?? "";
  check("refresh: hero local", Boolean(r["images/hero.jpg"]));
  check("refresh: galerie locale", Boolean(r["images/work-1.jpg"]));
  check("refresh: zéro hotlink", !idx.includes("images.unsplash.com") && !idx.includes("gosite.digital/stock"));
  check("refresh: marqueur v7", idx.includes(ENGINE_MARKER));
}

// ── Échec LLM → throw (le pipeline remet le lead en file, pas de v6) ───────
{
  let rejected = false;
  try {
    await buildSiteV7(sheet, 42, { slug: "fail-shop", llm: async () => null, fetchImpl: fetchImg });
  } catch {
    rejected = true;
  }
  check("llm KO: buildSiteV7 rejette", rejected);
}

// ── Détection de bundles obsolètes ──────────────────────────────────────────
{
  const v6 = "topbar trustbar w-card p-step faq-item t-star mobile-bar data-reveal api/site-form/";
  check("stale: bundle v6 complet reconnu", isStaleSiteBundle({ "index.html": v6 }, null) === false);
  check("stale: html v6 complet reconnu", isStaleSiteBundle(null, v6) === false);
  check("stale: bundle sans marqueurs rejeté", isStaleSiteBundle({ "index.html": "<html></html>" }, null) === true);
  check("stale: html vide rejeté", isStaleSiteBundle(null, "") === true);
}

console.log(fail ? `\n${fail} échec(s)` : "\nOK");
process.exit(fail ? 1 : 0);
