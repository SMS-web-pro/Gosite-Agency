import type { HomeSection, SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";
import { COMPONENT_REGISTRY } from "../components/registry";
import { renderHeader } from "../components/common/header";
import { renderFooter } from "../components/common/footer";
import { renderMobileBar } from "../components/common/mobile-bar";
import { wrapPage } from "./wrap";

/** Variante de rendu d'une section : layout, style, ou "default". */
function variantOf(section: HomeSection): string {
  switch (section.type) {
    case "hero":
      return section.style;
    case "services":
    case "process":
    case "gallery":
      return section.layout;
    default:
      return "default";
  }
}

/** Assemble toutes les sections de la home (sections inconnues ignorées). */
export function renderSections(spec: SiteSpec, sheet: ClientSheet): string {
  return spec.homeSections
    .map((section) => {
      const renderer = COMPONENT_REGISTRY[section.type]?.[variantOf(section)];
      if (!renderer) {
        console.warn(`[render] No renderer for ${section.type}/${variantOf(section)}, skipping`);
        return "";
      }
      return renderer(section, sheet, spec);
    })
    .filter(Boolean)
    .join("\n");
}

export function renderHomePage(spec: SiteSpec, sheet: ClientSheet, css: string, baseUrl: string): string {
  return wrapPage({
    title: spec.metaTitle,
    description: spec.metaDescription,
    ogDescription: spec.ogDescription,
    url: baseUrl,
    lang: spec.lang,
    dir: spec.dir,
    css,
    body: `${renderHeader(sheet, spec)}
<main id="main">
${renderSections(spec, sheet)}
</main>
${renderFooter(sheet, spec)}
${renderMobileBar(sheet, spec)}`,
    sheet,
    spec,
    jsonLd: true,
  });
}
