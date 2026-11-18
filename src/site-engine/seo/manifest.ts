import type { SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";

/** site.webmanifest — l'icône SVG est ajoutée au bundle en Phase 7 (assets). */
export function generateManifest(sheet: ClientSheet, spec: SiteSpec): string {
  const name = sheet.BUSINESS_NAME || "Site";
  return JSON.stringify(
    {
      name,
      short_name: name.slice(0, 12),
      description: sheet.TAGLINE || spec.metaDescription,
      lang: spec.lang,
      dir: spec.dir,
      start_url: "/",
      display: "standalone",
      background_color: spec.palette.neutralBg,
      theme_color: spec.palette.primary,
    },
    null,
    2,
  );
}
