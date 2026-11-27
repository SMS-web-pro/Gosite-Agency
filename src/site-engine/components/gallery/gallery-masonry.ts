import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { galleryImages, imgTag, sectionOpen } from "../common/ui";

type Gallery = Extract<HomeSection, { type: "gallery" }>;

/** Image de galerie pour l'index n — repli sur le dégradé du parent. */
function figure(caption: string, src: string | undefined, cls: string): string {
  return `<figure class="gallery-item ${cls} reveal">
        ${imgTag(src, caption)}
        <figcaption>${escapeHtml(caption)}</figcaption>
      </figure>`;
}

export function galleryMasonry(section: Gallery, sheet: ClientSheet, _spec: SiteSpec): string {
  const imgs = galleryImages(sheet);
  return `${sectionOpen("section-gallery", "gallery")}
  <div class="container">
    <div class="section-head reveal">
      <h2>${escapeHtml(section.title)}</h2>
    </div>
    <div class="gallery-masonry">
      ${section.captions.map((c, i) => figure(c, imgs[i % Math.max(1, imgs.length)], "gallery-masonry-item")).join("\n      ")}
    </div>
  </div>
</section>`;
}
