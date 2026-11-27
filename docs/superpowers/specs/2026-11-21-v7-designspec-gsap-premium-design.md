# Design — v7 premium : DesignSpec, 7 directions artistiques et motion GSAP

Date : 2026-11-21 · Statut : implémenté

## Intention et pourquoi

Le moteur v7 est fiable mais visuellement plat : quatre variantes de hero, sept paires de
polices, un seul `IntersectionObserver`, aucune texture ni composition éditoriale. Le brief
utilisateur demande des sites **premium, immersifs et animés**, avec **GSAP + ScrollTrigger** et
l'un des **sept style guides** fournis.

Objectif : chaque nouveau site v7 reçoit une direction artistique identifiable et un motion
soigné, **sans** casser le rendu déterministe, le SEO multi-pages, les formulaires, les images
locales ni la règle « zéro fait inventé ». Le LLM ne produit pas de HTML libre : il choisit un
guide et des variantes, le renderer exécute.

Succès attendu : deux sites de la même niche ne se ressemblent pas ; le hero occupe l'écran ;
les sections respirent et s'animent ; le site reste propre sans JS et avec `prefers-reduced-motion`.

## Goals / non-goals / anti-goals

**Goals**
- Ajouter un `DesignSpec` validé : `styleGuide`, `hero`, `motion`, `paletteMode`.
- Implémenter les **7 style guides** comme systèmes de design déterministes (tokens, typographie,
  rayons, textures, traitements de cartes/images, variantes de hero).
- Ajouter un hero **immersif plein écran** (image, overlay, kicker, H1, sous-titre, deux CTA,
  chips de confiance, indicateur de scroll).
- Ajouter une couche **GSAP + ScrollTrigger** via CDN, avec repli `revealAll()`, respect
  de `prefers-reduced-motion`, zéro scroll-jacking et zéro dépendance npm dans le bundle généré.
- Animer le hero, les révélations de sections, les cartes, la galerie et le header.
- Conserver le rendu des anciens `SiteSpec` sans `design` (rétrocompatibilité).
- Tester les 7 guides, la sélection, les palettes, la rétrocompatibilité et l'accessibilité.

**Non-goals**
- Site one-page auto-contenu : on garde le bundle multi-pages v7.
- Nouvelles pages autonomes Contact / index Services : les pages services détaillées et la
  section `#contact` existent déjà ; leur ajout est une itération séparée.
- Scroll-jacking, sections pinned, curseur custom, transitions de page, marquee permanent.
- Compteurs animés, avis/chiffres inventés, nouvelles images externes.
- Refonte des contenus ou des pages légales.

**Anti-goals (échec même si ça marche)**
- Un site qui perd son contenu sans JS ou qui masque des sections à cause d'une animation.
- Un débordement horizontal mobile ou un hero qui bloque le scroll.
- Une palette de style guide qui écrase les couleurs de marque réelles de la fiche.
- Un seul fait inventé (note, avis, ancienneté, certification, garantie chiffrée).
- Une régression sur les formulaires, le SEO, les images locales ou les pages existantes.

## Contraintes

- Stack inchangée : `SiteSpec` Zod → `renderFullSite` déterministe → bundle statique.
- Les `SiteSpec` déjà stockés en base n'ont pas de `design` : ils doivent continuer à se rendre.
- Le LLM garde un budget de sortie de 12 000 tokens ; le prompt des 7 guides doit rester compact.
- GSAP et ScrollTrigger sont chargés depuis un CDN versionné, en `defer`, avec repli local.
- Aucune image externe : les visuels restent les fichiers locaux du bundle.
- Le rendu doit rester testable hors ligne : les tests ne chargent jamais le CDN.
- Mobile 390 px : zéro scroll horizontal, cibles tactiles ≥ 44 px.
- `prefers-reduced-motion` : aucune animation, contenu immédiatement visible.

## Approches considérées

- **A — Tokens DA seuls** : ajouter des palettes/polices par niche, sans motion ni nouveau hero.
  Écarté : ne répond pas au brief immersif et ne différencie pas assez les sites.
- **B — HTML libre** : le LLM produit directement le site one-page du brief. Écarté : perte de la
  validation Zod, du SEO multi-pages, des garanties anti-invention et de la robustesse v7.
- **C — Hybride DesignSpec (choisi)** : le LLM choisit un guide, une variante de hero et une
  intensité de motion ; le renderer applique des templates, du CSS et un moteur GSAP déterministes.
  Meilleur compromis entre variété éditoriale et contrôle qualité.

## Architecture

### 1. Schéma — `src/site-engine/site-spec.schema.ts`

Ajouts rétrocompatibles :

```ts
design: z.object({
  styleGuide: z.enum(STYLE_GUIDE_IDS),
  hero: z.enum(HERO_VARIANTS),
  motion: z.enum(["subtle", "balanced", "expressive"]),
  paletteMode: z.enum(["guide", "brand"]),
}).optional()
```

- `STYLE_GUIDE_IDS` : `craft-scrapbook`, `ai-brutalist`, `calendly-navy`, `awesomic-grid`,
  `interviews-editorial`, `officevibe-playful`, `basis-technical`.
- `HERO_VARIANTS` : `immersive-full`, `editorial-split`, `collage`, `brutalist`, `technical`.
- `SectionHero` gagne `eyebrow?: string` (max 48) et `style` accepte `"immersive"`.
- `design` reste optionnel dans le schéma pour les anciens specs ; la **génération** l'exige.
- `paletteMode` tranche la question « couleurs de marque ou couleurs du guide » : la fiche
  actuelle est toujours remplie par les couleurs **de niche** (`mapper.ts:69-70`), pas par une
  marque réelle. Les nouveaux specs utilisent donc `"guide"` par défaut. L'édition Support passe
  à `"brand"` uniquement quand le client demande explicitement une palette.

### 2. Style guides — `src/site-engine/design/style-guides.ts`

Un record typé par guide, source unique pour le prompt et le rendu :

| Guide | Signature | Typo | Rayon | Hero défaut | Motion |
|---|---|---|---|---|---|
| Craft Scrapbook | Papier crème, collage, notes punaisées, labels mono | Fraunces + Manrope | soft | collage | balanced |
| AI Brutalist | Off-black, lime, gros grotesk, bordures 2 px | Space Grotesk + Inter | sharp | brutalist | expressive |
| Calendly Navy | Navy premium, bleu, panneaux doux, cartes flottantes | Inter + Cabinet | rounded | immersive-full | balanced |
| Awesomic Grid | Zinc, grille visible, orange brûlé, titres surdimensionnés | Archivo + Inter | sharp | brutalist | expressive |
| Interviews Editorial | Blanc chaud, teal profond, serif, asymétrie, filets fins | Playfair + Source Sans | soft | editorial-split | subtle |
| Officevibe Playful | Crème, cobalt, corail, blobs, cartes arrondies | Poppins + Inter | pill | collage | expressive |
| Basis Technical | Blanc froid, aqua, grille technique, glow contenu, labels mono | Space Grotesk + Inter | sharp | technical | subtle |

Chaque entrée expose : `id`, `label`, `promptBrief`, `palette`, `fontPairing`, `borderRadius`,
`defaultHero`, `allowedHeroes`, `defaultMotion`, `css`.

Palettes complètes (ordre `primary / accent / neutralBg / textDark / textLight`) :

```ts
craft-scrapbook:       #1E2A44 / #C3653F / #F3EEE3 / #1E2A44 / #FFFDF8
ai-brutalist:          #11110F / #D6FF4B / #F4F0E6 / #11110F / #F4F0E6
calendly-navy:         #0B1F3A / #2F6FED / #F4F7FB / #0B1F3A / #FFFFFF
awesomic-grid:         #151515 / #D95D2B / #F1F1EE / #151515 / #FFFFFF
interviews-editorial:  #0D4F4A / #C97B5A / #FAF8F2 / #14201F / #FFFFFF
officevibe-playful:    #2340D8 / #FF6B5A / #FFF6E8 / #1C2340 / #FFFFFF
basis-technical:       #082C2B / #0FB5A6 / #F8FBFB / #082C2B / #FFFFFF
```

Décisions :
- **Typographie, rayons, espacements et traitements visuels** viennent du guide.
- **Palette** : `paletteMode: "guide"` applique la palette complète du guide au rendu ;
  `paletteMode: "brand"` conserve la palette du `SiteSpec` et n'utilise que la structure/typo/
  texture du guide. Les couleurs de niche actuelles ne sont pas une identité de marque : elles
  ne doivent pas bloquer la différenciation des 7 guides.
- Le CSS d'un seul guide est injecté par page (pas les 7). Il consomme les variables
  `--color-*` ; il ne code aucune couleur de fond en dur, sauf pour les teintes de texture
  dérivées via `color-mix`, afin que `paletteMode: "brand"` reste cohérent et contrasté.
- Chaque guide définit ses variantes de hero autorisées ; une combinaison invalide retombe sur
  le hero par défaut du guide.
- Pas de polices supplémentaires au-delà de trois nouvelles paires : `fraunces+manrope`,
  `space-grotesk+inter`, `archivo+inter` (les autres réutilisent l'existant).

### 3. Normalisation au rendu — `applyDesignToSpec(spec)`

Fonction pure dans `style-guides.ts` :

1. Si `spec.design` est absent → retourne `spec` inchangé (mode legacy, aucun CSS guide).
2. Si `spec.design` est présent :
   - clone le spec ;
   - force `fontPairing` et `borderRadius` depuis le guide ;
   - si `paletteMode === "guide"` : remplace `palette` par celle du guide ;
   - si `paletteMode === "brand"` : conserve la palette du `SiteSpec` (demande client explicite) ;
   - conserve `design` pour les attributs HTML et le motion.
3. `renderFullSite` travaille sur ce clone ; le spec stocké n'est jamais muté.

Le rendu reçoit donc une seule source de vérité pour le thème, le favicon, l'OG image, le
manifest, les JSON-LD et le `<meta name="theme-color">`.

### 4. Génération — `src/site-engine/generate-spec.ts`

- Ajoute les 7 `promptBrief` au system prompt, avec la règle « un seul guide, aucune mixture ».
- Le LLM doit remplir `design` (`styleGuide`, `hero`, `motion`, `paletteMode: "guide"`) et mettre
  `hero.style = "immersive"`, avec un `secondaryCta` obligatoire.
- Retry de validation si `design` absent, guide inconnu, `paletteMode !== "guide"`, hero non autorisé,
  `hero.style !== "immersive"` ou `secondaryCta` manquant.
- Conserve les règles existantes : hero/services/contact/FAQ obligatoires, galerie si photos,
  `servicePages` 3–6, zéro fait inventé.
- Le guide est choisi selon le métier, l'intention `STYLE` de la fiche et la niche. Pour éviter
  la répétition :
  - `pipeline.ts` extrait les `styleGuide` des 25 derniers specs publiés ;
  - `buildSiteV7` transmet cette liste à `generateSiteSpec` ;
  - le prompt demande de privilégier un guide absent de la liste quand plusieurs conviennent —
    **consigne souple, pas d'interdiction dure** (un métier peut n'avoir que 2 guides pertinents).
- Le LLM ne rédige ni JS ni HTML : uniquement le `SiteSpec`.

### 5. Hero immersif — `src/site-engine/components/hero/hero-immersive.ts`

Nouveau renderer enregistré sur `hero: immersive` :

```html
<section class="hero hero-immersive" data-hero="collage">
  <div class="hero-immersive-media" data-hero-media>
    <img ... loading="eager" fetchpriority="high">
    <div class="hero-immersive-overlay" aria-hidden="true"></div>
  </div>
  <div class="container hero-immersive-inner">
    <p class="hero-eyebrow reveal" data-hero-item>...</p>
    <h1 class="reveal" data-hero-item>...</h1>
    <p class="hero-sub reveal" data-hero-item>...</p>
    <ul class="chips reveal" data-hero-item>...</ul>
    <div class="hero-actions reveal" data-hero-item>2 CTA</div>
    <a class="hero-scroll-cue" href="#services" aria-label="...">...</a>
  </div>
</section>
```

- `min-height: 100svh` desktop, `92svh` mobile ; contenu dans le flux, jamais de débordement.
- Le même DOM est recomposé par le CSS du guide : split éditorial, collage, brutalist, technique
  ou full-bleed.
- Image locale, overlay renforcé pour la lisibilité, `aria-hidden` sur les décorations.
- `eyebrow` optionnel ; fallback silencieux si absent.
- `data-hero` et `data-hero-item` servent de hooks GSAP ; `reveal` garantit le no-JS/reduced-motion.
- Aucun nouveau champ de contenu : réutilise `headline`, `subheadline`, `chips`, `primaryCta`,
  `secondaryCta`.

### 6. Système visuel des guides

Le CSS du guide sélectionné est ajouté après `COMPONENTS_CSS` et s'applique via
`html[data-guide="..."]`. Il traite :

- fonds de sections et textures (papier, grille, blobs, glow) en pseudo-éléments décoratifs ;
- typographie : graisses, letter-spacing, labels mono, italiques éditoriales ;
- cartes services/process/témoignages/FAQ : rayons, bordures, ombres, rotations papier ;
- images : cadres, ratios, overlays, traitement du hero et de la galerie ;
- boutons, chips, header et bandeaux ;
- compositions de hero selon `data-hero` ;
- aucune règle ne cible un guide non sélectionné.

Les icônes de service restent déterministes : nouveau mapping SVG inline dans
`components/common/icons.ts`, avec repli sur l'initiale actuelle. Pas de CDN Lucide.

### 7. Motion — `src/site-engine/scripts/motion.ts` + `pages/wrap.ts`

- `wrapPage` ajoute dans le `<head>` : `preconnect` vers `cdn.jsdelivr.net`.
- Avant `</body>` :
  - `<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js" defer></script>`
  - `<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js" defer></script>`
  - le script inline de motion (attend `DOMContentLoaded`, donc les scripts `defer` sont prêts).
- Le script :
  1. ajoute `has-js` (comportement existant conservé) ;
  2. si `prefers-reduced-motion` → rend tout visible et s'arrête ;
  3. si `window.gsap` et `ScrollTrigger` disponibles → initialise :
     - timeline du hero : stagger des `[data-hero-item]`, scale de l'image ;
     - parallaxe légère de l'image du hero au scroll ;
     - `ScrollTrigger.batch` sur `.reveal` et les cibles de cartes/galerie ;
     - ombre du header après 24 px ;
     - `ScrollTrigger.refresh()` au `load` et après 300 ms ;
  4. sinon → repli immédiat `revealAll()`, qui révèle `.reveal` sans dépendance ;
  5. en cas d'erreur JS → révèle tout, ne laisse jamais une section invisible.
- Intensité lue depuis `data-motion` :
  - `subtle` : distances 16–24 px, durées 0.6–0.8 s, pas de parallaxe agressive ;
  - `balanced` : distances 24–40 px, durées 0.8–1.0 s, parallaxe douce ;
  - `expressive` : distances 40–64 px, durées 0.9–1.2 s, stagger marqué, scale/clip contenu.
- Uniquement `transform` et `opacity` ; pas de scroll-jacking, pas de pin, pas de compteurs.
- Timeout de sécurité : si un script `defer` reste bloqué et retarde `DOMContentLoaded`, `revealAll()` est appelé après 2,5 s pour ne jamais laisser le contenu masqué.

### 8. Hooks d'animation dans les composants

- `hero-immersive` : `data-hero-item` sur les blocs, `data-hero-media` sur l'image.
- Section heads : `.reveal` déjà présent.
- Ajouter `.reveal` aux cartes services, étapes process, tuiles galerie, cartes témoignages,
  items FAQ, trust items, formulaire contact et média about.
- Le motion script peut aussi cibler ces sélecteurs en secours, mais les hooks explicites sont
  la source de vérité.
- Les animations sont désactivées par la media query `prefers-reduced-motion` déjà présente
  dans `generate-theme.ts` et par le script.

### 9. Édition Support — `src/lib/site-editor.ts`

- Le prompt d'édition doit conserver `design` et `paletteMode` du spec courant sauf demande
  explicite de changement visuel.
- Si le spec courant avait un `design` et que le LLM le supprime, l'éditeur **restaure**
  `current.design` avant validation finale (jamais de downgrade silencieux vers legacy).
- Si le client demande explicitement une couleur, l'éditeur met `paletteMode: "brand"` et la
  nouvelle palette ; sinon le mode reste `"guide"`.
- Toute palette modifiée par le LLM sans `paletteMode: "brand"` est normalisée en `"brand"` : une édition de couleur ne peut pas être annulée silencieusement par le guide.
- Test dédié : une édition de texte ne fait pas perdre le guide, le hero ni le motion.

### 10. Rétrocompatibilité et déploiement

- `design` absent → aucun CSS guide, aucun hero immersif ; le rendu legacy reste identique.
- Le script de motion peut être ajouté à toutes les pages sans changer le rendu visuel.
- Les bundles existants ne sont pas migrés en base ; un rebuild crée un nouveau spec avec design.
- Aucune nouvelle dépendance npm, aucun fichier GSAP dans le bundle : CDN uniquement.

## Tests et vérification

### Tests unitaires / rendu
- `tests/style-guides.test.ts` (nouveau) :
  - les 7 guides existent, IDs uniques, palettes 5 rôles hex valides ;
  - `applyDesignToSpec` applique typo/rayon/palette en mode `"guide"` ;
  - palette du spec conservée en mode `"brand"` ;
  - spec legacy inchangé ;
  - combinaison guide/hero invalide → hero par défaut ;
  - CSS du guide contient `data-guide` et pas les autres guides.
- `tests/render-components.test.ts` / nouveau `tests/render-premium.test.ts` :
  - hero immersif : `100svh`, image eager, deux CTA, scroll cue, `data-hero-item` ;
  - `html[data-guide]`, `data-motion`, CDN GSAP/ScrollTrigger, fallback `revealAll()` ;
  - `prefers-reduced-motion` présent ;
  - zéro image externe, zéro `http://` ;
  - aucune section masquée sans JS.
- `tests/generate-spec.test.ts` :
  - prompt contient les 7 guides et la liste des guides récemment utilisés ;
  - design manquant → retry ;
  - hero non immersif → retry ;
  - `secondaryCta` manquant → retry ;
  - design valide → accepté.
- `tests/coder-engine.test.ts` : fixture avec design, page rendue avec guide et motion.
- `tests/site-editor.test.ts` : une édition de texte préserve `design` ; une demande de palette
  passe en `"brand"` ; la suppression de `design` est restaurée.
- `scripts/test.mjs` : ajouter `style-guides.ts`, `motion.ts`, `hero-immersive.ts`, `icons.ts`.

### E2E réel
- Générer un site réel (Gemini) sur un lead de test, puis :
  - vérifier le guide choisi et le rendu desktop 1440 / mobile 390 ;
  - zéro erreur console GSAP, zéro scroll horizontal, hero ≥ 92svh ;
  - `prefers-reduced-motion` simulé → contenu visible sans animation ;
  - JS désactivé → contenu visible ;
  - formulaire, liens, SEO et images locales inchangés ;
  - captures desktop/mobile et rapport JSON.

### Définition de « fini »
- Les 7 guides produisent des pages visiblement différentes.
- Un nouveau spec sans design échoue à la génération (retry), un ancien spec sans design se rend.
- Aucun fait inventé, aucune image externe, aucun formulaire cassé.
- `npm test`, `npx tsc --noEmit` et `npm run lint` OK.
- E2E réel validé sur desktop et mobile.

## Risques et parades

- **CDN indisponible** → repli `revealAll()`, contenu visible.
- **FOUC / sections invisibles** → `has-js` posé tôt, révélations idempotentes, try/catch global.
- **Palette de marque écrasée** → priorité aux couleurs de fiche, test dédié.
- **Prompt trop long / timeouts Gemini** → briefs de guide compacts, sortie JSON inchangée.
- **Mix de guides** → un seul guide actif, CSS scopé, validation de la combinaison hero.
- **Motion trop lourde sur mobile** → distances/durées réduites, pas de pin, transforms seuls.

## Resté au builder

- Valeurs CSS finales (espacements, ombres, textures) dans l'esprit des guides.
- Découpage exact des commits et ordre des tâches.
- Choix des noms de classes internes et des SVG d'icônes.
- Ajustement du brief LLM pour tenir dans le budget de tokens.
- Mesure Lighthouse et arbitrages de performance fins.
