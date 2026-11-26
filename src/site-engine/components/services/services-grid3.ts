import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { serviceIcon } from "../common/icons";
import { sectionOpen } from "../common/ui";

type Services = Extract<HomeSection, { type: "services" }>;

type Item = Services["items"][number];

export function serviceCard(item: Item, layout: string): string {
  return `<article class="service-card service-card-${layout} reveal">
        ${serviceIcon(item.icon, item.title)}
        <h3><a href="services/${escapeHtml(item.slug)}.html">${escapeHtml(item.title)}</a></h3>
        <p>${escapeHtml(item.shortDesc)}</p>
        <a class="service-arrow" href="services/${escapeHtml(item.slug)}.html" aria-label="${escapeHtml(item.title)}">&#8594;</a>
      </article>`;
}

export function servicesHead(section: Services): string {
  return `<div class="section-head reveal">
      <h2>${escapeHtml(section.title)}</h2>
      ${section.subtitle ? `<p class="section-sub">${escapeHtml(section.subtitle)}</p>` : ""}
    </div>`;
}

export function servicesGrid3(section: Services, _sheet: ClientSheet, _spec: SiteSpec): string {
  return `${sectionOpen("section-services", "services")}
  <div class="container">
    ${servicesHead(section)}
    <div class="services-grid services-grid-3">
      ${section.items.map((i) => serviceCard(i, "grid")).join("\n      ")}
    </div>
  </div>
</section>`;
}
