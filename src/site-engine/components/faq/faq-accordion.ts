import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { sectionOpen } from "../common/ui";

type Faq = Extract<HomeSection, { type: "faq" }>;

export function faqAccordion(section: Faq, _sheet: ClientSheet, _spec: SiteSpec): string {
  return `${sectionOpen("section-faq", "faq")}
  <div class="container container-narrow">
    <div class="section-head reveal">
      <h2>${escapeHtml(section.title)}</h2>
    </div>
    <div class="faq-list">
      ${section.items
        .map(
          (i) => `<details class="faq-item reveal">
        <summary>${escapeHtml(i.question)}</summary>
        <p>${escapeHtml(i.answer)}</p>
      </details>`,
        )
        .join("\n      ")}
    </div>
  </div>
</section>`;
}
