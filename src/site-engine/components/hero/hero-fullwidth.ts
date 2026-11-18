import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { ctaExtra, ctaHref, imgTag } from "../common/ui";

type Hero = Extract<HomeSection, { type: "hero" }>;

export function heroFullwidth(section: Hero, sheet: ClientSheet, _spec: SiteSpec): string {
  const sec = section.secondaryCta;
  return `<section class="hero hero-fullwidth">
  <div class="hero-bg">${imgTag(sheet.HERO_IMAGE_URL, "", { eager: true })}</div>
  <div class="hero-overlay"></div>
  <div class="container hero-fullwidth-inner reveal">
    <h1>${escapeHtml(section.headline)}</h1>
    <p class="hero-sub">${escapeHtml(section.subheadline)}</p>
    <ul class="chips chips-center">${section.chips.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
    <div class="hero-actions">
      <a class="btn btn-accent" href="${escapeHtml(ctaHref(section.primaryCta.action, sheet))}"${ctaExtra(section.primaryCta.action)}>${escapeHtml(section.primaryCta.label)}</a>
      ${sec ? `<a class="btn btn-glass" href="${sec.action === "scroll" ? "#services" : "#about"}">${escapeHtml(sec.label)}</a>` : ""}
    </div>
  </div>
</section>`;
}
