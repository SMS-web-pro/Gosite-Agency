// Phase 8 (spec 2.7) — intégration du moteur SiteSpec au pipeline de
// production : fiche + images locales → SiteSpec (LLM validé Zod) → bundle
// 100% déterministe (renderFullSite). Le legacy buildSiteBundle reste le repli
// du pipeline si le LLM échoue ou dépasse son budget.

import { geminiCompleteStep } from "./gemini";
import { findNiche } from "./niches";
import { pickSeededImages } from "./images";
import { downloadImages, type ImageSlot } from "./bundle-images";
import { generateSiteSpec, type SpecLlmCall } from "../site-engine/generate-spec";
import { renderFullSite } from "../site-engine/render";
import type { SiteSpec } from "../site-engine/site-spec.schema";
import type { ClientSheet } from "../site-engine/types";
import { applyImagePack, resolveImages } from "../site-engine/images/stock-resolver";

/** Marqueur présent dans le <head> de toutes les pages du moteur v7 —
 *  partagé avec isStaleSiteBundle (bundle.ts) : un bundle v7 n'est jamais
 *  considéré comme obsolète par les marqueurs v6. */
export const ENGINE_MARKER = 'name="generator" content="gosite-site-engine/v7"';

export type EngineImages = { hero: string | null; about: string | null; gallery: string[] };

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
  const abs = (p: string | null): string => (p ? `${base}/${p.replace(/^\/+/, "")}` : "");
  const niche = findNiche(sheet.BUSINESS_TYPE ?? "");
  const isEn = (sheet.LANG || "fr").startsWith("en");

  return {
    ...sheet,
    SLUG: slug,
    DOMAIN: base,
    PHONE_LINK: sheet.PHONE_LINK || sheet.PHONE || "",
    FORM_ACTION: `https://gosite.digital/api/site-form/${prospectId}`,
    NICHE_LABEL: sheet.NICHE_LABEL || (isEn ? niche.labelEn : niche.label),
    ...(imgs.hero ? { HERO_IMAGE_URL: abs(imgs.hero) } : {}),
    ...(imgs.about ? { ABOUT_IMAGE_URL: abs(imgs.about) } : {}),
    ...(imgs.gallery.length ? { GALLERY_IMAGE_URLS: imgs.gallery.map(abs).join("|") } : {}),
    OG_IMAGE_URL: `${base}/og-image.svg`,
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
  return {
    hero: b["images/hero.jpg"] ? "images/hero.jpg" : null,
    about: b["images/about.jpg"] ? "images/about.jpg" : null,
    gallery,
  };
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
  const imgs = imagesFromBundle(existingBundle);
  const engineSheet = buildEngineSheet(sheet, prospectId, slug, imgs, baseUrl);
  const bundle = renderFullSite(spec, engineSheet);
  for (const [k, v] of Object.entries(existingBundle ?? {})) {
    if (k.startsWith("images/") && v) bundle[k] = v;
  }
  return bundle;
}

/** Build v7 : images locales (v6) → SiteSpec (LLM) → bundle SiteSpec.
 *  Échec du LLM = throw : le pipeline repart sur buildSiteBundle (legacy). */
export async function buildSiteV7(
  sheet: ClientSheet,
  prospectId: number,
  opts: EngineBuildOpts
): Promise<EngineBuild> {
  const { slug } = opts;

  // 1. Images : même pool de niche que le legacy (seed nom+ville) ; aucun
  //    téléchargement impossible → pack R2 déterministe (spec 2.6).
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
  const imgs = await downloadImages(slots, opts.fetchImpl);
  const hasLocal = Boolean(imgs.hero || imgs.about || imgs.gallery.length);
  const baseSheet = hasLocal ? sheet : applyImagePack({ ...sheet }, resolveImages(sheet.BUSINESS_TYPE));

  // 2. Fiche moteur + SiteSpec validé (retry Zod inclus dans generateSiteSpec).
  const engineSheet = buildEngineSheet(baseSheet, prospectId, slug, imgs, opts.baseUrl);
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
  const bundle: Record<string, string> = { ...renderFullSite(spec, engineSheet), ...imgs.files };
  return { html: bundle["index.html"] ?? "", bundle, spec, engine: "site-engine" };
}
