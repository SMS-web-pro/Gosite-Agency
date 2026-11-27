import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { labels } from "../../utils/labels";
import { ctaExtra, ctaHref, imgTag } from "../common/ui";

type Hero = Extract<HomeSection, { type: "hero" }>;

export function heroImmersive(section: Hero, sheet: ClientSheet, spec: SiteSpec): string {
  const sec = section.secondaryCta;
  const eyebrow = section.eyebrow || sheet.NICHE_LABEL;
  const variant = spec.design?.hero ?? "immersive-full";
  const secondaryHref = sec ? (sec.action === "scroll" ? "#services" : "#about") : "";

  return `<section class="hero hero-immersive" data-hero="${escapeHtml(variant)}">
  <div class="hero-immersive-media" data-hero-media>
    ${imgTag(sheet.HERO_IMAGE_URL, sheet.BUSINESS_NAME ?? "", { eager: true })}
    <div class="hero-immersive-overlay" aria-hidden="true"></div>
  </div>
  <div class="container hero-immersive-inner">
    ${eyebrow ? `<p class="hero-eyebrow reveal" data-hero-item data-anim>${escapeHtml(eyebrow)}</p>` : ""}
    <h1 class="reveal" data-hero-item data-anim>${escapeHtml(section.headline)}</h1>
    <p class="hero-sub reveal" data-hero-item data-anim>${escapeHtml(section.subheadline)}</p>
    <ul class="chips reveal" data-hero-item data-anim>${section.chips.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
    <div class="hero-actions reveal" data-hero-item data-anim>
      <a class="btn btn-accent" href="${escapeHtml(ctaHref(section.primaryCta.action, sheet))}"${ctaExtra(section.primaryCta.action)}>${escapeHtml(section.primaryCta.label)}</a>
      ${sec ? `<a class="btn btn-glass" href="${secondaryHref}">${escapeHtml(sec.label)}</a>` : ""}
    </div>
    <a class="hero-scroll-cue reveal" href="#services" aria-label="${escapeHtml(labels(spec.lang).navServices)}" data-anim>
      <span aria-hidden="true">&#8595;</span>
    </a>
  </div>
</section>`;
}
