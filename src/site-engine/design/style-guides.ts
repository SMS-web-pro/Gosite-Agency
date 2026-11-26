import {
  HERO_VARIANTS,
  MOTION_LEVELS,
  PALETTE_MODES,
  STYLE_GUIDE_IDS,
  type SiteSpec,
} from "../site-spec.schema";

export { HERO_VARIANTS, MOTION_LEVELS, PALETTE_MODES, STYLE_GUIDE_IDS };

export type StyleGuideId = (typeof STYLE_GUIDE_IDS)[number];
export type HeroVariant = (typeof HERO_VARIANTS)[number];
export type MotionLevel = (typeof MOTION_LEVELS)[number];
export type PaletteMode = "guide" | "brand";

export type StyleGuide = {
  id: StyleGuideId;
  label: string;
  promptBrief: string;
  palette: SiteSpec["palette"];
  fontPairing: SiteSpec["fontPairing"];
  borderRadius: SiteSpec["borderRadius"];
  defaultHero: HeroVariant;
  allowedHeroes: readonly HeroVariant[];
  defaultMotion: MotionLevel;
  css: string;
};

const CRAFT_CSS = `
html[data-guide="craft-scrapbook"] {
  --guide-paper: color-mix(in srgb, var(--color-bg) 84%, var(--color-text-light) 16%);
  --guide-rule: color-mix(in srgb, var(--color-text) 18%, transparent);
  --guide-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
  --color-on-accent: #FFFDF8;
  --color-accent-ui: color-mix(in srgb, var(--color-accent) 85%, var(--color-text));
}
html[data-guide="craft-scrapbook"] body {
  background-color: var(--color-bg);
}
html[data-guide="craft-scrapbook"] .section {
  background-color: var(--color-bg);
  background-image: radial-gradient(color-mix(in srgb, var(--color-text) 13%, transparent) 0.65px, transparent 0.65px);
  background-size: 8px 8px;
}
html[data-guide="craft-scrapbook"] .section-alt {
  background-color: color-mix(in srgb, var(--color-bg) 84%, var(--color-accent) 16%);
}
html[data-guide="craft-scrapbook"] .section-head h2,
html[data-guide="craft-scrapbook"] .hero-immersive h1 {
  font-style: italic;
  font-weight: 600;
  letter-spacing: -0.025em;
}
html[data-guide="craft-scrapbook"] .hero-eyebrow,
html[data-guide="craft-scrapbook"] .hero-kicker {
  font-family: var(--guide-mono);
  color: var(--color-accent);
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
html[data-guide="craft-scrapbook"] .btn {
  border: 1px solid var(--color-text);
  box-shadow: 3px 3px 0 var(--guide-rule);
}
html[data-guide="craft-scrapbook"] .chips li {
  border: 1px solid var(--guide-rule);
  border-radius: var(--radius-sm);
  background: var(--guide-paper);
}
html[data-guide="craft-scrapbook"] .service-card,
html[data-guide="craft-scrapbook"] .testimonial-card {
  border: 1px solid var(--guide-rule);
  border-radius: var(--radius-sm);
  box-shadow: 6px 6px 0 var(--guide-rule);
  background: var(--guide-paper);
}
html[data-guide="craft-scrapbook"] .service-card:nth-child(even) {
  transform: rotate(0.4deg);
}
html[data-guide="craft-scrapbook"] .service-card:nth-child(odd) {
  transform: rotate(-0.35deg);
}
html[data-guide="craft-scrapbook"] .faq-item,
html[data-guide="craft-scrapbook"] .contact-form {
  border: 1px solid var(--guide-rule);
  background: var(--guide-paper);
}
html[data-guide="craft-scrapbook"] .hero-immersive-media {
  border: 8px solid var(--guide-paper);
  box-shadow: 12px 12px 0 color-mix(in srgb, var(--color-text) 18%, transparent);
}
html[data-guide="craft-scrapbook"] [data-hero="collage"] .hero-immersive-inner {
  max-width: 760px;
}
`;

const BRUTALIST_CSS = `
html[data-guide="ai-brutalist"] {
  --guide-line: color-mix(in srgb, var(--color-text) 88%, transparent);
  --guide-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
  --color-on-accent: #11110F;
}
html[data-guide="ai-brutalist"] body {
  background-color: var(--color-bg);
}
html[data-guide="ai-brutalist"] .section {
  background-color: var(--color-bg);
}
html[data-guide="ai-brutalist"] .section-alt {
  background-color: var(--color-primary);
  color: var(--color-text-light);
}
html[data-guide="ai-brutalist"] .section-alt .section-sub,
html[data-guide="ai-brutalist"] .section-alt .para {
  color: color-mix(in srgb, var(--color-text-light) 74%, transparent);
}
html[data-guide="ai-brutalist"] .section-head h2,
html[data-guide="ai-brutalist"] .hero-immersive h1 {
  text-transform: uppercase;
  letter-spacing: -0.045em;
  font-weight: 700;
}
html[data-guide="ai-brutalist"] .hero-eyebrow,
html[data-guide="ai-brutalist"] .hero-kicker {
  font-family: var(--guide-mono);
  border: 2px solid currentColor;
  padding: 0.35rem 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
html[data-guide="ai-brutalist"] .btn {
  border: 2px solid var(--color-text);
  border-radius: 0;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  box-shadow: 5px 5px 0 var(--color-accent);
}
html[data-guide="ai-brutalist"] .chips li {
  border: 2px solid currentColor;
  border-radius: 0;
  background: transparent;
}
html[data-guide="ai-brutalist"] .service-card,
html[data-guide="ai-brutalist"] .process-card,
html[data-guide="ai-brutalist"] .testimonial-card,
html[data-guide="ai-brutalist"] .faq-item,
html[data-guide="ai-brutalist"] .contact-form {
  border: 2px solid var(--guide-line);
  border-radius: 0;
  box-shadow: none;
  background: color-mix(in srgb, var(--color-bg) 92%, var(--color-accent) 8%);
}
html[data-guide="ai-brutalist"] .site-header {
  border-bottom: 2px solid var(--color-text);
  box-shadow: none;
}
html[data-guide="ai-brutalist"] .hero-immersive-media img {
  filter: grayscale(1) contrast(1.08);
}
html[data-guide="ai-brutalist"] [data-hero="brutalist"] .hero-immersive-inner {
  border-left: 10px solid var(--color-accent);
  padding-left: clamp(1rem, 4vw, 3rem);
}
`;

const CALENDLY_CSS = `
html[data-guide="calendly-navy"] {
  --guide-card: color-mix(in srgb, var(--color-bg) 72%, var(--color-text-light) 28%);
  --guide-line: color-mix(in srgb, var(--color-primary) 14%, transparent);
  --color-on-accent: #FFFFFF;
}
html[data-guide="calendly-navy"] body {
  background-color: var(--color-bg);
}
html[data-guide="calendly-navy"] .section {
  background-color: var(--color-bg);
}
html[data-guide="calendly-navy"] .section-alt {
  background-color: color-mix(in srgb, var(--color-bg) 78%, var(--color-primary) 22%);
}
html[data-guide="calendly-navy"] .section-head h2,
html[data-guide="calendly-navy"] .hero-immersive h1 {
  letter-spacing: -0.035em;
  font-weight: 700;
}
html[data-guide="calendly-navy"] .hero-eyebrow,
html[data-guide="calendly-navy"] .hero-kicker {
  color: var(--color-accent);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
}
html[data-guide="calendly-navy"] .btn {
  border: 1px solid var(--guide-line);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--color-primary) 18%, transparent);
}
html[data-guide="calendly-navy"] .chips li {
  border: 1px solid var(--guide-line);
  background: var(--guide-card);
}
html[data-guide="calendly-navy"] .service-card,
html[data-guide="calendly-navy"] .process-card,
html[data-guide="calendly-navy"] .testimonial-card,
html[data-guide="calendly-navy"] .value-card {
  border: 1px solid var(--guide-line);
  background: var(--guide-card);
  box-shadow: 0 18px 44px color-mix(in srgb, var(--color-primary) 11%, transparent);
}
html[data-guide="calendly-navy"] .faq-item {
  border: 1px solid var(--guide-line);
  background: var(--guide-card);
}
html[data-guide="calendly-navy"] .site-header {
  background: color-mix(in srgb, var(--color-bg) 82%, transparent);
  border-bottom: 1px solid var(--guide-line);
}
html[data-guide="calendly-navy"] .hero-immersive-media img {
  border-radius: var(--radius-lg);
}
html[data-guide="calendly-navy"] [data-hero="immersive-full"] .hero-immersive-inner {
  max-width: 920px;
}
`;

const AWESOMIC_CSS = `
html[data-guide="awesomic-grid"] {
  --guide-grid: color-mix(in srgb, var(--color-text) 11%, transparent);
  --guide-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
  --color-on-accent: #151515;
}
html[data-guide="awesomic-grid"] body {
  background-color: var(--color-bg);
}
html[data-guide="awesomic-grid"] .section {
  background-color: var(--color-bg);
  background-image:
    linear-gradient(var(--guide-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--guide-grid) 1px, transparent 1px);
  background-size: 40px 40px;
}
html[data-guide="awesomic-grid"] .section-alt {
  background-color: color-mix(in srgb, var(--color-bg) 86%, var(--color-accent) 14%);
}
html[data-guide="awesomic-grid"] .section-head h2 {
  font-size: clamp(2.4rem, 5vw, 4.8rem);
  line-height: 0.96;
  letter-spacing: -0.055em;
  text-transform: uppercase;
}
html[data-guide="awesomic-grid"] .hero-immersive h1 {
  font-size: clamp(2.8rem, 7vw, 6.4rem);
  line-height: 0.9;
  letter-spacing: -0.06em;
  text-transform: uppercase;
}
html[data-guide="awesomic-grid"] .hero-eyebrow,
html[data-guide="awesomic-grid"] .hero-kicker {
  font-family: var(--guide-mono);
  color: var(--color-accent);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
html[data-guide="awesomic-grid"] .btn {
  border: 1px solid var(--color-text);
  border-radius: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
html[data-guide="awesomic-grid"] .chips li {
  border: 1px solid var(--guide-grid);
  border-radius: 0;
}
html[data-guide="awesomic-grid"] .service-card,
html[data-guide="awesomic-grid"] .process-card,
html[data-guide="awesomic-grid"] .testimonial-card,
html[data-guide="awesomic-grid"] .faq-item {
  border: 1px solid var(--guide-grid);
  border-radius: 0;
  background: color-mix(in srgb, var(--color-bg) 94%, var(--color-text-light) 6%);
}
html[data-guide="awesomic-grid"] .service-card {
  border-top: 4px solid var(--color-accent);
}
html[data-guide="awesomic-grid"] .site-header {
  border-bottom: 1px solid var(--guide-grid);
  background: color-mix(in srgb, var(--color-bg) 90%, transparent);
}
html[data-guide="awesomic-grid"] .hero-immersive-media img {
  filter: saturate(0.82) contrast(1.08);
}
html[data-guide="awesomic-grid"] [data-hero="brutalist"] .hero-immersive-inner {
  align-self: flex-end;
}
`;

const INTERVIEWS_CSS = `
html[data-guide="interviews-editorial"] {
  --guide-rule: color-mix(in srgb, var(--color-text) 16%, transparent);
  --guide-warm: color-mix(in srgb, var(--color-bg) 88%, var(--color-accent) 12%);
  --color-on-accent: #14201F;
}
html[data-guide="interviews-editorial"] body {
  background-color: var(--color-bg);
}
html[data-guide="interviews-editorial"] .section {
  background-color: var(--color-bg);
}
html[data-guide="interviews-editorial"] .section-alt {
  background-color: var(--guide-warm);
}
html[data-guide="interviews-editorial"] .section-head {
  border-top: 1px solid var(--guide-rule);
  padding-top: var(--space-md);
}
html[data-guide="interviews-editorial"] .section-head h2,
html[data-guide="interviews-editorial"] .hero-immersive h1 {
  font-style: italic;
  font-weight: 500;
  letter-spacing: -0.02em;
}
html[data-guide="interviews-editorial"] .hero-eyebrow,
html[data-guide="interviews-editorial"] .hero-kicker {
  color: var(--color-accent);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}
html[data-guide="interviews-editorial"] .btn {
  border: 1px solid var(--color-text);
  box-shadow: none;
}
html[data-guide="interviews-editorial"] .chips li {
  border: 0;
  border-bottom: 1px solid var(--guide-rule);
  border-radius: 0;
  background: transparent;
}
html[data-guide="interviews-editorial"] .service-card,
html[data-guide="interviews-editorial"] .process-card,
html[data-guide="interviews-editorial"] .testimonial-card,
html[data-guide="interviews-editorial"] .faq-item {
  border: 0;
  border-bottom: 1px solid var(--guide-rule);
  border-radius: 0;
  box-shadow: none;
  background: transparent;
}
html[data-guide="interviews-editorial"] .service-card {
  padding-left: var(--space-md);
  border-left: 2px solid var(--color-accent);
}
html[data-guide="interviews-editorial"] .site-header {
  background: color-mix(in srgb, var(--color-bg) 92%, transparent);
  border-bottom: 1px solid var(--guide-rule);
}
html[data-guide="interviews-editorial"] .hero-immersive-media {
  border-radius: 0;
  clip-path: inset(0 0 0 8%);
}
html[data-guide="interviews-editorial"] [data-hero="editorial-split"] .hero-immersive-inner {
  max-width: 620px;
}
`;

const OFFICEVIBE_CSS = `
html[data-guide="officevibe-playful"] {
  --guide-card: color-mix(in srgb, var(--color-bg) 76%, var(--color-text-light) 24%);
  --guide-line: color-mix(in srgb, var(--color-primary) 12%, transparent);
  --color-on-accent: #1C2340;
}
html[data-guide="officevibe-playful"] body {
  background-color: var(--color-bg);
}
html[data-guide="officevibe-playful"] .section {
  background-color: var(--color-bg);
  background-image:
    radial-gradient(circle at 8% 12%, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent 26%),
    radial-gradient(circle at 92% 78%, color-mix(in srgb, var(--color-primary) 13%, transparent), transparent 30%);
}
html[data-guide="officevibe-playful"] .section-alt {
  background-color: color-mix(in srgb, var(--color-bg) 82%, var(--color-primary) 18%);
}
html[data-guide="officevibe-playful"] .section-head h2,
html[data-guide="officevibe-playful"] .hero-immersive h1 {
  letter-spacing: -0.03em;
  font-weight: 700;
}
html[data-guide="officevibe-playful"] .hero-eyebrow,
html[data-guide="officevibe-playful"] .hero-kicker {
  color: var(--color-accent);
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
html[data-guide="officevibe-playful"] .btn {
  border: 0;
  border-radius: var(--radius-full);
  box-shadow: 0 12px 28px color-mix(in srgb, var(--color-primary) 20%, transparent);
}
html[data-guide="officevibe-playful"] .chips li {
  border: 0;
  border-radius: var(--radius-full);
  background: var(--guide-card);
}
html[data-guide="officevibe-playful"] .service-card,
html[data-guide="officevibe-playful"] .process-card,
html[data-guide="officevibe-playful"] .testimonial-card,
html[data-guide="officevibe-playful"] .faq-item,
html[data-guide="officevibe-playful"] .contact-form {
  border: 0;
  border-radius: var(--radius-lg);
  background: var(--guide-card);
  box-shadow: 0 18px 40px color-mix(in srgb, var(--color-primary) 10%, transparent);
}
html[data-guide="officevibe-playful"] .service-card:nth-child(2n) {
  transform: rotate(-0.6deg);
}
html[data-guide="officevibe-playful"] .service-card:nth-child(3n) {
  transform: rotate(0.5deg);
}
html[data-guide="officevibe-playful"] .icon-badge,
html[data-guide="officevibe-playful"] .service-icon {
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-accent) 20%, var(--guide-card));
  color: var(--color-primary);
}
html[data-guide="officevibe-playful"] .site-header {
  border-bottom: 1px solid var(--guide-line);
  background: color-mix(in srgb, var(--color-bg) 86%, transparent);
}
html[data-guide="officevibe-playful"] [data-hero="collage"] .hero-immersive-media {
  border-radius: 42% 58% 54% 46% / 44% 42% 58% 56%;
}
`;

const BASIS_CSS = `
html[data-guide="basis-technical"] {
  --guide-grid: color-mix(in srgb, var(--color-primary) 10%, transparent);
  --guide-glow: color-mix(in srgb, var(--color-accent) 26%, transparent);
  --guide-mono: ui-monospace, "SFMono-Regular", Consolas, monospace;
  --color-on-accent: #082C2B;
}
html[data-guide="basis-technical"] body {
  background-color: var(--color-bg);
}
html[data-guide="basis-technical"] .section {
  background-color: var(--color-bg);
  background-image:
    linear-gradient(var(--guide-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--guide-grid) 1px, transparent 1px);
  background-size: 32px 32px;
}
html[data-guide="basis-technical"] .section-alt {
  background-color: color-mix(in srgb, var(--color-bg) 88%, var(--color-accent) 12%);
}
html[data-guide="basis-technical"] .section-head h2,
html[data-guide="basis-technical"] .hero-immersive h1 {
  letter-spacing: -0.04em;
  font-weight: 600;
}
html[data-guide="basis-technical"] .hero-eyebrow,
html[data-guide="basis-technical"] .hero-kicker {
  font-family: var(--guide-mono);
  color: var(--color-accent);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
html[data-guide="basis-technical"] .btn {
  border: 1px solid var(--color-primary);
  border-radius: 0;
  box-shadow: 0 0 24px var(--guide-glow);
}
html[data-guide="basis-technical"] .chips li {
  border: 1px solid var(--guide-grid);
  border-radius: 0;
  background: color-mix(in srgb, var(--color-bg) 92%, var(--color-accent) 8%);
}
html[data-guide="basis-technical"] .service-card,
html[data-guide="basis-technical"] .process-card,
html[data-guide="basis-technical"] .testimonial-card,
html[data-guide="basis-technical"] .faq-item,
html[data-guide="basis-technical"] .contact-form {
  border: 1px solid var(--guide-grid);
  border-radius: 0;
  background: color-mix(in srgb, var(--color-bg) 94%, var(--color-primary) 6%);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--color-accent) 22%, transparent);
}
html[data-guide="basis-technical"] .service-card::before,
html[data-guide="basis-technical"] .process-card::before {
  content: "";
  position: absolute;
  top: 10px;
  right: 10px;
  width: 6px;
  height: 6px;
  background: var(--color-accent);
  box-shadow: 0 0 14px var(--guide-glow);
}
html[data-guide="basis-technical"] .site-header {
  border-bottom: 1px solid var(--guide-grid);
  background: color-mix(in srgb, var(--color-bg) 86%, transparent);
}
html[data-guide="basis-technical"] .hero-immersive-media {
  clip-path: polygon(0 0, 100% 0, 100% 94%, 94% 100%, 0 100%);
}
html[data-guide="basis-technical"] .hero-immersive-media img {
  filter: saturate(0.72) contrast(1.1);
}
html[data-guide="basis-technical"] [data-hero="technical"] .hero-immersive-inner {
  border-left: 1px solid var(--color-accent);
  padding-left: clamp(1rem, 3vw, 2rem);
}
`;

export const STYLE_GUIDES: Record<StyleGuideId, StyleGuide> = {
  "craft-scrapbook": {
    id: "craft-scrapbook",
    label: "Craft Scrapbook",
    promptBrief: "papier crème, collage, notes punaisées, labels mono, chaleur artisanale",
    palette: {
      primary: "#1E2A44",
      accent: "#C3653F",
      neutralBg: "#F3EEE3",
      textDark: "#1E2A44",
      textLight: "#FFFDF8",
    },
    fontPairing: "fraunces+manrope",
    borderRadius: "soft",
    defaultHero: "collage",
    allowedHeroes: ["collage", "immersive-full", "editorial-split"],
    defaultMotion: "balanced",
    css: CRAFT_CSS,
  },
  "ai-brutalist": {
    id: "ai-brutalist",
    label: "AI Brutalist",
    promptBrief: "off-black, lime, gros grotesk, bordures 2 px, contraste frontal",
    palette: {
      primary: "#11110F",
      accent: "#D6FF4B",
      neutralBg: "#F4F0E6",
      textDark: "#11110F",
      textLight: "#F4F0E6",
    },
    fontPairing: "space-grotesk+inter",
    borderRadius: "sharp",
    defaultHero: "brutalist",
    allowedHeroes: ["brutalist", "immersive-full"],
    defaultMotion: "expressive",
    css: BRUTALIST_CSS,
  },
  "calendly-navy": {
    id: "calendly-navy",
    label: "Calendly Navy",
    promptBrief: "navy premium, bleu, panneaux doux, cartes flottantes, confiance B2B",
    palette: {
      primary: "#0B1F3A",
      accent: "#2F6FED",
      neutralBg: "#F4F7FB",
      textDark: "#0B1F3A",
      textLight: "#FFFFFF",
    },
    fontPairing: "inter+cabinet",
    borderRadius: "rounded",
    defaultHero: "immersive-full",
    allowedHeroes: ["immersive-full", "editorial-split"],
    defaultMotion: "balanced",
    css: CALENDLY_CSS,
  },
  "awesomic-grid": {
    id: "awesomic-grid",
    label: "Awesomic Grid",
    promptBrief: "zinc, grille visible, orange brûlé, titres surdimensionnés, énergie studio",
    palette: {
      primary: "#151515",
      accent: "#D95D2B",
      neutralBg: "#F1F1EE",
      textDark: "#151515",
      textLight: "#FFFFFF",
    },
    fontPairing: "archivo+inter",
    borderRadius: "sharp",
    defaultHero: "brutalist",
    allowedHeroes: ["brutalist", "immersive-full"],
    defaultMotion: "expressive",
    css: AWESOMIC_CSS,
  },
  "interviews-editorial": {
    id: "interviews-editorial",
    label: "Interviews Editorial",
    promptBrief: "blanc chaud, teal profond, serif, asymétrie, filets fins, ton magazine",
    palette: {
      primary: "#0D4F4A",
      accent: "#C97B5A",
      neutralBg: "#FAF8F2",
      textDark: "#14201F",
      textLight: "#FFFFFF",
    },
    fontPairing: "playfair+source",
    borderRadius: "soft",
    defaultHero: "editorial-split",
    allowedHeroes: ["editorial-split", "immersive-full"],
    defaultMotion: "subtle",
    css: INTERVIEWS_CSS,
  },
  "officevibe-playful": {
    id: "officevibe-playful",
    label: "Officevibe Playful",
    promptBrief: "crème, cobalt, corail, blobs, cartes arrondies, ton humain et joyeux",
    palette: {
      primary: "#2340D8",
      accent: "#FF6B5A",
      neutralBg: "#FFF6E8",
      textDark: "#1C2340",
      textLight: "#FFFFFF",
    },
    fontPairing: "poppins+inter",
    borderRadius: "pill",
    defaultHero: "collage",
    allowedHeroes: ["collage", "immersive-full", "editorial-split"],
    defaultMotion: "expressive",
    css: OFFICEVIBE_CSS,
  },
  "basis-technical": {
    id: "basis-technical",
    label: "Basis Technical",
    promptBrief: "blanc froid, aqua, grille technique, glow contenu, labels mono, précision",
    palette: {
      primary: "#082C2B",
      accent: "#0FB5A6",
      neutralBg: "#F8FBFB",
      textDark: "#082C2B",
      textLight: "#FFFFFF",
    },
    fontPairing: "space-grotesk+inter",
    borderRadius: "sharp",
    defaultHero: "technical",
    allowedHeroes: ["technical", "immersive-full"],
    defaultMotion: "subtle",
    css: BASIS_CSS,
  },
};

export function allowedHero(guideId: StyleGuideId, hero: HeroVariant): boolean {
  return STYLE_GUIDES[guideId].allowedHeroes.includes(hero);
}

export function applyDesignToSpec(spec: SiteSpec): SiteSpec {
  const design = spec.design;
  if (!design) return spec;

  const guide = STYLE_GUIDES[design.styleGuide];
  const hero = allowedHero(design.styleGuide, design.hero) ? design.hero : guide.defaultHero;

  return {
    ...spec,
    palette: design.paletteMode === "brand" ? { ...spec.palette } : { ...guide.palette },
    fontPairing: guide.fontPairing,
    borderRadius: guide.borderRadius,
    design: { ...design, hero },
  };
}

const ON_ACCENT_INK = "#11110F";

function linearChannel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  return 0.2126 * linearChannel(hex, 1) + 0.7152 * linearChannel(hex, 3) + 0.0722 * linearChannel(hex, 5);
}

function onAccent(accent: string): string {
  const luminance = relativeLuminance(accent);
  const white = 1.05 / (luminance + 0.05);
  const ink = (luminance + 0.05) / (relativeLuminance(ON_ACCENT_INK) + 0.05);
  return white >= ink ? "#FFFFFF" : ON_ACCENT_INK;
}

export function styleGuideCSS(spec: SiteSpec): string {
  if (!spec.design) return "";
  const css = STYLE_GUIDES[spec.design.styleGuide].css;
  if (spec.design.paletteMode !== "brand") return css;
  return `${css}
html[data-guide="${spec.design.styleGuide}"]{--color-accent-ui:var(--color-accent);--color-on-accent:${onAccent(spec.palette.accent)}}`;
}

export function styleGuidesPrompt(): string {
  const guides = STYLE_GUIDE_IDS.map((id) => {
    const g = STYLE_GUIDES[id];
    return `- ${g.id} (${g.label}) : ${g.promptBrief}. Hero autorisés : ${g.allowedHeroes.join(", ")}. Motion : ${g.defaultMotion}.`;
  }).join("\n");

  return `STYLE GUIDES — choisis exactement UN SEUL guide, aucune mixture :
${guides}

DESIGN OBLIGATOIRE :
- design.styleGuide = un id ci-dessus, adapté au métier, au positionnement et à la niche.
- design.hero = une variante autorisée pour ce guide.
- design.motion = "subtle" | "balanced" | "expressive", cohérent avec l'énergie du guide.
- design.paletteMode = "guide" par défaut ; "brand" uniquement si le client impose explicitement ses couleurs.
- hero.style = "immersive" et secondaryCta obligatoire.`;
}
