import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { galleryImages, imgTag, sectionOpen } from "../common/ui";

type Gallery = Extract<HomeSection, { type: "gallery" }>;

/** grid-2x2 / slider / fullwidth partagent la grille — la classe varie. */
export function galleryGrid(section: Gallery, sheet: ClientSheet, _spec: SiteSpec): string {
  const imgs = galleryImages(sheet);
  const layoutClass =
    section.layout === "slider" ? "gallery-slider" : section.layout === "fullwidth" ? "gallery-full" : "gallery-grid-2x2";
  return `${sectionOpen("section-gallery", "gallery")}
  <div class="container${section.layout === "fullwidth" ? "" : ""}">
    <div class="section-head reveal">
      <h2>${escapeHtml(section.title)}</h2>
    </div>
    <div class="${layoutClass}">
      ${section.captions
        .map(
          (c, i) => `<figure class="gallery-item">
        ${imgTag(imgs[i % Math.max(1, imgs.length)], c)}
        <figcaption>${escapeHtml(c)}</figcaption>
      </figure>`,
        )
        .join("\n      ")}
    </div>
  </div>
</section>`;
}
