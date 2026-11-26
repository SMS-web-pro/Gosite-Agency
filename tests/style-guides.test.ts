import {
  MOTION_LEVELS,
  STYLE_GUIDE_IDS,
  STYLE_GUIDES,
  applyDesignToSpec,
  styleGuideCSS,
  styleGuidesPrompt,
} from "./_lib/style-guides.ts";
import { SiteSpecSchema } from "./_lib/site-spec.schema.ts";
import { specFixture } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const design = { styleGuide: "calendly-navy", hero: "immersive-full", motion: "balanced", paletteMode: "guide" } as const;
const premium = { ...specFixture, design };
const themed = applyDesignToSpec(premium);

check("7 guides", STYLE_GUIDE_IDS.length === 7 && new Set(STYLE_GUIDE_IDS).size === 7);
check("palettes 5 rôles", STYLE_GUIDE_IDS.every((id) => Object.values(STYLE_GUIDES[id].palette).every((v) => /^#[0-9a-f]{6}$/i.test(v))));
check("craft: Fraunces + Manrope", STYLE_GUIDES["craft-scrapbook"].fontPairing === "fraunces+manrope");
check("guides: défauts valides", STYLE_GUIDE_IDS.every((id) => {
  const g = STYLE_GUIDES[id];
  return g.allowedHeroes.includes(g.defaultHero) && MOTION_LEVELS.includes(g.defaultMotion);
}));
check("guides: couleur de texte accent définie", STYLE_GUIDE_IDS.every((id) => STYLE_GUIDES[id].css.includes("--color-on-accent:")));
check("design valide", SiteSpecSchema.safeParse(premium).success);
check("guide inconnu rejeté", !SiteSpecSchema.safeParse({ ...premium, design: { ...design, styleGuide: "nope" } }).success);
check("paletteMode inconnu rejeté", !SiteSpecSchema.safeParse({ ...premium, design: { ...design, paletteMode: "nope" } }).success);
check("mode guide", themed.palette.primary === "#0B1F3A" && themed.fontPairing === "inter+cabinet" && themed.borderRadius === "rounded");
check("mode brand", applyDesignToSpec({ ...premium, design: { ...design, paletteMode: "brand" } as const }).palette.primary === "#112233");
const brandCss = (accent: string) => styleGuideCSS({ ...premium, palette: { ...premium.palette, accent }, design: { ...design, paletteMode: "brand" as const } });
check("brand: texte sombre sur accent clair", brandCss("#FFE066").includes("--color-on-accent:#11110F"));
check("brand: texte clair sur accent sombre", brandCss("#0B1F3A").includes("--color-on-accent:#FFFFFF"));
check("brand: accent-ui = accent client", brandCss("#FFE066").includes("--color-accent-ui:var(--color-accent)"));
const craftGuide = styleGuideCSS({ ...premium, design: { ...design, styleGuide: "craft-scrapbook", hero: "collage" } });
check("guide: accent-ui artisanale conservée", craftGuide.includes("--color-accent-ui: color-mix(") && !craftGuide.includes("--color-accent-ui:var(--color-accent)"));
check("hero non autorisé → défaut", applyDesignToSpec({ ...premium, design: { ...design, hero: "technical" } as const }).design?.hero === "immersive-full");
check("legacy inchangé", applyDesignToSpec(specFixture) === specFixture);
check("CSS guide unique", styleGuideCSS(premium).includes('html[data-guide="calendly-navy"]') && !styleGuideCSS(premium).includes('html[data-guide="ai-brutalist"]'));
check("prompt complet", STYLE_GUIDE_IDS.every((id) => styleGuidesPrompt().includes(id)) && styleGuidesPrompt().includes("paletteMode"));

process.exit(fail ? 1 : 0);
