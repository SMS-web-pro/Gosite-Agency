// Couche 2 (spec refonte 2.5) — design system CSS.
// generateThemeCSS produit les custom properties (palette, typographie,
// espacements, rayons, ombres, transitions) consommées par base.css et
// components.css. Module pur : aucune dépendance réseau.

import type { SiteSpec } from "../site-spec.schema";

type FontDef = { heading: string; body: string; hrefs: string[] };

const google = (families: string): string =>
  `https://fonts.googleapis.com/css2?${families}&display=swap`;

const FONT_MAP: Record<SiteSpec["fontPairing"], FontDef> = {
  "inter+cabinet": {
    heading: "'Cabinet Grotesk', sans-serif",
    body: "'Inter', sans-serif",
    // Cabinet Grotesk n'est pas sur Google Fonts : Fontshare + Google.
    hrefs: [
      "https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700,800&display=swap",
      google("family=Inter:wght@400;500;600"),
    ],
  },
  "playfair+source": {
    heading: "'Playfair Display', serif",
    body: "'Source Sans 3', sans-serif",
    hrefs: [google("family=Playfair+Display:wght@500;600;700&family=Source+Sans+3:wght@400;500;600")],
  },
  "poppins+inter": {
    heading: "'Poppins', sans-serif",
    body: "'Inter', sans-serif",
    hrefs: [google("family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600")],
  },
  "dm-serif+dm-sans": {
    heading: "'DM Serif Display', serif",
    body: "'DM Sans', sans-serif",
    hrefs: [google("family=DM+Serif+Display&family=DM+Sans:wght@400;500;700")],
  },
  "rubik+karla": {
    heading: "'Rubik', sans-serif",
    body: "'Karla', sans-serif",
    hrefs: [google("family=Rubik:wght@500;600;700&family=Karla:wght@400;500;700")],
  },
  "lora+nunito": {
    heading: "'Lora', serif",
    body: "'Nunito', sans-serif",
    hrefs: [google("family=Lora:wght@500;600;700&family=Nunito:wght@400;500;700")],
  },
  "montserrat+opensans": {
    heading: "'Montserrat', sans-serif",
    body: "'Open Sans', sans-serif",
    hrefs: [google("family=Montserrat:wght@500;600;700&family=Open+Sans:wght@400;500;600")],
  },
};

/** URLs des feuilles de style à poser dans le <head> pour cette pairing. */
export function fontHrefs(pairing: SiteSpec["fontPairing"]): string[] {
  return FONT_MAP[pairing].hrefs;
}

const RADIUS_MAP: Record<SiteSpec["borderRadius"], { sm: string; md: string; lg: string }> = {
  sharp: { sm: "2px", md: "4px", lg: "6px" },
  soft: { sm: "4px", md: "8px", lg: "12px" },
  rounded: { sm: "8px", md: "12px", lg: "20px" },
  pill: { sm: "12px", md: "20px", lg: "9999px" },
};

/** "#112233" -> "17, 34, 51" (pour rgba(var(--color-…-rgb), α)). */
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const int = Number.parseInt(n, 16);
  if (!Number.isFinite(int)) return "0, 0, 0";
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`;
}

export function generateThemeCSS(
  palette: SiteSpec["palette"],
  fontPairing: SiteSpec["fontPairing"],
  borderRadius: SiteSpec["borderRadius"],
): string {
  const fonts = FONT_MAP[fontPairing];
  const radius = RADIUS_MAP[borderRadius];

  return `
:root {
  /* Palette */
  --color-primary: ${palette.primary};
  --color-accent: ${palette.accent};
  --color-bg: ${palette.neutralBg};
  --color-text: ${palette.textDark};
  --color-text-light: ${palette.textLight};
  --color-primary-rgb: ${hexToRgb(palette.primary)};
  --color-accent-rgb: ${hexToRgb(palette.accent)};

  /* Typography */
  --font-heading: ${fonts.heading};
  --font-body: ${fonts.body};
  --font-size-base: clamp(1rem, 0.95rem + 0.25vw, 1.125rem);
  --font-size-h1: clamp(2rem, 1.5rem + 2.5vw, 3.5rem);
  --font-size-h2: clamp(1.5rem, 1.2rem + 1.5vw, 2.25rem);
  --font-size-h3: clamp(1.15rem, 1rem + 0.75vw, 1.5rem);
  --line-height-body: 1.65;
  --line-height-heading: 1.15;

  /* Spacing */
  --space-xs: 0.5rem;
  --space-sm: 1rem;
  --space-md: 2rem;
  --space-lg: 4rem;
  --space-xl: 6rem;
  --section-padding: clamp(3rem, 5vw, 6rem) clamp(1rem, 5vw, 3rem);

  /* Borders */
  --radius-sm: ${radius.sm};
  --radius-md: ${radius.md};
  --radius-lg: ${radius.lg};
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 30px rgba(0,0,0,0.12);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms ease;

  /* Container */
  --container-max: 1200px;
  --container-narrow: 800px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`;
}
