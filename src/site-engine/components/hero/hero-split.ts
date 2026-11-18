import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { ctaExtra, ctaHref, imgTag } from "../common/ui";

type Hero = Extract<HomeSection, { type: "hero" }>;

function heroActions(section: Hero, sheet: ClientSheet): string {
  const sec = section.secondaryCta;
  return `<div class="hero-actions">
      <a class="btn btn-accent" href="${escapeHtml(ctaHref(section.primaryCta.action, sheet))}"${ctaExtra(section.primaryCta.action)}>${escapeHtml(section.primaryCta.label)}</a>
      ${sec ? `<a class="btn btn-ghost" href="${sec.action === "scroll" ? "#services" : "#about"}">${escapeHtml(sec.label)}</a>` : ""}
    </div>`;
}

export function heroSplit(section: Hero, sheet: ClientSheet, _spec: SiteSpec): string {
  return `<section class="hero hero-split">
  <div class="container hero-grid">
    <div class="hero-copy reveal">
      <h1>${escapeHtml(section.headline)}</h1>
      <p class="hero-sub">${escapeHtml(section.subheadline)}</p>
      <ul class="chips">${section.chips.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
      ${heroActions(section, sheet)}
    </div>
    <div class="hero-media reveal">${imgTag(sheet.HERO_IMAGE_URL, sheet.BUSINESS_NAME ?? "", { eager: true })}</div>
  </div>
</section>`;
}
