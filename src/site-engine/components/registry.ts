import type { HomeSection, SiteSpec } from "../site-spec.schema";
import type { ClientSheet } from "../types";

import { heroSplit } from "./hero/hero-split";
import { heroCentered } from "./hero/hero-centered";
import { heroFullwidth } from "./hero/hero-fullwidth";
import { heroMinimal } from "./hero/hero-minimal";
import { heroImmersive } from "./hero/hero-immersive";
import { servicesGrid3 } from "./services/services-grid3";
import { servicesGrid2 } from "./services/services-grid2";
import { servicesList } from "./services/services-list";
import { servicesCardsH } from "./services/services-cards-h";
import { processTimeline } from "./process/process-timeline";
import { processNumbered } from "./process/process-numbered";
import { processIcons } from "./process/process-icons";
import { aboutHighlights } from "./about/about-highlights";
import { faqAccordion } from "./faq/faq-accordion";
import { testimonialsCards } from "./testimonials/testimonials-cards";
import { galleryMasonry } from "./gallery/gallery-masonry";
import { galleryGrid } from "./gallery/gallery-grid";
import { contactFormMap } from "./contact/contact-form-map";
import { trustBar } from "./trust/trust-bar";

// Bivariance hack : chaque composant reçoit sa variante précise de HomeSection
// (Hero, Services…) tout en restant assignable au registre typé HomeSection.
export type SectionRenderer = {
  bivarianceHack(section: HomeSection, sheet: ClientSheet, spec: SiteSpec): string;
}["bivarianceHack"];

export const COMPONENT_REGISTRY: Record<string, Record<string, SectionRenderer>> = {
  hero: {
    split: heroSplit,
    centered: heroCentered,
    "fullwidth-bg": heroFullwidth,
    minimal: heroMinimal,
    immersive: heroImmersive,
  },
  services: {
    "grid-3": servicesGrid3,
    "grid-2": servicesGrid2,
    list: servicesList,
    "cards-horizontal": servicesCardsH,
  },
  process: {
    timeline: processTimeline,
    numbered: processNumbered,
    "icons-row": processIcons,
  },
  about: { default: aboutHighlights },
  faq: { default: faqAccordion },
  testimonials: { default: testimonialsCards },
  gallery: {
    masonry: galleryMasonry,
    "grid-2x2": galleryGrid,
    slider: galleryGrid,
    fullwidth: galleryGrid,
  },
  contact: { default: contactFormMap },
  trust: { default: trustBar },
};
