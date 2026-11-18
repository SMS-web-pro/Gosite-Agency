import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { sectionOpen } from "../common/ui";

type Trust = Extract<HomeSection, { type: "trust" }>;

export function trustBar(section: Trust, _sheet: ClientSheet, _spec: SiteSpec): string {
  return `${sectionOpen("section-trust", "trust")}
  <div class="container">
    ${section.title ? `<p class="trust-title reveal">${escapeHtml(section.title)}</p>` : ""}
    <div class="trust-bar reveal">
      ${section.items
        .map(
          (i) => `<div class="trust-item">
        <span class="trust-value">${escapeHtml(i.value)}</span>
        <span class="trust-label">${escapeHtml(i.label)}</span>
      </div>`,
        )
        .join("\n      ")}
    </div>
  </div>
</section>`;
}
