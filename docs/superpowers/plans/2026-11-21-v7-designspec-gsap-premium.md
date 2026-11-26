# v7 Premium DesignSpec + GSAP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque nouveau site v7 reçoit l'une des 7 directions artistiques, un hero immersif et une couche GSAP/ScrollTrigger déterministe, sans casser le SEO multi-pages, les formulaires, les images locales ni les anciens specs.

**Architecture:** Le LLM choisit `design` (`styleGuide`, `hero`, `motion`, `paletteMode`) dans un `SiteSpec` validé. `applyDesignToSpec` normalise thème, police et rayons ; `renderFullSite` injecte le CSS d'un seul guide ; un renderer de hero et un script de motion communs appliquent le rendu. Aucun HTML/JS libre produit par le LLM.

**Tech Stack:** TypeScript, Zod 4, Node `--experimental-strip-types`, CSS custom properties, GSAP + ScrollTrigger 3.12.5 via CDN jsDelivr.

**Spec:** `docs/superpowers/specs/2026-11-21-v7-designspec-gsap-premium-design.md`

## Global Constraints

- Aucune dépendance npm ajoutée ; GSAP/ScrollTrigger restent des fichiers CDN `3.12.5`.
- Aucun fichier GSAP dans le bundle généré ; aucun appel réseau pendant `npm test`.
- `STYLE_GUIDE_IDS` : `craft-scrapbook`, `ai-brutalist`, `calendly-navy`, `awesomic-grid`, `interviews-editorial`, `officevibe-playful`, `basis-technical`.
- `HERO_VARIANTS` : `immersive-full`, `editorial-split`, `collage`, `brutalist`, `technical`.
- `paletteMode` : `"guide"` par défaut à la génération, `"brand"` uniquement sur demande client explicite.
- Le prompt de génération reste sous 12 000 tokens de sortie ; les 7 briefs doivent rester compacts.
- Zéro fait inventé, zéro image externe, zéro hotlink ; les images restent locales au bundle.
- Mobile 390 px : zéro scroll horizontal, cibles tactiles ≥ 44 px.
- `prefers-reduced-motion` et absence de JS : tout le contenu reste visible, aucune animation.
- Aucun scroll-jacking, pinning, curseur custom, marquee permanent ou transition de page.
- Anciens `SiteSpec` sans `design` : rendu strictement legacy, sans CSS guide ni GSAP.
- **Ne pas commiter ni déployer sans demande explicite de l'utilisateur.** Les étapes de commit sont volontairement absentes.
- Baseline avant travaux : 37/37 suites, `npm run typecheck` propre, lint 0 erreur.

## Review Focus

- **CDN indisponible ou bloqué** : après chargement, le hero et toutes les sections restent visibles ; le fallback local révèle le contenu. Testé dans `tests/motion.test.ts` et l'e2e navigateur.
- **`prefers-reduced-motion: reduce`** : aucune animation, contenu immédiatement visible. Testé dans `tests/motion.test.ts` + émulation CDP en Task 7.
- **Spec legacy sans `design`** : aucun attribut `data-guide`, aucun CSS guide, aucun script GSAP, aucun changement de palette. Testé dans `tests/style-guides.test.ts` et `tests/render-premium.test.ts`.
- **`design` invalide ou incohérent** : guide/hero inconnu rejeté par Zod ou hero remplacé par le défaut du guide ; jamais de `undefined` dans le HTML. Testé dans `tests/style-guides.test.ts`, `tests/site-spec.test.ts`, `tests/render-premium.test.ts`.
- **Mobile 390 px avec titre long, eyebrow long et deux CTA** : aucun débordement horizontal, boutons qui passent à la ligne. Testé par CDP dans Task 7.

## File Structure

| Fichier | Responsabilité |
|---|---|
| `src/site-engine/site-spec.schema.ts` | `DesignSpec`, IDs, `eyebrow`, hero `immersive`, 3 paires de polices |
| `src/site-engine/design/style-guides.ts` | Données des 7 guides, palettes, CSS, `applyDesignToSpec`, prompt |
| `src/site-engine/components/hero/hero-immersive.ts` | Markup du hero immersif, variantes `data-hero` |
| `src/site-engine/components/common/icons.ts` | SVG inline whitelist + fallback initiale |
| `src/site-engine/scripts/motion.ts` | `MOTION_SCRIPT` : GSAP, ScrollTrigger, fallback, reduced motion |
| `src/site-engine/render.ts` | Normalisation design, CSS guide, thème/SEO cohérents |
| `src/site-engine/pages/wrap.ts` | Attributs `data-guide`/`data-motion`, choix du script |
| `src/site-engine/components/common/seo-head.ts` | Preconnect + scripts CDN conditionnels |
| `src/site-engine/css/components.ts` | Hero immersif, variantes, header scrollé, icônes |
| `src/site-engine/generate-spec.ts` | Prompt des 7 guides, validation design, retry |
| `src/lib/coder-engine.ts` | Transmission `avoidStyles` |
| `src/lib/pipeline.ts` | Historique des guides récents |
| `src/lib/site-editor.ts` | Préservation de `design` en édition Support |
| `tests/spec-fixture.ts` | `specFixture` legacy + `premiumSpecFixture` |
| `tests/style-guides.test.ts` | Données, normalisation, palette, CSS |
| `tests/render-premium.test.ts` | Rendu guide, data attrs, SEO, legacy |
| `tests/motion.test.ts` | Garanties du script de motion |
| `scripts/test.mjs` | Copie des nouveaux modules dans `tests/_lib` |

---

### Task 1: DesignSpec, 7 guides, normalisation

**Files:**
- Modify: `src/site-engine/site-spec.schema.ts`
- Modify: `src/site-engine/css/generate-theme.ts`
- Create: `src/site-engine/design/style-guides.ts`
- Create: `tests/style-guides.test.ts`
- Modify: `scripts/test.mjs`

**Interfaces:**
- Produces: `STYLE_GUIDE_IDS`, `HERO_VARIANTS`, `MOTION_LEVELS`, `PALETTE_MODES`, `DesignSpecSchema`, `DesignSpec`.
- Produces: `StyleGuide`, `STYLE_GUIDES: Record<StyleGuideId, StyleGuide>`, `applyDesignToSpec(spec: SiteSpec): SiteSpec`, `styleGuideCSS(spec: SiteSpec): string`, `styleGuidesPrompt(): string`.
- Produces: `SiteSpec["design"]` optional ; `SectionHero.eyebrow?: string` ; `SectionHero.style` accepte `"immersive"` ; 3 nouvelles paires de polices.

- [ ] **Step 1: Write the failing test**

Créer `tests/style-guides.test.ts` avec les assertions suivantes :

```ts
const design = { styleGuide: "calendly-navy", hero: "immersive-full", motion: "balanced", paletteMode: "guide" } as const;
const premium = { ...specFixture, design };
const themed = applyDesignToSpec(premium);
check("7 guides", STYLE_GUIDE_IDS.length === 7 && new Set(STYLE_GUIDE_IDS).size === 7);
check("palettes 5 rôles", STYLE_GUIDE_IDS.every((id) => Object.values(STYLE_GUIDES[id].palette).every((v) => /^#[0-9a-f]{6}$/i.test(v))));
check("design valide", SiteSpecSchema.safeParse(premium).success);
check("guide inconnu rejeté", !SiteSpecSchema.safeParse({ ...premium, design: { ...design, styleGuide: "nope" } }).success);
check("paletteMode inconnu rejeté", !SiteSpecSchema.safeParse({ ...premium, design: { ...design, paletteMode: "nope" } }).success);
check("mode guide", themed.palette.primary === "#0B1F3A" && themed.fontPairing === "inter+cabinet" && themed.borderRadius === "rounded");
check("mode brand", applyDesignToSpec({ ...premium, design: { ...design, paletteMode: "brand" } as const }).palette.primary === "#112233");
check("hero non autorisé → défaut", applyDesignToSpec({ ...premium, design: { ...design, hero: "technical" } as const }).design?.hero === "immersive-full");
check("legacy inchangé", applyDesignToSpec(specFixture) === specFixture);
check("CSS guide unique", styleGuideCSS(premium).includes('html[data-guide="calendly-navy"]') && !styleGuideCSS(premium).includes('html[data-guide="ai-brutalist"]'));
check("prompt complet", STYLE_GUIDE_IDS.every((id) => styleGuidesPrompt().includes(id)) && styleGuidesPrompt().includes("paletteMode"));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL sur `tests/style-guides.test.ts` — module `./_lib/style-guides.ts` introuvable.

- [ ] **Step 3: Add schema and font pairings**

Dans `site-spec.schema.ts`, exporter les constantes et ajouter `design` optionnel. `SectionHero.eyebrow` est `z.string().max(48).optional()`. Ajouter les paires `fraunces+manrope`, `space-grotesk+inter`, `archivo+inter` dans `FONT_MAP` avec les URLs Google Fonts correspondantes.

- [ ] **Step 4: Implement `style-guides.ts`**

Créer les 7 entrées avec `promptBrief`, `palette` 5 rôles, `fontPairing`, `borderRadius`, `defaultHero`, `allowedHeroes`, `defaultMotion`, `css`. Respecter les palettes et signatures du spec §2. Les sélecteurs CSS commencent tous par `html[data-guide="<id>"]` et consomment les variables `--color-*`.

`applyDesignToSpec` : retourne l'objet inchangé si `design` absent ; sinon clone léger, force `fontPairing`/`borderRadius`, applique la palette du guide si `paletteMode !== "brand"`, et remplace un hero non autorisé par `defaultHero`. `styleGuideCSS` retourne `""` en legacy. `styleGuidesPrompt` produit une ligne compacte par guide.

- [ ] **Step 5: Register modules in the test runner**

Ajouter à `scripts/test.mjs` :

```ts
["design/style-guides.ts", "style-guides.ts"],
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test` puis `node --experimental-strip-types tests/style-guides.test.ts`
Expected: PASS ; `npm run typecheck` propre.

---

### Task 2: Hero immersif et icônes inline

**Files:**
- Create: `src/site-engine/components/hero/hero-immersive.ts`
- Create: `src/site-engine/components/common/icons.ts`
- Modify: `src/site-engine/components/registry.ts`
- Modify: `src/site-engine/components/services/services-grid3.ts`
- Modify: `src/site-engine/css/components.ts`
- Modify: `tests/render-components.test.ts`
- Modify: `scripts/test.mjs`

**Interfaces:**
- Produces: `heroImmersive(section: Hero, sheet: ClientSheet, spec: SiteSpec): string`.
- Produces: `serviceIcon(name: string, title: string): string` ; retourne toujours un span `aria-hidden="true"`, jamais de HTML utilisateur.
- Consumes: `spec.design?.hero` (fallback `"immersive-full"`), `imgTag`, `ctaHref`, `escapeHtml`.

- [ ] **Step 1: Write the failing tests**

Dans `tests/render-components.test.ts`, importer `heroImmersive` et `serviceIcon`, puis ajouter :

```ts
const premiumHero = { ...hero, style: "immersive" as const, eyebrow: "Plomberie premium" };
const hi = heroImmersive(premiumHero, sheet, { ...specFixture, design: { styleGuide: "calendly-navy", hero: "immersive-full", motion: "balanced", paletteMode: "guide" } as const });
check("hero-immersive: classe + variante", hi.includes('class="hero hero-immersive"') && hi.includes('data-hero="immersive-full"'));
check("hero-immersive: eyebrow", hi.includes("Plomberie premium"));
check("hero-immersive: 2 CTA", hi.includes("Appeler") && hi.includes("Services"));
check("hero-immersive: image eager", hi.includes('loading="eager"'));
check("hero-immersive: scroll services", hi.includes('href="#services"'));
check("hero-immersive: défaut sans design", heroImmersive(premiumHero, sheet, specFixture).includes('data-hero="immersive-full"'));
```

Remplacer l'assertion `services: badge initiale` par `serviceIcon` : icône connue → `<svg`, inconnue → initiale échappée. Ajouter `immersive` à la liste `hero` du registre attendu et vérifier `.hero-immersive` + `.service-icon` dans `COMPONENTS_CSS`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — imports `hero-immersive.ts` et `icons.ts` introuvables, puis registre incomplet.

- [ ] **Step 3: Implement icons and hero**

`icons.ts` : whitelist de 20 icônes utiles (`wrench`, `droplet`, `flame`, `dumbbell`, `user`, `users`, `scissors`, `sparkles`, `shield`, `clock`, `map-pin`, `phone`, `mail`, `leaf`, `car`, `home`, `heart`, `star`, `camera`, `briefcase`). Chaque SVG est 24x24, `fill="none"`, `stroke="currentColor"`, `aria-hidden="true"`. Fallback : initiale majuscule comme `iconBadge`.

`hero-immersive.ts` : structure `section.hero.hero-immersive` + `data-hero`, média en `imgTag(..., { eager: true })`, overlay `aria-hidden`, eyebrow optionnel (`section.eyebrow || sheet.NICHE_LABEL`), H1, sous-titre, chips, CTA primaire/secondaire, lien de scroll `#services` avec `aria-label` localisé. Ajouter `data-anim` aux blocs animés.

- [ ] **Step 4: Wire registry and icons**

Enregistrer `immersive: heroImmersive` dans `COMPONENT_REGISTRY.hero`. Utiliser `serviceIcon(item.icon, item.title)` dans `serviceCard`. Ne pas modifier `heroSplit` & co.

- [ ] **Step 5: Add CSS**

Dans `components.ts` : `.hero-immersive` plein écran (`min-height:max(620px,92svh)`), overlay dégradé, contenu bas, H1 `clamp(2.4rem,6vw,5.5rem)`, CTA wrap, indicateur de scroll. Variantes `[data-hero="editorial-split"]`, `[data-hero="collage"]`, `[data-hero="brutalist"]`, `[data-hero="technical"]`. Ajouter `.service-icon` (même gabarit que `.icon-badge`) et les règles `prefers-reduced-motion`.

- [ ] **Step 6: Register modules and verify**

Ajouter dans `scripts/test.mjs` :

```ts
["components/common/icons.ts", "icons.ts"],
["components/hero/hero-immersive.ts", "hero-immersive.ts"],
```

Run: `npm test` puis `npm run typecheck`
Expected: PASS.

---

### Task 3: Rendu premium, CSS guide, SEO cohérent

**Files:**
- Create: `tests/render-premium.test.ts`
- Modify: `tests/spec-fixture.ts`
- Modify: `src/site-engine/render.ts`
- Modify: `src/site-engine/pages/wrap.ts`
- Modify: `tests/site-spec.test.ts`

**Interfaces:**
- Consumes: `applyDesignToSpec`, `styleGuideCSS`.
- Produces: `premiumSpecFixture` valide, hero `immersive`, guide `calendly-navy`.
- Produces: HTML `<html ... data-guide="calendly-navy" data-motion="balanced">` quand `design` existe.

- [ ] **Step 1: Add the premium fixture and failing render test**

Dans `tests/spec-fixture.ts`, exporter :

```ts
export const premiumSpecFixture = {
  ...specFixture,
  design: { styleGuide: "calendly-navy" as const, hero: "immersive-full" as const, motion: "balanced" as const, paletteMode: "guide" as const },
  homeSections: specFixture.homeSections.map((s) => s.type === "hero" ? { ...s, style: "immersive" as const, eyebrow: "Plomberie premium" } : s),
};
```

Créer `tests/render-premium.test.ts` avec `renderFullSite(premiumSpecFixture, sheet)` et les assertions :

```ts
const bundle = renderFullSite(premiumSpecFixture, sheet);
const home = bundle["index.html"] ?? "";
check("html data attrs", home.includes('data-guide="calendly-navy"') && home.includes('data-motion="balanced"'));
check("CSS guide unique", home.includes('html[data-guide="calendly-navy"]') && !home.includes('html[data-guide="ai-brutalist"]'));
check("palette guide", home.includes("--color-primary: #0B1F3A;") && !home.includes("--color-primary: #112233;"));
check("police guide", home.includes("Inter") && home.includes("Cabinet Grotesk"));
check("hero immersif", home.includes("hero-immersive") && home.includes('data-hero="immersive-full"') && home.includes("Plomberie premium"));
check("theme-color + manifest", home.includes('name="theme-color" content="#0B1F3A"') && (bundle["site.webmanifest"] ?? "").includes('"theme_color":"#0B1F3A"'));
check("service page guide", (bundle["services/reparation-fuites.html"] ?? "").includes("data-guide=\"calendly-navy\""));
const brand = renderFullSite({ ...premiumSpecFixture, design: { ...premiumSpecFixture.design, paletteMode: "brand" as const } }, sheet);
check("mode brand", (brand["index.html"] ?? "").includes("--color-primary: #112233;"));
const legacy = renderFullSite(specFixture, sheet);
check("legacy sans guide", !(legacy["index.html"] ?? "").includes("data-guide=") && !(legacy["index.html"] ?? "").includes("html[data-guide="));
```

Ajouter aussi dans `tests/site-spec.test.ts` : `design` valide accepté, guide inconnu rejeté, `eyebrow` > 48 rejeté.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `premiumSpecFixture` absent ou pas de `data-guide`/CSS guide.

- [ ] **Step 3: Normalize and inject in `render.ts`**

En tête de `renderFullSite`, faire `const themed = applyDesignToSpec(spec);`. Utiliser `themed` pour `generateThemeCSS`, `allCSS`, toutes les pages, `generateFavicon`, `generateOgImage` et `generateManifest`. Ajouter `styleGuideCSS(themed)` après `COMPONENTS_CSS` pour que le guide gagne. Le spec stocké n'est jamais muté.

- [ ] **Step 4: Add data attributes in `wrapPage`**

Construire `data-guide`/`data-motion` uniquement si `opts.spec.design` existe, et les insérer dans la balise `<html>` après `dir`. Échapper les valeurs.

- [ ] **Step 5: Verify**

Run: `npm test` puis `npm run typecheck`
Expected: PASS, y compris `tests/render-site.test.ts` legacy.

---

### Task 4: Motion GSAP, fallback et reduced motion

**Files:**
- Create: `src/site-engine/scripts/motion.ts`
- Create: `tests/motion.test.ts`
- Modify: `src/site-engine/pages/wrap.ts`
- Modify: `src/site-engine/components/common/seo-head.ts`
- Modify: `src/site-engine/css/base.ts` or `src/site-engine/css/components.ts`
- Modify: `tests/render-premium.test.ts`
- Modify: `scripts/test.mjs`

**Interfaces:**
- Produces: `MOTION_SCRIPT: string`.
- Consumes: `spec.design` pour charger GSAP/ScrollTrigger et choisir `MOTION_SCRIPT` au lieu de `REVEAL_SCRIPT`.
- Produces: classe `.is-scrolled` sur `.site-header` après 24 px.

- [ ] **Step 1: Write the failing tests**

`tests/motion.test.ts` :

```ts
check("motion: sans pin", !MOTION_SCRIPT.includes("pin:"));
check("motion: reduced motion", MOTION_SCRIPT.includes("prefers-reduced-motion"));
check("motion: ScrollTrigger", MOTION_SCRIPT.includes("ScrollTrigger.batch") && MOTION_SCRIPT.includes("registerPlugin"));
check("motion: fallback visible", MOTION_SCRIPT.includes("is-visible") && MOTION_SCRIPT.includes("has-js"));
check("motion: lit data-motion", MOTION_SCRIPT.includes("data-motion"));
```

Dans `render-premium`, ajouter : tags `gsap.min.js` et `ScrollTrigger.min.js` en `3.12.5` avec `defer`, preconnect `cdn.jsdelivr.net`, `MOTION_SCRIPT` présent, pas de `REVEAL_SCRIPT` ; legacy : aucun script CDN et `IntersectionObserver` toujours présent.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `motion.ts` introuvable et aucun tag GSAP.

- [ ] **Step 3: Implement `MOTION_SCRIPT`**

Le script inline doit : ajouter `has-js` ; lire `data-motion` (`subtle|balanced|expressive`) ; lire `matchMedia("(prefers-reduced-motion: reduce)")` ; ajouter `.is-scrolled` au header selon `scrollY > 24` ; si `reduce`, GSAP ou ScrollTrigger absent → révéler tous les `.reveal` et `[data-anim]` et s'arrêter ; sinon `gsap.registerPlugin(ScrollTrigger)`, timeline du hero, `ScrollTrigger.batch` sur `.reveal`, stagger des cartes. Interdits : `pin`, `scrub` sur le document, `ScrollSmoother`, curseur custom.

- [ ] **Step 4: Wire head and page shell**

`seo-head.ts` ajoute, uniquement si `spec.design` : preconnect jsDelivr + les deux `<script ... defer>`. `wrapPage` choisit `spec.design ? MOTION_SCRIPT : REVEAL_SCRIPT`.

- [ ] **Step 5: Add CSS states**

Sous `html.has-js`, masquer initialement `.hero-immersive [data-anim]` puis les révéler via `.is-visible` ; sous `prefers-reduced-motion`, forcer `opacity:1; transform:none; transition:none`. Ajouter `.site-header.is-scrolled` (ombre/opacité contenue). Aucun `overflow-x` sur `html/body`.

- [ ] **Step 6: Register and verify**

Ajouter `["scripts/motion.ts", "motion.ts"]` à `scripts/test.mjs`.

Run: `npm test` puis `npm run typecheck`
Expected: PASS ; legacy inchangé.

---

### Task 5: Génération, validation et historique des guides

**Files:**
- Modify: `src/site-engine/generate-spec.ts`
- Modify: `src/lib/coder-engine.ts`
- Modify: `src/lib/pipeline.ts`
- Modify: `tests/generate-spec.test.ts`
- Modify: `tests/coder-engine.test.ts`
- Modify: `tests/no-clone.test.ts`

**Interfaces:**
- Produces: `generateSiteSpec(sheet, opts?: { llm?: SpecLlmCall; avoid?: string[]; avoidStyles?: string[] })`.
- Produces: `EngineBuildOpts.avoidStyles?: string[]` transmis à `generateSiteSpec`.
- Produces: `recentSiteHistory(): Promise<{ avoid: string[]; styleGuides: string[] }>` dans `pipeline.ts`.
- Consumes: `STYLE_GUIDES`, `allowedHero`, `styleGuidesPrompt`.

- [ ] **Step 1: Update tests first**

Dans `tests/generate-spec.test.ts`, importer `STYLE_GUIDE_IDS` depuis `./_lib/site-spec.schema.ts`, utiliser `premiumSpecFixture` pour `good`, `bad`, et les cas de retry. Conserver `specFixture` pour les tests legacy. Ajouter :

```ts
check("system: 7 guides", STYLE_GUIDE_IDS.every((id) => calls[0]?.system.includes(id)) && calls[0]?.system.includes("paletteMode"));
check("design manquant: retry", calls.length === 2 && calls[1]?.user.includes("design"));
check("hero non immersif: retry", calls.length === 2 && calls[1]?.user.includes("immersive"));
check("secondaryCta manquant: retry", calls.length === 2 && calls[1]?.user.includes("secondaryCta"));
check("hero non autorisé: retry", calls.length === 2 && calls[1]?.user.includes("non autorisé"));
await generateSiteSpec(specSheet, { llm: async (p) => { calls.push(p); return good; }, avoidStyles: ["craft-scrapbook", "basis-technical"] });
check("guides récents dans le prompt", calls[0]?.user.includes("craft-scrapbook") && calls[0]?.user.includes("basis-technical"));
```

Dans `coder-engine.test.ts`, `llmOk` retourne `premiumSpecFixture`. Ajouter une vérification `built.spec.design?.styleGuide === "calendly-navy"` et un appel avec `avoidStyles` capturant `p.user`. Dans `no-clone.test.ts`, `gymLlm` clone `premiumSpecFixture` et garde le hero `immersive`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — design absent accepté, `avoidStyles` inconnu, specs de test non conformes.

- [ ] **Step 3: Implement generation validation**

Remplacer la section DESIGN du system prompt par les 7 briefs de `styleGuidesPrompt()`. Exiger `design` complet, `hero.style === "immersive"`, `secondaryCta` présent, et `design.hero` autorisé par le guide. Ajouter les erreurs au même retry que les sections obligatoires. Le prompt user ajoute un bloc « STYLE GUIDES RÉCEMMENT UTILISÉS » quand `avoidStyles` est non vide.

- [ ] **Step 4: Thread `avoidStyles`**

`EngineBuildOpts` gagne `avoidStyles?: string[]` ; `buildSiteV7` le passe à `generateSiteSpec`.

- [ ] **Step 5: Track recent guides**

Remplacer `recentEditorialAvoid` par `recentSiteHistory` : même requête des 25 derniers specs, retourne aussi les `design.styleGuide` uniques. Mettre à jour les deux appelants (`buildProspectSite`, `regenerateDeployedSiteV7`) pour passer `{ avoid, avoidStyles: styleGuides }` à chaque build.

- [ ] **Step 6: Verify**

Run: `npm test` puis `npm run typecheck`
Expected: PASS ; `generate-spec`, `coder-engine`, `no-clone`.

---

### Task 6: Édition Support préserve le design

**Files:**
- Modify: `src/lib/site-editor.ts`
- Modify: `tests/site-editor.test.ts`

**Interfaces:**
- Consumes: `premiumSpecFixture`.
- Produces: toute édition d'un spec avec `design` restaure `current.design` si le LLM l'a supprimé ; une demande de couleur explicite peut conserver `paletteMode:"brand"`.

- [ ] **Step 1: Write the failing tests**

Importer `SiteSpec` depuis `./_lib/site-spec.schema.ts`, `premiumSpecFixture` depuis `./spec-fixture.ts`.

```ts
const premium = clone(premiumSpecFixture) as SiteSpec;
const noDesign = clone(premium) as SiteSpec;
delete (noDesign as { design?: unknown }).design;
const r = await editSiteSpec(premium, "Change la mission.", { llm: llmOnce({ updated: true, summary: "Mission", spec: noDesign }) });
check("edit: design restauré", r.spec.design?.styleGuide === "calendly-navy" && r.spec.design?.motion === "balanced");
const brand = clone(premium) as SiteSpec;
brand.design = { ...brand.design!, paletteMode: "brand" };
brand.palette.primary = "#123456";
const rb = await editSiteSpec(premium, "Utilise la couleur #123456.", { llm: llmOnce({ updated: true, summary: "Couleur", spec: brand }) });
check("edit: palette brand conservée", rb.spec.design?.paletteMode === "brand" && rb.spec.palette.primary === "#123456");
```

Ajouter aussi : sans `design` courant, le comportement actuel ne change pas.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `design` supprimé reste supprimé.

- [ ] **Step 3: Implement prompt + restoration**

Ajouter au system prompt : conservation de `design` et `paletteMode` sauf demande visuelle explicite ; couleur demandée → `paletteMode:"brand"` ; sinon ne pas toucher au design. Après chaque parse réussi, appliquer :

```ts
const withDesign = (s: SiteSpec): SiteSpec =>
  current.design && !s.design ? { ...s, design: current.design } : s;
```

Utiliser `withDesign(spec)` au retour. Ne pas écraser un design différent explicitement renvoyé par le LLM.

- [ ] **Step 4: Verify**

Run: `npm test` puis `npm run typecheck`
Expected: PASS ; tests Support existants inchangés.

---

### Task 7: e2e navigateur, non-régression et rapport

**Files:**
- Temp: `C:\Users\hp\AppData\Local\Temp\opencode\e2e-premium\build.mjs`
- Temp: `C:\Users\hp\AppData\Local\Temp\opencode\e2e-premium\server.mjs`
- Temp: `C:\Users\hp\AppData\Local\Temp\opencode\e2e-premium\shot.mjs`
- Modify: `docs/superpowers/specs/2026-11-21-v7-designspec-gsap-premium-design.md` (statut final uniquement)

**Interfaces:**
- Consumes: `buildSiteV7` depuis `tests/_lib/coder-engine.ts` et `premiumSpecFixture` depuis `tests/spec-fixture.ts`, avec LLM et fetch injectés (zéro Gemini).

- [ ] **Step 1: Build a deterministic browser bundle**

`build.mjs` importe aussi `specSheet`, construit `const sheet = { ...specSheet, PHONE_LINK: "+1 469-555-3810", SLUG: "atlas-premium" }`, puis appelle `buildSiteV7(sheet, 99001, { slug: "atlas-premium", llm: async () => JSON.stringify(premiumSpecFixture), fetchImpl: async () => new Response(Buffer.alloc(20_000, 7), { status: 200, headers: { "content-type": "image/webp" } }) })`. Écrire le bundle dans `site/` : décoder les clés `images/*` en base64, écrire le reste en UTF-8.

- [ ] **Step 2: Assert desktop and mobile behavior**

`server.mjs` sert `site/` sur `4175`. `shot.mjs` lance Chrome headless, puis vérifie via CDP :

```js
guide === "calendly-navy" && motion === "balanced"
document.querySelector(".hero-immersive")?.dataset.hero === "immersive-full"
document.documentElement.scrollWidth <= 390
après scroll complet : tous les .reveal ont opacity > 0
après scroll : .site-header a la classe is-scrolled
```

Captures : `desktop-full.png`, `mobile-top.png`, `mobile-contact.png`. Vérifier l'ancre `#contact` sans chevauchement du header.

- [ ] **Step 3: Assert reduced motion and CDN fallback**

Émuler `prefers-reduced-motion: reduce`, recharger : `getComputedStyle` du hero `[data-anim]` → `opacity: "1"`, `transform: "none"`. Simuler le CDN bloqué (`Network.setBlockedURLs` pour `cdn.jsdelivr.net`) et recharger : aucun contenu masqué, aucune erreur JS bloquante. Désactiver JavaScript (`Emulation.setScriptExecutionDisabled`) et recharger : hero, sections et formulaire visibles, aucun `.reveal` bloqué à `opacity:0`.

- [ ] **Step 4: Run the full verification**

Run: `npm test`
Expected: toutes les suites PASS.

Run: `npm run typecheck`
Expected: aucune erreur.

Run: `npm run lint`
Expected: 0 erreur (warning préexistant `src/app/layout.tsx:38` toléré).

- [ ] **Step 5: Optional real Gemini check**

Si le quota Gemini et l'environnement le permettent, générer un spec réel pour Atlas Barber Studio (Lyon, id `99001`) et vérifier : `design` présent, `hero.style="immersive"`, `secondaryCta`, 6 images uniques, 5 pages services, formulaire câblé, 0 hotlink. Si le quota échoue, le consigner comme non exécuté — ne pas le présenter comme validé.

- [ ] **Step 6: Close the spec only after evidence**

Passer le statut du design doc à « implémenté » uniquement après `npm test`, `typecheck`, lint et e2e déterministe verts. Ne pas commit/déployer sans demande explicite.

---

## Execution Notes

- Ordre recommandé : Task 1 → 2 → 3 → 4 → 5 → 6 → 7. Les tâches 5 et 6 dépendent de `premiumSpecFixture` (Task 3).
- Chaque tâche laisse le dépôt testable ; ne pas démarrer la suivante si `npm run typecheck` échoue.
- Les tests utilisent `tests/_lib` généré ; ne jamais éditer `tests/_lib` à la main.
- Les nouveaux modules doivent être ajoutés à `scripts/test.mjs` avant de lancer une suite qui les importe.
- Aucun commit, push ou déploiement sans instruction explicite.
