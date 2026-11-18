import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { iconBadge, sectionOpen } from "../common/ui";

type Services = Extract<HomeSection, { type: "services" }>;

export function servicesGrid2(section: Services, _sheet: ClientSheet, _spec: SiteSpec): string {
  return `${sectionOpen("section-services", "services")}
  <div class="container">
    <div class="section-head reveal">
      <h2>${escapeHtml(section.title)}</h2>
      ${section.subtitle ? `<p class="section-sub">${escapeHtml(section.subtitle)}</p>` : ""}
    </div>
    <div class="services-grid services-grid-2">
      ${section.items
        .map(
          (i) => `<article class="service-card service-card-wide reveal">
        ${iconBadge(i.title)}
        <div class="service-card-body">
          <h3><a href="services/${escapeHtml(i.slug)}.html">${escapeHtml(i.title)}</a></h3>
          <p>${escapeHtml(i.shortDesc)}</p>
        </div>
        <a class="service-arrow" href="services/${escapeHtml(i.slug)}.html" aria-label="${escapeHtml(i.title)}">&#8594;</a>
      </article>`,
        )
        .join("\n      ")}
    </div>
  </div>
</section>`;
}
