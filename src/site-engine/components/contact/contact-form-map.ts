import type { HomeSection, SiteSpec } from "../../site-spec.schema";
import type { ClientSheet } from "../../types";
import { escapeHtml, safeUrl } from "../../utils/escape";
import { labels } from "../../utils/labels";
import { formatAddress } from "../../utils/format-address";
import { formatPhone } from "../../utils/format-phone";
import { sectionOpen } from "../common/ui";

type Contact = Extract<HomeSection, { type: "contact" }>;

function field(f: Contact["formFields"][number], L: ReturnType<typeof labels>, services: string[]): string {
  if (f === "service-select") {
    return `<label class="form-field">
        <span>${escapeHtml(L.formService)}</span>
        <select name="service">
          <option value="">${escapeHtml(L.formChoose)}</option>
          ${services.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("\n          ")}
        </select>
      </label>`;
  }
  if (f === "message") {
    return `<label class="form-field form-field-full">
        <span>${escapeHtml(L.formMessage)}</span>
        <textarea name="message" rows="4" required></textarea>
      </label>`;
  }
  const map = {
    name: { label: L.formName, type: "text", required: true },
    email: { label: L.formEmail, type: "email", required: true },
    phone: { label: L.formPhone, type: "tel", required: false },
  }[f];
  return `<label class="form-field">
        <span>${escapeHtml(map.label)}</span>
        <input type="${map.type}" name="${f}"${map.required ? " required" : ""} autocomplete="${f === "name" ? "name" : f === "email" ? "email" : "tel"}">
      </label>`;
}

export function contactFormMap(section: Contact, sheet: ClientSheet, spec: SiteSpec): string {
  const L = labels(spec.lang);
  const action = /^https?:\/\//.test(sheet.FORM_ACTION ?? "") ? safeUrl(sheet.FORM_ACTION) : "#";
  const mapEmbed = section.showMap ? safeUrl(sheet.MAPS_EMBED) : "#";
  const services = spec.servicePages.map((s) => s.title);
  const address = formatAddress(sheet);
  const phoneText = formatPhone(sheet.PHONE, sheet.COUNTRY);

  return `${sectionOpen("section-contact", "contact")}
  <div class="container contact-grid">
    <div class="contact-copy reveal">
      <h2>${escapeHtml(section.title)}</h2>
      ${section.subtitle ? `<p class="section-sub">${escapeHtml(section.subtitle)}</p>` : ""}
      ${address ? `<p class="contact-line">${escapeHtml(address)}</p>` : ""}
      ${sheet.PHONE ? `<p class="contact-line"><a href="tel:${escapeHtml((sheet.PHONE_LINK ?? "").replace(/[^\d+]/g, ""))}">${escapeHtml(phoneText)}</a></p>` : ""}
      ${mapEmbed !== "#" ? `<div class="contact-map"><iframe src="${mapEmbed}" title="${escapeHtml(L.mapTitle)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ""}
    </div>
    <form class="contact-form reveal" method="post" action="${action}">
      <input type="text" name="website" class="hp-field" tabindex="-1" autocomplete="off" aria-hidden="true">
      ${section.formFields.map((f) => field(f, L, services)).join("\n      ")}
      <button type="submit" class="btn btn-accent btn-block">${escapeHtml(L.formSend)}</button>
    </form>
  </div>
</section>`;
}
