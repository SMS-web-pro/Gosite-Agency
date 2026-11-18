import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { ctaExtra, ctaHref } from "../common/ui";

type Hero = Extract<HomeSection, { type: "hero" }>;

function heroActions(section: Hero, sheet: ClientSheet): string {
  const sec = section.secondaryCta;
  return `<div class="hero-actions">
      <a class="btn btn-accent" href="${escapeHtml(ctaHref(section.primaryCta.action, sheet))}"${ctaExtra(section.primaryCta.action)}>${escapeHtml(section.primaryCta.label)}</a>
      ${sec ? `<a class="btn btn-ghost" href="${sec.action === "scroll" ? "#services" : "#about"}">${escapeHtml(sec.label)}</a>` : ""}
    </div>`;
}

export function heroCentered(section: Hero, sheet: ClientSheet, _spec: SiteSpec): string {
  return `<section class="hero hero-centered">
  <div class="container hero-centered-inner reveal">
    <p class="hero-kicker">${escapeHtml(sheet.NICHE_LABEL ?? "")}</p>
    <h1>${escapeHtml(section.headline)}</h1>
    <p class="hero-sub">${escapeHtml(section.subheadline)}</p>
    <ul class="chips chips-center">${section.chips.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
    ${heroActions(section, sheet)}
  </div>
</section>`;
}
