import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { imgTag, paragraphs, sectionOpen } from "../common/ui";

type About = Extract<HomeSection, { type: "about" }>;

export function aboutHighlights(section: About, sheet: ClientSheet, _spec: SiteSpec): string {
  return `${sectionOpen("section-about", "about")}
  <div class="container about-grid">
    <div class="about-copy reveal">
      <h2>${escapeHtml(section.title)}</h2>
      ${paragraphs(section.paragraphs)}
      <div class="highlights">
        ${section.highlights
          .map(
            (h) => `<div class="highlight">
          <span class="highlight-value">${escapeHtml(h.value)}</span>
          <span class="highlight-label">${escapeHtml(h.label)}</span>
        </div>`,
          )
          .join("\n        ")}
      </div>
    </div>
    <div class="about-media reveal">${imgTag(sheet.ABOUT_IMAGE_URL, sheet.BUSINESS_NAME ?? "")}</div>
  </div>
</section>`;
}
