import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { ctaExtra, ctaHref } from "../common/ui";

type Hero = Extract<HomeSection, { type: "hero" }>;

export function heroMinimal(section: Hero, sheet: ClientSheet, _spec: SiteSpec): string {
  const sec = section.secondaryCta;
  return `<section class="hero hero-minimal">
  <div class="container hero-minimal-inner reveal">
    <h1>${escapeHtml(section.headline)}</h1>
    <p class="hero-sub">${escapeHtml(section.subheadline)}</p>
    <ul class="chips">${section.chips.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
    <div class="hero-actions">
      <a class="btn btn-primary" href="${escapeHtml(ctaHref(section.primaryCta.action, sheet))}"${ctaExtra(section.primaryCta.action)}>${escapeHtml(section.primaryCta.label)}</a>
      ${sec ? `<a class="btn btn-ghost" href="${sec.action === "scroll" ? "#services" : "#about"}">${escapeHtml(sec.label)}</a>` : ""}
    </div>
  </div>
</section>`;
}
