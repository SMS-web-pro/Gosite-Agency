import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { sectionOpen } from "../common/ui";

type Process = Extract<HomeSection, { type: "process" }>;

export function processIcons(section: Process, _sheet: ClientSheet, _spec: SiteSpec): string {
  return `${sectionOpen("section-process", "process")}
  <div class="container">
    <div class="section-head reveal">
      <h2>${escapeHtml(section.title)}</h2>
    </div>
    <div class="process-icons">
      ${section.steps
        .map(
          (s, n) => `<article class="process-icon-step reveal">
        <span class="process-icon" aria-hidden="true">${n + 1}</span>
        <h3>${escapeHtml(s.title)}</h3>
        <p>${escapeHtml(s.desc)}</p>
      </article>`,
        )
        .join("\n      ")}
    </div>
  </div>
</section>`;
}
