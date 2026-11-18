import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml } from "../../utils/escape";
import { sectionOpen } from "../common/ui";

type Process = Extract<HomeSection, { type: "process" }>;

export function processTimeline(section: Process, _sheet: ClientSheet, _spec: SiteSpec): string {
  return `${sectionOpen("section-process", "process")}
  <div class="container">
    <div class="section-head reveal">
      <h2>${escapeHtml(section.title)}</h2>
    </div>
    <ol class="timeline">
      ${section.steps
        .map(
          (s, n) => `<li class="timeline-step reveal">
        <span class="timeline-dot" aria-hidden="true">${n + 1}</span>
        <div class="timeline-body">
          <h3>${escapeHtml(s.title)}</h3>
          <p>${escapeHtml(s.desc)}</p>
        </div>
      </li>`,
        )
        .join("\n      ")}
    </ol>
  </div>
</section>`;
}
