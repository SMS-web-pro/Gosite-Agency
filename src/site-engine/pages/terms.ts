import type { LegalPage, SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";
import { renderLegalPage } from "./legal";

export function renderTermsPage(
  page: LegalPage,
  spec: SiteSpec,
  sheet: ClientSheet,
  css: string,
  baseUrl: string,
): string {
  return renderLegalPage(page, "terms", spec, sheet, css, baseUrl);
}
