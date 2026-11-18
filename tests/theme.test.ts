import { generateThemeCSS, fontHrefs } from "./_lib/generate-theme.ts";
import { specFixture } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const palette = specFixture.palette;

// Palette + RGB
{
  const css = generateThemeCSS(palette, "inter+cabinet", "soft");
  check("primary custom property", css.includes("--color-primary: #112233;"));
  check("accent custom property", css.includes("--color-accent: #ff7a1a;"));
  check("bg + text + text-light", css.includes("--color-bg: #f6f8fc;") && css.includes("--color-text: #101828;") && css.includes("--color-text-light: #ffffff;"));
  check("primary-rgb calculé", css.includes("--color-primary-rgb: 17, 34, 51;"));
  check("accent-rgb calculé", css.includes("--color-accent-rgb: 255, 122, 26;"));
  check("aucun undefined", !css.includes("undefined"));
}

// Rayons
{
  const soft = generateThemeCSS(palette, "inter+cabinet", "soft");
  check("soft: 4/8/12", soft.includes("--radius-sm: 4px;") && soft.includes("--radius-md: 8px;") && soft.includes("--radius-lg: 12px;"));
  const sharp = generateThemeCSS(palette, "inter+cabinet", "sharp");
  check("sharp: 2/4/6", sharp.includes("--radius-sm: 2px;") && sharp.includes("--radius-md: 4px;") && sharp.includes("--radius-lg: 6px;"));
  const rounded = generateThemeCSS(palette, "inter+cabinet", "rounded");
  check("rounded: 8/12/20", rounded.includes("--radius-sm: 8px;") && rounded.includes("--radius-md: 12px;") && rounded.includes("--radius-lg: 20px;"));
  const pill = generateThemeCSS(palette, "inter+cabinet", "pill");
  check("pill: 12/20/9999", pill.includes("--radius-sm: 12px;") && pill.includes("--radius-md: 20px;") && pill.includes("--radius-lg: 9999px;"));
  check("radius-full constant", soft.includes("--radius-full: 9999px;"));
}

// Typographies
{
  const c1 = generateThemeCSS(palette, "inter+cabinet", "soft");
  check("inter+cabinet: heading Cabinet Grotesk", c1.includes("--font-heading: 'Cabinet Grotesk', sans-serif;"));
  check("inter+cabinet: body Inter", c1.includes("--font-body: 'Inter', sans-serif;"));
  const c2 = generateThemeCSS(palette, "playfair+source", "soft");
  check("playfair+source: stacks", c2.includes("--font-heading: 'Playfair Display', serif;") && c2.includes("--font-body: 'Source Sans 3', sans-serif;"));
  const c3 = generateThemeCSS(palette, "rubik+karla", "soft");
  check("rubik+karla: stacks", c3.includes("'Rubik'") && c3.includes("'Karla'"));
  const c4 = generateThemeCSS(palette, "lora+nunito", "soft");
  check("lora+nunito: stacks", c4.includes("'Lora'") && c4.includes("'Nunito'"));
  const c5 = generateThemeCSS(palette, "montserrat+opensans", "soft");
  check("montserrat+opensans: stacks", c5.includes("'Montserrat'") && c5.includes("'Open Sans'"));
  const c6 = generateThemeCSS(palette, "poppins+inter", "soft");
  check("poppins+inter: stacks", c6.includes("'Poppins'") && c6.includes("'Inter'"));
  const c7 = generateThemeCSS(palette, "dm-serif+dm-sans", "soft");
  check("dm-serif+dm-sans: stacks", c7.includes("'DM Serif Display'") && c7.includes("'DM Sans'"));
}

// URLs de polices
{
  const pairs = ["inter+cabinet", "playfair+source", "poppins+inter", "dm-serif+dm-sans", "rubik+karla", "lora+nunito", "montserrat+opensans"] as const;
  let allHttps = true;
  for (const p of pairs) {
    const hrefs = fontHrefs(p);
    if (hrefs.length === 0 || !hrefs.every((h) => h.startsWith("https://"))) allHttps = false;
  }
  check("7 pairings: hrefs https non vides", allHttps);
  check("inter+cabinet: 2 feuilles (fontshare + google)", fontHrefs("inter+cabinet").length === 2);
  check("inter+cabinet: fontshare cabinet-grotesk", fontHrefs("inter+cabinet")[0].includes("api.fontshare.com") && fontHrefs("inter+cabinet")[0].includes("cabinet-grotesk"));
  check("google css2 format", fontHrefs("rubik+karla")[0].startsWith("https://fonts.googleapis.com/css2?family=Rubik"));
}

// Tokens système
{
  const css = generateThemeCSS(palette, "inter+cabinet", "soft");
  check("clamp h1 présent", css.includes("--font-size-h1: clamp(2rem, 1.5rem + 2.5vw, 3.5rem);"));
  check("section-padding clamp", css.includes("--section-padding: clamp(3rem, 5vw, 6rem)"));
  check("ombres 3 niveaux", css.includes("--shadow-sm:") && css.includes("--shadow-md:") && css.includes("--shadow-lg:"));
  check("transitions 3 vitesses", css.includes("--transition-fast: 150ms ease;") && css.includes("--transition-base: 250ms ease;") && css.includes("--transition-slow: 400ms ease;"));
  check("containers", css.includes("--container-max: 1200px;") && css.includes("--container-narrow: 800px;"));
  check("prefers-reduced-motion", css.includes("@media (prefers-reduced-motion: reduce)") && css.includes("animation-duration: 0.01ms !important"));
  check("bloc :root", /:root \{[\s\S]*\}/.test(css));
}

process.exit(fail ? 1 : 0);
