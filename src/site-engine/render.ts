import type { SiteSpec } from "./site-spec.schema";
import type { ClientSheet, SiteBundle } from "./types";
import { generateThemeCSS } from "./css/generate-theme";
import { BASE_CSS } from "./css/base";
import { COMPONENTS_CSS } from "./css/components";
import { applyDesignToSpec, styleGuideCSS } from "./design/style-guides";
import { renderHomePage } from "./pages/home";
import { renderServiceDetailPage } from "./pages/service-detail";
import { renderAboutPage } from "./pages/about";
import { renderPrivacyPage } from "./pages/privacy";
import { renderTermsPage } from "./pages/terms";
import { render404Page } from "./pages/not-found";
import { generateSitemap } from "./seo/sitemap";
import { generateRobots } from "./seo/robots";
import { generateManifest } from "./seo/manifest";
import { generateFavicon } from "./images/favicon-gen";
import { generateOgImage } from "./images/og-image-gen";

/** Base URL du site : domaine custom > URL déployée > sous-domaine slug. */
export function resolveBaseUrl(sheet: ClientSheet): string {
  for (const key of ["DOMAIN", "SITE_URL", "DEPLOY_URL"]) {
    const v = sheet[key];
    if (v && /^https?:\/\//i.test(v)) return v.replace(/\/+$/, "");
  }
  const slug = (sheet.SLUG ?? "").trim();
  return slug ? `https://${slug}.gosite.digital` : "";
}

/**
 * Point d'entrée du moteur : SiteSpec + fiche → bundle statique complet
 * (html/css/xml/txt/webmanifest/svg/vercel.json). Zéro LLM au rendu.
 */
export function renderFullSite(spec: SiteSpec, sheet: ClientSheet): SiteBundle {
  const themed = applyDesignToSpec(spec);
  const baseUrl = resolveBaseUrl(sheet);
  const themeCSS = generateThemeCSS(themed.palette, themed.fontPairing, themed.borderRadius);
  const guideCSS = styleGuideCSS(themed);
  const allCSS = `${BASE_CSS}\n${themeCSS}\n${COMPONENTS_CSS}\n${guideCSS}`;

  const bundle: SiteBundle = {};

  // Page d'accueil
  bundle["index.html"] = renderHomePage(themed, sheet, allCSS, baseUrl);

  // Pages services
  for (const sp of themed.servicePages) {
    bundle[`services/${sp.slug}.html`] = renderServiceDetailPage(sp, themed, sheet, allCSS, baseUrl);
  }

  // Pages fixes
  bundle["about.html"] = renderAboutPage(themed.aboutPage, themed, sheet, allCSS, baseUrl);
  bundle["privacy.html"] = renderPrivacyPage(themed.privacyPage, themed, sheet, allCSS, baseUrl);
  bundle["terms.html"] = renderTermsPage(themed.termsPage, themed, sheet, allCSS, baseUrl);
  bundle["404.html"] = render404Page(themed, sheet, allCSS, baseUrl);

  // SEO
  const pages = ["", "about", "privacy", "terms", ...themed.servicePages.map((s) => `services/${s.slug}`)];
  bundle["sitemap.xml"] = generateSitemap(baseUrl, pages);
  bundle["robots.txt"] = generateRobots(baseUrl);
  bundle["site.webmanifest"] = generateManifest(sheet, themed);

  // Assets déterministes
  bundle["favicon.svg"] = generateFavicon(sheet.BUSINESS_NAME, themed.palette.primary);
  bundle["og-image.svg"] = generateOgImage(sheet, themed);

  // Hébergement
  bundle["vercel.json"] = JSON.stringify({ cleanUrls: true }, null, 2);

  return bundle;
}
