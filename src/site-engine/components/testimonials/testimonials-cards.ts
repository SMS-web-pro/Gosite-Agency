import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { labels } from "../../utils/labels";
import { sectionOpen, stars } from "../common/ui";

type Testimonials = Extract<HomeSection, { type: "testimonials" }>;

export function testimonialsCards(section: Testimonials, _sheet: ClientSheet, spec: SiteSpec): string {
  const L = labels(spec.lang);
  return `${sectionOpen("section-testimonials", "reviews")}
  <div class="container">
    <div class="section-head reveal">
      <h2>${escapeHtml(section.title)}</h2>
    </div>
    <div class="testimonials-grid">
      ${section.items
        .map(
          (i) => `<figure class="testimonial-card reveal">
        ${stars(i.rating, L.starsOutOf)}
        <blockquote><p>“${escapeHtml(i.text)}”</p></blockquote>
        <figcaption>
          <span class="testimonial-name">${escapeHtml(i.name)}</span>
          ${i.role ? `<span class="testimonial-role">${escapeHtml(i.role)}</span>` : ""}
        </figcaption>
      </figure>`,
        )
        .join("\n      ")}
    </div>
  </div>
</section>`;
}
