import { z } from "zod";

// === Sections de la page d'accueil ===

const SectionHero = z.object({
  type: z.literal("hero"),
  headline: z.string().min(10).max(80),
  subheadline: z.string().min(20).max(200),
  primaryCta: z.object({
    label: z.string().max(30),
    action: z.enum(["call", "form", "whatsapp", "booking"]),
  }),
  secondaryCta: z.object({
    label: z.string().max(30),
    action: z.enum(["scroll", "link"]),
  }).optional(),
  chips: z.array(z.string().max(40)).min(3).max(6),
  style: z.enum(["split", "centered", "fullwidth-bg", "minimal"]),
});

const SectionServices = z.object({
  type: z.literal("services"),
  title: z.string().max(60),
  subtitle: z.string().max(120).optional(),
  layout: z.enum(["grid-3", "grid-2", "list", "cards-horizontal"]),
  items: z.array(z.object({
    title: z.string().max(50),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    shortDesc: z.string().max(120),
    icon: z.string().max(30),
  })).min(3).max(12),
});

const SectionProcess = z.object({
  type: z.literal("process"),
  title: z.string().max(60),
  steps: z.array(z.object({
    title: z.string().max(40),
    desc: z.string().max(100),
  })).min(3).max(6),
  layout: z.enum(["timeline", "numbered", "icons-row"]),
});

const SectionAbout = z.object({
  type: z.literal("about"),
  title: z.string().max(60),
  paragraphs: z.array(z.string().max(300)).min(1).max(4),
  highlights: z.array(z.object({
    value: z.string().max(10),
    label: z.string().max(30),
  })).min(2).max(4),
});

const SectionFaq = z.object({
  type: z.literal("faq"),
  title: z.string().max(60),
  items: z.array(z.object({
    question: z.string().max(100),
    answer: z.string().max(400),
  })).min(4).max(10),
});

const SectionTestimonials = z.object({
  type: z.literal("testimonials"),
  title: z.string().max(60),
  items: z.array(z.object({
    name: z.string().max(30),
    role: z.string().max(40).optional(),
    text: z.string().max(200),
    rating: z.number().int().min(3).max(5),
  })).min(2).max(6),
});

const SectionGallery = z.object({
  type: z.literal("gallery"),
  title: z.string().max(60),
  captions: z.array(z.string().max(40)).min(4).max(8),
  layout: z.enum(["masonry", "grid-2x2", "slider", "fullwidth"]),
});

const SectionContact = z.object({
  type: z.literal("contact"),
  title: z.string().max(60),
  subtitle: z.string().max(120).optional(),
  formFields: z.array(z.enum(["name", "email", "phone", "message", "service-select"])).min(3),
  showMap: z.boolean(),
});

const SectionTrust = z.object({
  type: z.literal("trust"),
  title: z.string().max(60).optional(),
  items: z.array(z.object({
    value: z.string().max(10),
    label: z.string().max(30),
  })).min(3).max(5),
});

const HomeSectionSchema = z.discriminatedUnion("type", [
  SectionHero,
  SectionServices,
  SectionProcess,
  SectionAbout,
  SectionFaq,
  SectionTestimonials,
  SectionGallery,
  SectionContact,
  SectionTrust,
]);

// === Pages services détail ===

const ServicePageSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().max(60),
  metaDescription: z.string().max(160),
  heroSubtitle: z.string().max(200),
  paragraphs: z.array(z.string().max(400)).min(2).max(5),
  bullets: z.array(z.string().max(80)).min(3).max(8),
  cta: z.object({
    label: z.string().max(30),
    action: z.enum(["call", "form", "whatsapp", "booking"]),
  }),
  relatedServices: z.array(z.string()).min(1).max(3),
});

// === Page À Propos (dédiée) ===

const AboutPageSchema = z.object({
  metaTitle: z.string().max(60),
  metaDescription: z.string().max(160),
  story: z.array(z.string().max(400)).min(2).max(6),
  mission: z.string().max(300),
  values: z.array(z.object({
    title: z.string().max(30),
    desc: z.string().max(120),
  })).min(3).max(6),
  teamNote: z.string().max(200).optional(),
});

// === Pages légales ===

const LegalPageSchema = z.object({
  title: z.string().max(60),
  lastUpdated: z.string(),
  sections: z.array(z.object({
    heading: z.string().max(60),
    content: z.string().max(600),
  })).min(3).max(12),
});

// === SiteSpec complet ===

export const SiteSpecSchema = z.object({
  // Méta global
  lang: z.string().min(2).max(5),
  dir: z.enum(["ltr", "rtl"]),
  businessModel: z.enum([
    "contractor",    // plombier, électricien, peintre, etc.
    "membership",    // gym, club, école de musique, etc.
    "retail",        // boutique, magasin, e-commerce
    "restaurant",    // restaurant, café, boulangerie
    "professional",  // avocat, médecin, comptable, consultant
    "education",     // école, formation, centre de langues
    "wellness",      // spa, salon de beauté, coiffeur, barbier
    "automotive",    // garage, carwash, auto-école
  ]),

  // Design
  palette: z.object({
    primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    neutralBg: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    textDark: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    textLight: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  fontPairing: z.enum([
    "inter+cabinet",      // moderne, tech, clean
    "playfair+source",    // élégant, luxe, cabinet
    "poppins+inter",      // friendly, startup, accessible
    "dm-serif+dm-sans",   // editorial, storytelling
    "rubik+karla",        // bold, sport, énergie
    "lora+nunito",        // chaleureux, artisanal, boulangerie
    "montserrat+opensans",// corporate, professionnel
  ]),
  borderRadius: z.enum(["sharp", "soft", "rounded", "pill"]),

  // Contenu page d'accueil
  homeSections: z.array(HomeSectionSchema).min(5).max(10),

  // Pages
  servicePages: z.array(ServicePageSchema).min(3).max(12),
  aboutPage: AboutPageSchema,
  privacyPage: LegalPageSchema,
  termsPage: LegalPageSchema,

  // SEO global
  metaTitle: z.string().max(60),
  metaDescription: z.string().max(160),
  ogDescription: z.string().max(200),
});

export type SiteSpec = z.infer<typeof SiteSpecSchema>;
export type HomeSection = z.infer<typeof HomeSectionSchema>;
export type ServicePage = z.infer<typeof ServicePageSchema>;
export type AboutPage = z.infer<typeof AboutPageSchema>;
export type LegalPage = z.infer<typeof LegalPageSchema>;
