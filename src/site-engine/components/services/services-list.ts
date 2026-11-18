import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { sectionOpen } from "../common/ui";

type Services = Extract<HomeSection, { type: "services" }>;

export function servicesList(section: Services, _sheet: ClientSheet, _spec: SiteSpec): string {
  return `${sectionOpen("section-services", "services")}
  <div class="container">
    <div class="section-head reveal">
      <h2>${escapeHtml(section.title)}</h2>
      ${section.subtitle ? `<p class="section-sub">${escapeHtml(section.subtitle)}</p>` : ""}
    </div>
    <ul class="services-list">
      ${section.items
        .map(
          (i, n) => `<li class="services-list-item reveal">
        <span class="services-list-num" aria-hidden="true">${String(n + 1).padStart(2, "0")}</span>
        <div>
          <h3><a href="services/${escapeHtml(i.slug)}.html">${escapeHtml(i.title)}</a></h3>
          <p>${escapeHtml(i.shortDesc)}</p>
        </div>
      </li>`,
        )
        .join("\n      ")}
    </ul>
  </div>
</section>`;
}
