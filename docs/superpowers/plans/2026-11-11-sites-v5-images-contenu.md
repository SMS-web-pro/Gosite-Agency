# Sites v5 â€” Images Serper + contenu du lead + design system pro â€” Plan d'implÃ©mentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les sites gÃ©nÃ©rÃ©s utilisent des images rÃ©elles du secteur validÃ©es (Serper Images), un contenu dÃ©rivÃ© des donnÃ©es rÃ©elles du lead (description Google Maps, horaires), et un design system professionnel (typo HD, reveal unifiÃ©, transitions par blocs).

**Architecture:** Le Mapper appelle d'abord Serper `/maps` (description + horaires rÃ©els), puis Serper `/images` (recherche par secteur), valide chaque URL en HEAD et peuple la fiche (8 URLs + fallback pool Unsplash seedÃ©). L'enrichissement LLM du Mapper sort aussi `SERVICES` dÃ©rivÃ©s de la description rÃ©elle. Le Coder reÃ§oit les nouveaux champs (SERVICES, ABOUT_SOURCE, IMAGE_FALLBACK_URL, IMAGE_SOURCE) et un prompt v5 dont le systÃ¨me de design est rÃ©Ã©crit (un seul systÃ¨me `data-reveal`, suppression du zoo de fonds animÃ©s, dividers SVG autorisÃ©s, srcset rÃ©servÃ© aux URLs pool).

**Tech Stack:** TypeScript, Node stdlib fetch (AbortSignal), Drizzle/Postgres, suite de tests maison (`node scripts/test.mjs`, modules purs copiÃ©s dans `tests/_lib`).

**Spec:** `docs/superpowers/specs/2026-11-11-sites-v5-images-contenu-design.md`

## Global Constraints

- Node stdlib uniquement â€” AUCUNE nouvelle dÃ©pendance.
- Budget Serper : 2-3 crÃ©dits par lead (1 `/maps` + 1 `/images` ; HEAD sans crÃ©dit).
- Build total < 300 s (maxDuration 300) â€” l'Ã©chelle Gemini et le garant template restent intacts.
- Aucune Ã©tape ne doit Ã©chouer dur si Serper Ã©choue (rÃ©seau/quota) â†’ fallback pool niches.
- RÃ¨gle anti-fake conservÃ©e : jamais de tÃ©moignage inventÃ©, jamais de chiffre inventÃ©.
- Langue de rÃ©ponse de l'assistant : franÃ§ais.

## Review Focus

- **URLs Serper mortes ou hotlink interdit plus tard** â†’ le `onerror` doit substituer une image du pool, jamais `display:none` (tÃ¢che 6 : nomenclature Coder ; tÃ¢che 7 : template).
- **Serper Ã©puisÃ©/hors ligne** â†’ `IMAGE_SOURCE="pool"`, build ne plante jamais (tÃ¢che 5 : fallback ; test e2e tÃ¢che 8 avec clÃ© vide simulÃ©e impossible â†’ vÃ©rifiÃ© par inspection du code + e2e succÃ¨s).
- **SERVICES incohÃ©rent ou JSON cassÃ©** â†’ coercition stricte (`llm-coerce`) + repli services de niche (tÃ¢che 5 ; e2e tÃ¢che 8 vÃ©rifie SERVICES non vide dans le HTML).
- **srcset appliquÃ© Ã  une URL non-Redimensionnable (host tiers)** â†’ srcset UNIQUEMENT si `IMAGE_SOURCE="pool"` (tÃ¢che 6 : rÃ¨gle prompt ; e2e tÃ¢che 8).
- **Description rÃ©elle Ã©crasÃ©e par l'IA** â†’ `ABOUT_SOURCE` stockÃ© sÃ©parÃ©ment et transmis tel quel au Coder (tÃ¢che 5 ; e2e tÃ¢che 8).

---

### Task 1: Module pur `images-search.ts` (filtre + sous-ensemble seedÃ© + validation HEAD)

**Files:**
- Create: `src/lib/images-search.ts`
- Modify: `scripts/test.mjs` (LIB_FILES : ajouter `"images-search.ts"`)
- Test: `tests/images-search.test.ts`

**Interfaces:**
- Consumes: `hashSeed`, `rotateSeeded` de `./images` (existants).
- Produces:
  ```ts
  export type ImageCandidate = { url: string; title: string; width: number; height: number };
  export function filterImageCandidates(raw: Record<string, unknown>[]): ImageCandidate[];
  export function seededSubset(valid: ImageCandidate[], seed: string, count: number): ImageCandidate[];
  export async function validateHeads(urls: string[], timeoutMs?: number): Promise<string[]>;
  export async function searchValidImages(opts: { apiKey: string; query: string; gl: string; hl: string; count: number }): Promise<ImageCandidate[]>;
  ```

- [ ] **Step 1: Ã‰crire le test qui Ã©choue** â€” `tests/images-search.test.ts`, style existant (assert + compteur `ok`) :

```ts
// filterImageCandidates : garde width>=600 & height>=400 & url http(s), Ã©carte
// les .svg, dÃ©doublonne par HOST, conserve title
const kept = filterImageCandidates([
  { imageUrl: "https://a.com/x.jpg", imageWidth: 800, imageHeight: 600, title: "A" },
  { imageUrl: "https://a.com/y.jpg", imageWidth: 900, imageHeight: 700, title: "Doublon host" },
  { imageUrl: "https://b.com/z.svg", imageWidth: 1000, imageHeight: 800, title: "SVG" },
  { imageUrl: "https://c.com/t.jpg", imageWidth: 500, imageHeight: 400, title: "Trop petit" },
  { imageUrl: "javascript:alert(1)", imageWidth: 2000, imageHeight: 1000, title: "Mauvais proto" },
]);
assert.equal(kept.length, 1);
assert.equal(kept[0].title, "A");

// seededSubset : rotation seedÃ©e, jamais plus de count, pas de doublon d'URL
const pool = filterImageCandidates(Array.from({ length: 10 }, (_, i) => ({
  imageUrl: `https://h${i}.com/p${i}.jpg`, imageWidth: 1200, imageHeight: 800, title: `T${i}`,
})));
const a = seededSubset(pool, "Positiflo|Paris", 8);
const b = seededSubset(pool, "Autre|Lyon", 8);
assert.equal(a.length, 8);
assert.ok(new Set([...a.map((c) => c.url)]).size === 8);
// deux seeds diffÃ©rents â†’ sous-ensembles diffÃ©rents (au moins 3/8 diff)
const diff = a.filter((c, i) => c.url !== b[i].url).length;
assert.ok(diff >= 3, `diff=${diff}`);
```

- [ ] **Step 2: Lancer le test, vÃ©rifier l'Ã©chec** â€” Run: `npm test` â†’ FAIL (module absent).
- [ ] **Step 3: ImplÃ©menter** â€” `src/lib/images-search.ts` :
  - `filterImageCandidates` : `imageUrl` non vide, commence par `http`, PAS d'extension `.svg`, `Number(imageWidth)>=600`, `Number(imageHeight)>=400`, dÃ©doublonnage par host (`new URL(url).host`).
  - `seededSubset` : `rotateSeeded(valid, hashSeed(seed))` puis `.slice(0, count)`.
  - `validateHeads(urls, timeoutMs=8000)` : HEAD fetch en parallÃ¨le par paquets de 6, garde les URLs avec status 200 + `content-type` commenÃ§ant par `image/` ; exceptions â†’ Ã©cart.
  - `searchValidImages` : POST `https://google.serper.dev/images` headers `{ "X-API-KEY": apiKey, "Content-Type": "application/json" }`, body `{ q: query, gl, hl, num: 20 }`, timeout 15s â†’ `filterImageCandidates(j.images ?? [])` â†’ HEAD sur les 12 premiers â†’ retourne les `count` premiÃ¨res validÃ©es.
- [ ] **Step 4: Test au vert** â€” Run: `npm test` â†’ PASS.
- [ ] **Step 5: Commit** â€” `git add src/lib/images-search.ts tests/images-search.test.ts scripts/test.mjs && git commit -m "v5: module images Serper (filtre, seed, validation HEAD)"`

### Task 2: Client Serper rÃ©utilisable (rotation + comptage) dans `serper.ts`

**Files:**
- Modify: `src/lib/serper.ts` (exports seulement, rien de cassÃ©)

**Interfaces:**
- Consumes: `getActiveRealKey()`, `markExhausted(keyId)` (privÃ©s existants, lignes ~147-158), table `serperKeys`.
- Produces:
  ```ts
  export async function nextSerperKey(): Promise<SerperKey | null>;        // = getActiveRealKey
  export async function countSerperCredit(keyId: number): Promise<void>;    // creditsUsed+1, markExhausted si limite atteinte (comme scoutSearch fait dÃ©jÃ )
  export async function serperPost(path: "images" | "maps", body: Record<string, unknown>, apiKey: string, timeoutMs?: number): Promise<Record<string, unknown> | null>; // POST https://google.serper.dev/{path}, null si !ok/rÃ©seau
  export async function fetchLeadDetails(opts: { apiKey: string; q: string; gl: string; hl: string }): Promise<{ description: string; hours: Record<string, string> | null }>; // POST /maps {q,gl,hl}, lit places[0].description + places[0].openingHours
  ```

- [ ] **Step 1: ImplÃ©menter les 4 exports** â€” `nextSerperKey` = simple rÃ©export du corps de `getActiveRealKey` (garder l'original privÃ© tel quel, l'export appelle la mÃªme fonction). `countSerperCredit` : `db.update(serperKeys).set({ creditsUsed: sql\`credits_used + 1\` })` puis si `creditsUsed >= creditLimit` â†’ `markExhausted`. `serperPost` : fetch POST avec headers `X-API-KEY`, retourne le JSON ou `null` (jamais throw). `fetchLeadDetails` : `serperPost("maps", { q, gl, hl }, apiKey)` â†’ `places?.[0]` â†’ `description: String(p.description ?? "")`, `hours`: mapper `p.openingHours` (tableau de chaÃ®nes `"Lundi: 9h-18h"`) en `{ weekday, sat, sun }` si recognisable, sinon `null`.
- [ ] **Step 2: Typecheck** â€” Run: `npx tsc --noEmit` â†’ 0 erreur.
- [ ] **Step 3: Commit** â€” `git add src/lib/serper.ts && git commit -m "v5: client Serper rÃ©utilisable (nextSerperKey, countSerperCredit, serperPost, fetchLeadDetails)"`

### Task 3: Variantes EN dans `niches.ts`

**Files:**
- Modify: `src/lib/niches.ts`
- Test: `tests/images.test.ts` (les tests niche vivent dÃ©jÃ  lÃ  â€” vÃ©rifier en lisant le fichier ; sinon crÃ©er `tests/niches-en.test.ts`)

**Interfaces:**
- Produces: `NicheContent` gagne 2 champs optionnels : `servicesEn?: { icon: string; title: string; desc: string }[]` et `faqEn?: { q: string; a: string }[]` â€” remplis pour les 6 niches + `DEFAULT_NICHE` (5-6 services et 6 FAQ chacun, anglais natif US, cohÃ©rents mÃ©tier par mÃ©tier avec les versions FR).

- [ ] **Step 1: Ã‰crire le test qui Ã©choue**

```ts
// Chaque niche expose des services/FAQ EN exploitables
for (const n of [...NICHES, DEFAULT_NICHE]) {
  assert.ok((n.servicesEn ?? []).length >= 5, `servicesEn manquants: ${n.label}`);
  assert.ok((n.faqEn ?? []).length >= 5, `faqEn manquantes: ${n.label}`);
  assert.ok(n.servicesEn!.every((s) => s.title && s.desc), `servicesEn incomplets: ${n.label}`);
}
```

- [ ] **Step 2: Test en Ã©chec** â€” Run: `npm test` â†’ FAIL.
- [ ] **Step 3: Ajouter les contenus EN** â€” pour chaque niche (Barbershop, Restaurant, Plombier, Dentiste, Gym, Beauty, DEFAULT "Service Local") : 5-6 `servicesEn` (icÃ´nes rÃ©utilisÃ©es de `services` FR) et 5-6 `faqEn` â€” un pur travail de rÃ©daction US, alignÃ© sÃ©mantiquement sur le FR.
- [ ] **Step 4: Test au vert** â€” Run: `npm test` â†’ PASS.
- [ ] **Step 5: Commit** â€” `git add src/lib/niches.ts tests && git commit -m "v5: services/FAQ EN pour toutes les niches (repli anglais)"`

### Task 4: Fiche enrichie â€” nouveaux champs sync dans `mapper.ts`

**Files:**
- Modify: `src/lib/mapper.ts` (`buildClientSheet`)
- Test: `tests/mapper.test.ts` (existe dÃ©jÃ  â€” vÃ©rifier ; ajouter les assertions dedans)

**Interfaces:**
- Produces: `buildClientSheet` retourne en plus : `SERVICES: ""` (rempli par la tÃ¢che 5), `ABOUT_SOURCE: ""` (tÃ¢che 5), `IMAGE_SOURCE: "pool"`, `IMAGE_FALLBACK_URL: imgs.hero` (1re image pool â€” hÃ©ros actuel). `validateSheet` NE change PAS (les 4 nouveaux champs ne sont pas requis).

- [ ] **Step 1: Ã‰crire le test qui Ã©choue** â€” dans le test mapper existant (une fiche bÃ¢tie sur un prospect fictif) :

```ts
assert.equal(sheet.IMAGE_SOURCE, "pool");
assert.ok(sheet.IMAGE_FALLBACK_URL.startsWith("https://"), sheet.IMAGE_FALLBACK_URL);
assert.ok("SERVICES" in sheet && "ABOUT_SOURCE" in sheet);
```

- [ ] **Step 2: Test en Ã©chec** â€” Run: `npm test` â†’ FAIL.
- [ ] **Step 3: ImplÃ©menter** â€” 4 lignes dans le return de `buildClientSheet`.
- [ ] **Step 4: Test au vert** â€” Run: `npm test` â†’ PASS.
- [ ] **Step 5: Commit** â€” `git add src/lib/mapper.ts tests && git commit -m "v5: champs fiche SERVICES/ABOUT_SOURCE/IMAGE_SOURCE/IMAGE_FALLBACK_URL"`

### Task 5: Enrichissement Serper + LLM async dans `mapProspect`

**Files:**
- Modify: `src/lib/mapper.ts` (nouvelle fonction async `enrichSheetFromRealData` + appel dans `mapProspect`)

**Interfaces:**
- Consumes: Task 1 `searchValidImages`, Task 2 `nextSerperKey/countSerperCredit/serperPost/fetchLeadDetails`, Task 1 `seededSubset`, `pickSeededImagesSafe` (existant), `agentThinkJson` + `coerceEnrich` (existants), `localeFor` (existant).
- Produces:
  ```ts
  export async function enrichSheetFromRealData(p: Prospect, sheet: Record<string, string>): Promise<void>;
  // Mutates sheet IN PLACE, never throws (try/catch global, tout fallback = pool)
  ```
  Comportement exact :
  1. `key = await nextSerperKey()` ; si null â†’ tout reste pool, `SERVICES` = repli niche (langue : `sheet.LANG.startsWith("en") ? niche.servicesEn : niche.services`, JSON.stringify `{title, desc}`), et retour.
  2. `fetchLeadDetails({ apiKey: key.apiKey, q: `${p.businessName} ${p.address ?? ""} ${p.city ?? ""}`, gl: sheet.LOCALE.endsWith("US") ? "us" : "fr", hl: sheet.LANG })` puis `countSerperCredit(key.id)`. Si `description` non vide â†’ `sheet.ABOUT_SOURCE = description.slice(0, 400)`. Si `hours` â†’ `sheet.HOURS_WEEKDAY/SAT/SUN` (sans inventer).
  3. LLM enrichissement EXISTANT (l'instruction de `mapProspect`) : input AJOUTÃ‰ = `Description Google: ${sheet.ABOUT_SOURCE}` ; sortie JSON ajoute `"services": [{"title": string, "desc": string}]` (5-6 services DÃ‰RIVÃ‰S de la description rÃ©elle + mÃ©tier, langue du site, jamais de chiffre inventÃ©).
  4. `coerceEnrich` retourne l'objet complet ; si `enriched.services?.length >= 3` â†’ `sheet.SERVICES = JSON.stringify(enriched.services)` ; sinon â†’ repli niche (comme en 1).
  5. Images : `found = await searchValidImages({ apiKey: key.apiKey, query: `${niche.labelEn} service professional photo`, gl, hl, count: 8 })` puis `countSerperCredit(key.id)`. Si `found.length >= 5` : `seed = `${p.businessName}|${p.city}`` ; `sub = seededSubset(found, seed, 8)` ; `poolPicks = pickSeededImagesSafe(niche.imagePool, seed + "|pad", 8 - sub.length, niche.heroImage, niche.aboutImage)` ; hÃ©ros `= sub[0].url`, about `= sub[1].url`, galerie `= [...sub.slice(2).map(u=>u.url), ...poolPicks.gallery]` (8 URLs exactement) ; `sheet.IMAGE_SOURCE = "serper"`. Sinon : rien (pool garde la main).
  6. `IMAGE_FALLBACK_URL` reste l'image pool hÃ©ros d'origine (dÃ©jÃ  posÃ©e en tÃ¢che 4) â€” NE PAS la rÃ©Ã©crire avec une image Serper (elle doit survivre Ã  la mort du lien).
- Appel dans `mapProspect` : aprÃ¨s `const sheet = buildClientSheet(p);` et AVANT `validateSheet` : `await enrichSheetFromRealData(p, sheet);`

- [ ] **Step 1: ImplÃ©menter** â€” tout dans `mapper.ts`, imports dynamiques `await import("./images-search")` / `await import("./serper")` pour rester compatible test-runner (mapper.ts est copiÃ© dans `tests/_lib` : les imports de niveau fichier vers un module avec DB casseraient les tests â†’ TOUTES les dÃ©pendances DB/Serper en import dynamique DANS la fonction).
- [ ] **Step 2: Tests existants au vert** â€” Run: `npm test` â†’ PASS (les tests mapper ne dÃ©clenchent PAS l'enrichissement : `enrichSheetFromRealData` n'est appelÃ©e que par `mapProspect`).
- [ ] **Step 3: Typecheck** â€” Run: `npx tsc --noEmit` â†’ 0 erreur.
- [ ] **Step 4: Commit** â€” `git add src/lib/mapper.ts && git commit -m "v5: enrichissement Serper (description/horaires rÃ©els, images validÃ©es) + services LLM"`

### Task 6: Prompts Coder v5 â€” design system + nouveaux champs

**Files:**
- Modify: `src/lib/coder.ts` (GOLDEN_FR, GOLDEN_EN, `buildSite` user prompt, nomenclature)

**Interfaces:**
- Consumes: champs fiche `SERVICES`, `ABOUT_SOURCE`, `IMAGE_FALLBACK_URL`, `IMAGE_SOURCE` (tÃ¢ches 4-5), `niche.labelEn` (existant), `findNiche` (existant).
- Produces: prompts v5 ; `buildSite` passe les nouveaux champs dans le sheet (retirer `IMAGE_FALLBACK_URL`/`SERVICES`/`ABOUT_SOURCE`/`IMAGE_SOURCE` de tout filtre ; ils ne sont pas exclus aujourd'hui â€” vÃ©rifier que le filtre `["NICHE_LABEL","NICHE_ICON","DISPLAY_FONT","ABOUT_IMAGE_URL"]` reste le seul exclude).

- [ ] **Step 1: RÃ©Ã©crire les sections design-system des deux prompts** (contrat produit/UX conservÃ© : 16 sections, modales lÃ©gales 600+ mots, formulaire Formspree, FABs, topbar marquee, hÃ©ros 2 colonnes Ken Burns + stat cards). Changements IDENTIQUES en FR et EN :
  - Remplacer partout `data-aos + data-aos-delay` par **UN systÃ¨me `data-reveal`** (IntersectionObserver, translateY 24px + opacity 0, durÃ©e .7s cubic-bezier(.16,1,.3,1), `data-reveal-delay` stagger 90ms par groupe) â€” interdiction de `data-aos` et de tout keyframe d'apparition parallÃ¨le.
  - Supprimer l'interdiction des dividers SVG et les remplacer par une OBLIGATION : divider SVG (vague OU biais, `fill` = couleur de fond de la section suivante) aux 3 changements majeurs : entrÃ©e dans #stats, entrÃ©e dans #cta-banner, entrÃ©e dans #footer.
  - Supprimer le zoo de fonds animÃ©s (grilles rayÃ©es animÃ©es, blobs multiples, radial-gradient animÃ©s) ; ne restent que : particules hÃ©ros, Ken Burns hÃ©ros, patterns STATIQUES opacitÃ© <= 0.04 sur #stats et #cta-banner.
  - Typo HD : `clamp()` fluides (h1 `clamp(2.6rem, 5.2vw, 4.4rem)`, h2 `clamp(1.9rem, 3.6vw, 3rem)`, corps `clamp(1rem, 1.2vw, 1.05rem)` ligne-hauteur 1.7), display font UNIQUEMENT h1/h2/nombres de stats, `text-wrap: balance` sur h1/h2/h3, `max-width: 68ch` sur les paragraphes, H3 jamais plus grands qu'un h2 de section.
  - Tokens : ombres en 3 niveaux fixes (0 2px 8px / 0 8px 24px / 0 16px 48px), radius system 6/14/24/999px, transitions 200ms (hover) / 400ms (fond).
  - Images : hÃ©ros `w=2400` + `srcset` 800/1600/2400 + `sizes="100vw"` **UNIQUEMENT si IMAGE_SOURCE = "pool"** ; si `IMAGE_SOURCE = "serper"` : `<img>` simple + `width`/`height` explicites + `object-fit: cover`. `loading="lazy"` + `decoding="async"` partout sauf hÃ©ros (`fetchpriority="high"`, pas de lazy).
  - Contenu : si `SERVICES` fourni (JSON de `{title, desc}`) â†’ les 6 cartes services portent EXACTEMENT ces services (titre rÃ©el + bÃ©nÃ©fice concret dÃ©rivÃ© de desc) ; FAQ ancrÃ©es services rÃ©els + ville ; "Ã  propos" = `ABOUT_SOURCE` reformulÃ©, jamais en contradiction avec lui.
  - **onerror** : remplacer la rÃ¨gle `display:none` par : chaque `<img>` porte `onerror="this.onerror=null;this.src='IMAGE_FALLBACK_URL';"` (URL littÃ©ralement copiÃ©e du champ).
  - Nomenclature obligatoire mise Ã  jour : `data-reveal` (+ `data-reveal-delay`) remplace `data-aos` Â· `.hero-particles` (14 cercles) Â· `.hero-ribbon` clip-path Â· `.hero-accent` Â· 4 `.hero-stat-card` Â· `.card-top-line` scaleX(0â†’1) hover Â· Ken Burns hÃ©ros Â· 2 modales `#legalModal`/`#privacyModal` (600+ mots) Â· `.fab-stack`/`.fab-wa`/`.fab-ph` Â· `.fh-row` Â· `.footer-bar` Â· `.nav-hidden` Â· 3 dividers SVG (`class="section-divider"`) Â· onerror fallback sur CHAQUE `<img>` (plus aucun `display:none`).
- [ ] **Step 2: Ajuster le user prompt de `buildSite`** â€” pour `lang === "en"` utiliser `niche.labelEn` Ã  la place de `niche.label` ; ajouter dans les deux langues une ligne : `SERVICES (rÃ©els, Ã  utiliser tels quels): ${clientData.SERVICES || "vide â†’ services sectoriels cohÃ©rents"}` et `IMAGE_SOURCE: ${clientData.IMAGE_SOURCE} (srcset 800/1600/2400 UNIQUEMENT si "pool")`.
- [ ] **Step 3: Typecheck + tests** â€” Run: `npx tsc --noEmit && npm test` â†’ 0 erreur, PASS (template.test et coder non testÃ© unitairement).
- [ ] **Step 4: Commit** â€” `git add src/lib/coder.ts && git commit -m "v5: prompts Coder (data-reveal unifiÃ©, dividers SVG, typo HD, services rÃ©els, onerror fallback)"`

### Task 7: Fix chirurgicale `site-template.ts` (onerror)

**Files:**
- Modify: `src/lib/site-template.ts` (un seul motif)
- Test: `tests/template.test.ts` (existant â€” adapter si un test couvre `display:none`)

**Interfaces:**
- Consumes: `IMAGE_FALLBACK_URL` du sheet (tÃ¢che 4), `niche.heroImage` (fallback historique).
- Produces: aucune signature nouvelle.

- [ ] **Step 1: Chercher le motif** â€” Run: `rg -n "display='none'|display:none" src/lib/site-template.ts` â†’ localiser le(s) `onerror`.
- [ ] **Step 2: Remplacer** â€” chaque `onerror="this.style.display='none'"` devient `onerror="this.onerror=null;this.src='${fallback}'"` oÃ¹ `fallback = sheet.IMAGE_FALLBACK_URL || niche.heroImage` (mÃ©canique : la variable est dÃ©jÃ  dans la portÃ©e du template qui reÃ§oit le sheet ; sinon passer `clientData.IMAGE_FALLBACK_URL` au point de gÃ©nÃ©ration).
- [ ] **Step 3: Tests au vert** â€” Run: `npm test` â†’ PASS (adapter `template.test.ts` si l'ancien `display:none` y est asserted : la nouvelle assertion = `onerror` prÃ©sent avec `this.src=`).
- [ ] **Step 4: Commit** â€” `git add src/lib/site-template.ts tests && git commit -m "v5: onerror template = substitution image, plus de masquage"`

### Task 8: E2E local sur le lead #1952 + vÃ©rification prod

**Files:**
- Create: `C:\Users\hp\AppData\Local\Temp\opencode\e2e-v5.mjs` (script temporaire, PAS commitÃ©)

**Interfaces:**
- Consumes: `mapProspect`, `buildProspectSite`, `deployToVercel` (existants), clÃ©s Serper/DB rÃ©elles.

- [ ] **Step 1: Script e2e** â€” charge le prospect 1952 depuis Supabase, appelle `mapProspect` â†’ log `sheet.IMAGE_SOURCE`, `sheet.SERVICES` (prÃ©visualisation), `sheet.ABOUT_SOURCE` (longueur) ; appelle `buildProspectSite` â†’ assertions sur le HTML : `data-reveal` prÃ©sent, AUCUN `display:'none'` dans un onerror, `>= 3` `section-divider`, `SERVICES` visibles (au moins 2 titres du champ trouvÃ©s dans le HTML), hÃ©ros = URL serper ou pool selon IMAGE_SOURCE, `srcset` prÃ©sent ssi IMAGE_SOURCE="pool" ; puis `deployToVercel` â†’ GET de l'URL, assert status 200 + marqueur `data-reveal`.
- [ ] **Step 2: ExÃ©cuter** â€” Run: `node C:\Users\hp\AppData\Local\Temp\opencode\e2e-v5.mjs` â†’ toutes les assertions vertes, taille HTML > 90 Ko.
- [ ] **Step 3: Commit & deploy de l'app agence** â€” `git status` propre (e2e.mjs PAS commitÃ©) ; si commits en attente â†’ push, poller le deploy (`Temp/opencode/poll-deploy.mjs "v5"` â€” dernier commit de v5), puis relancer l'action prod `deploy` (#1952) et vÃ©rifier l'URL publique (marqueurs comme en Step 2).
- [ ] **Step 4: Nettoyage** â€” supprimer `e2e-v5.mjs`, log final dans le canal habituel.
