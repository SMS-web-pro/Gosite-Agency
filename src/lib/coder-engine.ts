// Phase 8 (spec 2.7) — intégration du moteur SiteSpec au pipeline de
// production : fiche + images locales → SiteSpec (LLM validé Zod) → bundle
// 100% déterministe (renderFullSite). Unique chemin de génération : le moteur
// v6 (buildSiteBundle/renderFallbackIndex) n'est plus utilisé pour les
// nouveaux sites (spec 1.5/2.7, correctif « sites trop null »).

import { geminiCompleteStep } from "./gemini";
import { findNiche } from "./niches";
import { pickSeededImages } from "./images";
import { downloadImages, type ImageSlot } from "./bundle-images";
import { generateSiteSpec, type SpecLlmCall } from "../site-engine/generate-spec";
import { renderFullSite } from "../site-engine/render";
import type { SiteSpec } from "../site-engine/site-spec.schema";
import type { ClientSheet } from "../site-engine/types";
import { generateFallbackPack, resolveImages } from "../site-engine/images/stock-resolver";

/** Marqueur présent dans le <head> de toutes les pages du moteur v7 —
 *  partagé avec isStaleSiteBundle (bundle.ts) : un bundle v7 n'est jamais
 *  considéré comme obsolète par les marqueurs v6. */
export const ENGINE_MARKER = 'name="generator" content="gosite-site-engine/v7"';

export type EngineImages = {
  hero: string | null;
  about: string | null;
  gallery: string[];
  /** Fichiers binaires (base64) à réattacher au bundle — absents lors d'un
   *  simple re-rendu de domaine (les images existantes sont recopiées). */
  files?: Record<string, string>;
};

export type EngineBuild = {
  html: string;
  bundle: Record<string, string>;
  spec: SiteSpec;
  engine: "site-engine";
};

export type EngineBuildOpts = {
  slug: string;
  baseUrl?: string;
  llm?: SpecLlmCall;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  deadlineMs?: number;
};

/** Fiche du moteur : domaine absolu, endpoint formulaire, images locales
 *  exposées en URLs absolues (les composants n'acceptent pas les chemins
 *  relatifs sur les pages /services/*), OG déterministe. */
export function buildEngineSheet(
  sheet: ClientSheet,
  prospectId: number,
  slug: string,
  imgs: EngineImages,
  baseUrlOverride?: string
): ClientSheet {
  const base = (baseUrlOverride || `https://${slug}.gosite.digital`).replace(/\/+$/, "");
  const abs = (p: string | null): string => {
    if (!p) return "";
    if (/^(https?:|data:)/i.test(p)) return p; // data: URI = repli déjà inline
    return `${base}/${p.replace(/^\/+/, "")}`;
  };
  const niche = findNiche(sheet.BUSINESS_TYPE ?? "");
  const isEn = (sheet.LANG || "fr").startsWith("en");

  const out: ClientSheet = {
    ...sheet,
    SLUG: slug,
    DOMAIN: base,
    PHONE_LINK: sheet.PHONE_LINK || sheet.PHONE || "",
    FORM_ACTION: `https://gosite.digital/api/site-form/${prospectId}`,
    NICHE_LABEL: sheet.NICHE_LABEL || (isEn ? niche.labelEn : niche.label),
    OG_IMAGE_URL: `${base}/og-image.svg`,
  };

  // Les clés images héritées de la fiche (mapper/legacy) pointeraient vers des
  // fichiers absents du bundle (ex: HERO_IMAGE_URL Unsplash alors que le
  // téléchargement a échoué) → image cassée/hotlink. On remplace TOUJOURS par
  // les slots réellement embarqués, et on supprime la clé sinon.
  if (imgs.hero) out.HERO_IMAGE_URL = abs(imgs.hero);
  else delete out.HERO_IMAGE_URL;
  if (imgs.about) out.ABOUT_IMAGE_URL = abs(imgs.about);
  else delete out.ABOUT_IMAGE_URL;
  const gallery = imgs.gallery.map(abs).filter(Boolean);
  if (gallery.length) out.GALLERY_IMAGE_URLS = gallery.join("|");
  else delete out.GALLERY_IMAGE_URLS;

  return out;
}

/** Première photo locale utilisable comme hero de secours (galerie puis about). */
function donorImageKey(files: Record<string, string> | null | undefined): string | null {
  const keys = Object.keys(files ?? {});
  return ["images/work-1", "images/about"]
    .flatMap((base) => keys.filter((k) => k.startsWith(`${base}.`)))[0] ?? null;
}

/** Complète les slots manquants : pack R2 (téléchargé localement) puis, en
 *  dernier recours, dégradé SVG inline (data URI) — jamais d'URL externe ou
 *  de fichier absent du bundle. */
async function completeImages(
  imgs: EngineImages,
  businessType: string | undefined,
  fetchImpl: typeof fetch | undefined,
  colors: { primary: string; accent: string },
): Promise<EngineImages> {
  let out = imgs;
  if (!out.hero || !out.about || out.gallery.length === 0) {
    const pack = resolveImages(businessType);
    const slots: ImageSlot[] = [];
    if (!out.hero) slots.push({ slot: "hero", url: pack.hero, ext: "webp" });
    if (!out.about) slots.push({ slot: "about", url: pack.about, ext: "webp" });
    if (out.gallery.length === 0) {
      pack.gallery.forEach((url) => slots.push({ slot: "gallery", url, ext: "webp" }));
    }
    if (slots.length) {
      const packImgs = await downloadImages(slots, fetchImpl);
      out = {
        files: { ...out.files, ...packImgs.files },
        hero: out.hero ?? packImgs.hero,
        about: out.about ?? packImgs.about,
        gallery: out.gallery.length ? out.gallery : packImgs.gallery,
      };
    }
  }
  // Dernier réflexe avant le dégradé : si une photo locale existe (galerie ou
  // about), on la réutilise comme hero. Un vrai visuel vaut mieux qu'un aplat,
  // et le fichier est déjà dans le bundle (zéro hotlink).
  if (!out.hero && out.files) {
    const donorKey = donorImageKey(out.files);
    if (donorKey) {
      const ext = donorKey.split(".").pop() ?? "jpg";
      const heroKey = `images/hero.${ext}`;
      out = { ...out, files: { ...out.files, [heroKey]: out.files[donorKey] }, hero: heroKey };
    }
  }
  const fallback = generateFallbackPack(colors.primary, colors.accent);
  return {
    files: out.files,
    hero: out.hero ?? fallback.hero,
    about: out.about ?? fallback.about,
    gallery: out.gallery.length ? out.gallery : fallback.gallery,
  };
}

/** Reconstruit les références d'images à partir des fichiers du bundle
 *  existant (images/hero.jpg, images/about.jpg, images/work-N.jpg). */
export function imagesFromBundle(bundle: Record<string, string> | null | undefined): EngineImages {
  const b = bundle ?? {};
  const num = (k: string): number => Number(/(\d+)\./.exec(k)?.[1] ?? 0);
  const gallery = Object.keys(b)
    .filter((k) => /^images\/work-\d+\.(jpe?g|png|webp|avif)$/i.test(k))
    .sort((a, z) => num(a) - num(z));
  const firstOf = (names: string[]): string | null => names.find((n) => b[n]) ?? null;
  return {
    hero: firstOf(["images/hero.jpg", "images/hero.webp"]),
    about: firstOf(["images/about.jpg", "images/about.webp"]),
    gallery,
  };
}

/** Sélection + téléchargement des images de niche (seed nom+ville), puis pack
 *  R2 et dégradé SVG pour tout slot manquant. Aucun hotlink dans le résultat. */
async function prepareImages(sheet: ClientSheet, fetchImpl?: typeof fetch): Promise<EngineImages> {
  const niche = findNiche(sheet.BUSINESS_TYPE ?? "");
  const pool = niche.imagePool.length ? niche.imagePool : [niche.heroImage, niche.aboutImage];
  const picked = pickSeededImages(pool, `${sheet.BUSINESS_NAME ?? ""}|${sheet.CITY ?? ""}`, 6);
  const seen = new Set<string>();
  const slots: ImageSlot[] = [
    { slot: "hero", url: picked.hero },
    { slot: "about", url: picked.about },
    ...picked.gallery
      .filter((u) => (seen.has(u) ? false : (seen.add(u), true)))
      .map((url) => ({ slot: "gallery" as const, url })),
  ];
  const downloaded = await downloadImages(slots, fetchImpl);
  return completeImages(downloaded, sheet.BUSINESS_TYPE, fetchImpl, {
    primary: sheet.PRIMARY_COLOR || "#112233",
    accent: sheet.ACCENT_COLOR || "#ff7a1a",
  });
}

/** Re-rendu d'un site v7 existant SANS LLM : spec conservé, images re-téléchargées
 *  en local (corrige les hotlinks/404 des bundles générés avant ce correctif). */
export async function renderRefreshedBundleV7(
  spec: SiteSpec,
  sheet: ClientSheet,
  prospectId: number,
  slug: string,
  baseUrl?: string,
  fetchImpl?: typeof fetch
): Promise<Record<string, string>> {
  const imgs = await prepareImages(sheet, fetchImpl);
  const engineSheet = buildEngineSheet(sheet, prospectId, slug, imgs, baseUrl);
  return { ...renderFullSite(spec, engineSheet), ...(imgs.files ?? {}) };
}

/** Re-rendu intégral du bundle pour un nouveau domaine (Deployer/Domainner) :
 *  tout est régénéré depuis le SiteSpec + les images du bundle existant. */
export function renderEngineBundle(
  spec: SiteSpec,
  sheet: ClientSheet,
  prospectId: number,
  slug: string,
  baseUrl: string,
  existingBundle?: Record<string, string> | null
): Record<string, string> {
  const rawImgs = imagesFromBundle(existingBundle);
  const fallback = generateFallbackPack(spec.palette.primary, spec.palette.accent);
  // Pas de hero local mais des photos existent → on les réutilise (alias
  // images/hero.<ext>) au lieu d'aplatir le hero en dégradé SVG.
  const donor = rawImgs.hero ? null : donorImageKey(existingBundle);
  const heroAlias = donor ? `images/hero.${donor.split(".").pop() ?? "jpg"}` : null;
  const imgs: EngineImages = {
    hero: rawImgs.hero ?? heroAlias ?? fallback.hero,
    about: rawImgs.about ?? fallback.about,
    gallery: rawImgs.gallery.length ? rawImgs.gallery : fallback.gallery,
  };
  const engineSheet = buildEngineSheet(sheet, prospectId, slug, imgs, baseUrl);
  const bundle = renderFullSite(spec, engineSheet);
  for (const [k, v] of Object.entries(existingBundle ?? {})) {
    if (k.startsWith("images/") && v) bundle[k] = v;
  }
  if (donor && heroAlias && existingBundle?.[donor]) bundle[heroAlias] = existingBundle[donor];
  return bundle;
}

/** Build v7 : images locales → SiteSpec (LLM) → bundle SiteSpec.
 *  Échec du LLM = throw : le pipeline remet le lead en file (jamais de repli
 *  vers le gabarit v6, qui produisait les sites « null »). */
export async function buildSiteV7(
  sheet: ClientSheet,
  prospectId: number,
  opts: EngineBuildOpts
): Promise<EngineBuild> {
  const { slug } = opts;

  // 1. Images : même pool de niche que le legacy (seed nom+ville) ; aucun
  //    téléchargement impossible → pack R2 déterministe (spec 2.6).
  const imgs = await prepareImages(sheet, opts.fetchImpl);

  // 2. Fiche moteur + SiteSpec validé (retry Zod inclus dans generateSiteSpec).
  const engineSheet = buildEngineSheet(sheet, prospectId, slug, imgs, opts.baseUrl);
  const llm: SpecLlmCall =
    opts.llm ??
    ((p) =>
      geminiCompleteStep({
        system: p.system,
        user: p.user,
        maxTokens: p.maxTokens,
        temperature: p.temperature,
        jsonMode: p.jsonMode,
        timeoutMs: opts.timeoutMs ?? 40_000,
        deadlineMs: opts.deadlineMs ?? 48_000,
      }));
  const spec = await generateSiteSpec(engineSheet, { llm });

  // 3. Rendu déterministe + images locales (base64) réattachées au bundle.
  const bundle: Record<string, string> = { ...renderFullSite(spec, engineSheet), ...(imgs.files ?? {}) };
  return { html: bundle["index.html"] ?? "", bundle, spec, engine: "site-engine" };
}
