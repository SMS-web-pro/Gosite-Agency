import type { LegalPage, SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";
import { renderLegalPage } from "./legal";

export function renderPrivacyPage(
  page: LegalPage,
  spec: SiteSpec,
  sheet: ClientSheet,
  css: string,
  baseUrl: string,
): string {
  return renderLegalPage(page, "privacy", spec, sheet, css, baseUrl);
}
