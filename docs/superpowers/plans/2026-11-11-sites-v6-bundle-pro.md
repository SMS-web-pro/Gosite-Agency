# Plan v6 : bundle pro multi-pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** le générateur produit, pour chaque lead, un bundle multi-fichiers conforme au brief client (index créatif Gemini + pages déterministes + images locales téléchargées + form via API gosite.digital + TODO report).

**Architecture:** hybride (design A) — Gemini ne génère que `index.html` ; `site-config.ts` (source de vérité typed) → `bundle.ts` (pages auxiliaires déterministes) + `bundle-images.ts` (download local) + `deployer` multi-fichiers + `/api/site-form` (Brevo).

**Tech Stack:** Next.js 16 + Drizzle/Supabase + Gemini `gemini-3.6-flash` (3 clés, maxTokens 65536) + Brevo SMTP + Vercel API v13 inline files + node:test natif (`scripts/test.mjs`, modules purs copiés dans `tests/_lib`).

**Spec:** `docs/superpowers/specs/2026-11-11-sites-v6-bundle-pro-design.md` (l'exécutant lit les deux).

## Global Constraints

- Zéro URL d'image externe dans le bundle (images téléchargées au build, fallback = dégradé CSS + TODO, JAMAIS de hotlink).
- Zéro fait inventé : licence/avis/années jamais fabriqués — `null` + TODO report ; placeholder visible interdit en prod.
- Modules purs (`site-config`, `bundle`, `llm-coerce`) : aucun import statique DB/réseau (copiés dans `tests/_lib`).
- Design tokens v5 conservés : rayons 6/14/24/999, ombres 3 niveaux, clamp() typo, `data-reveal` unique (PAS `data-aos`), WCAG AA, cibles tactiles ≥44px, `prefers-reduced-motion` respecté.
- `npm test` lance TOUTES les suites (pas de filtrage) ; `npx tsc --noEmit` doit rester vert à chaque tâche.
- Langue : site EN natif pour leads US (labelEn/servicesEn déjà en place) ; prompts en anglais pour l'exécutant sont interdits dans le HTML généré (contenu = langue du lead).
- Budgets Gemini inchangés : 180 s/essai, deadline 250 s, route ≤300 s.

## Review Focus

1. **Toutes les images échouent au download** → héros/galerie en dégradé CSS propre + TODO, jamais de `<img>` cassé ni de hotlink. *(test T6 : simulateur fetch échec → files vides, `hero=null`)*
2. **Gemini KO/timeout** → fallback index déterministe complet et conforme v6 (pas de template v5). *(test T4 + T7 : `engine:"fallback"`)*
3. **Rating 0.0/absent** → aucune mention de note nulle part, section testimonials omise. *(test T1 + T4 + e2e T11)*
4. **SERVICES_FULL absent (LLM KO au map)** → paras de pages services assemblées déterministes depuis desc+ville. *(test T3)*
5. **Form spam/payload invalide** → honeypot 200 silencieux, validation stricte, rate limit 5/min/IP, jamais de crash route. *(test T9)*

---

### Task 1: SiteConfig (source de vérité unique)

**Files:**
- Create: `src/lib/site-config.ts`
- Test: `tests/site-config.test.ts`
- Modify: `scripts/test.mjs` (LIB_FILES += `site-config.ts`)

**Interfaces:**
- Produces:
```ts
export type SiteService = { slug: string; title: string; short: string; paras: string[]; bullets: string[] };
export type SiteConfig = {
  name: string; tagline: string; phone: string; phoneLink: string; email: string | null;
  address: string; city: string; zip: string; country: string; currency: string;
  domain: string; mapUrl: string; mapEmbed: string | null; lat: number | null; lng: number | null;
  rating: number | null; reviewCount: number | null;
  hours: { weekday: string; sat: string; sun: string } | null; emergency247: boolean;
  services: SiteService[]; areas: string[];
  socials: { instagram?: string; facebook?: string };
  formAction: string; // `https://gosite.digital/api/site-form/${prospectId}`
  images: { hero: string; about: string; gallery: string[] }; // chemins locaux /images/…
  year: number; lang: "fr" | "en"; locale: string; dir: "ltr" | "rtl";
  nicheLabel: string; schemaType: string;
  primaryColor: string; accentColor: string; neutralBg: string;
  prospectId: number;
};
export function buildSiteConfig(sheet: Record<string, string>, prospectId: number): SiteConfig;
```
Règles de dérivation : `domain` = `sheet.DOMAIN` sinon `` `https://${slug}.vercel.app` `` (slug = sheet.SLUG sans protocole) ; `mapUrl` = URL Google Maps search `https://www.google.com/maps/search/?api=1&query=` encodé(name+city+zip), JAMAIS des raw coords ; `rating` = parseFloat>0 ? valeur : null (idem reviewCount) ; `emergency247` = true ssi `HOURS_WEEKDAY` contient « 24/7 » ; `services` = parse `sheet.SERVICES` (JSON) + merge `sheet.SERVICES_FULL` si présent (paras/bullets), slug = slugify(title) ; images = chemins fixes `images/hero.jpg`, `images/about.jpg`, `images/work-1.jpg…work-6.jpg` ; `email` = null si « none ».

- [ ] **Step 1: test** — fiche fictive Positiflo/Dallas complète (rating 4.8/64, SERVICES 6 objets, SERVICES_FULL avec paras) : asserte `domain`/`mapUrl` (commence par `https://www.google.com/maps/search/?api=1&query=`), `rating===4.8`, `services.length===6`, `services[0].paras.length>=2`, `formAction===…/1952`, `emergency247===false` (horaires « Mon–Fri 8–6 »), images = chemins locaux. Variante rating « 0.0 » → `rating===null`. Variante HOURS_WEEKDAY « 24/7 » → `emergency247===true`. Variante EMAIL « none » → `email===null`.
- [ ] **Step 2: run** — `npm test` → nouveau fichier EN ÉCHEC (module absent).
- [ ] **Step 3: impl** — `buildSiteConfig` pur (slugify local, parsing défensif : SERVICES invalide → repli niche via `nicheServicesJson` FR/EN, paras assemblées `short`+ville).
- [ ] **Step 4: run** — `npm test` → toutes suites OK ; `npx tsc --noEmit` OK.
- [ ] **Step 5: commit** — `v6: SiteConfig source de vérité (buildSiteConfig pur)`

### Task 2: Mapper simplifié + SERVICES_FULL

**Files:**
- Modify: `src/lib/mapper.ts` (`enrichSheetFromRealData` : supprimer le bloc /images + imports `images-search`), `src/lib/pipeline.ts` (`mapProspect` : output LLM += `services_full`), `src/lib/llm-coerce.ts` (`coerceEnrich` += `servicesFull`)
- Test: `tests/coerce.test.ts` (extend)

**Interfaces:**
- Produces: `sheet.SERVICES_FULL` = JSON string `[{"slug","title","short","paras":[2-3],"bullets":[3-4]}]` (5-6 services) ; absent si LLM < 3 services valables (repli Task 1 paras assemblées).
- `enrichSheetFromRealData` après changement : /maps (description+horaires) + SERVICES fallback niche EN/FR + garde idempotence `IMAGE_SOURCE==="serper"` remplacée par garde sur `SERVICES_FULL` déjà présent (skip si présent). Aucun appel /images, aucun crédit image.

- [ ] **Step 1: test coerce** — `servicesFull` valide gardé (6 objets, paras 2-3, bullets 3-4, trim/slice : short ≤90, paras ≤400, bullets ≤120), invalide rejeté (paras <2 → objet rejeté), absent → undefined.
- [ ] **Step 2: run** — `npm test` → FAIL (propriété absente).
- [ ] **Step 3: impl** — `coerceEnrich.servicesFull` ; pipeline instruction LLM : 5-6 services `{slug (kebab-case), title, short (≤90), paras (2-3 phrases concrètes ancrées ville, réutilise la description Google réelle), bullets (3-4 bénéfices)}` — jamais de chiffre/promesse inventée ; si `enriched.servicesFull?.length >= 3` → `sheet.SERVICES_FULL = JSON.stringify(...)` ; mapper : retirer bloc /images + `IMAGE_SOURCE` (posé à « local » au build T7), garde `if (sheet.SERVICES_FULL) return;`.
- [ ] **Step 4: run** — `npm test` OK + typecheck OK.
- [ ] **Step 5: commit** — `v6: mapper /maps+SERVICES_FULL, fin Serper Images`

### Task 3: bundle.ts — pages auxiliaires déterministes

**Files:**
- Create: `src/lib/bundle.ts`
- Test: `tests/bundle.test.ts`
- Modify: `scripts/test.mjs` (LIB_FILES += `bundle.ts`)

**Interfaces:**
- Consumes: `SiteConfig` (Task 1), `findNiche`/`localeFor` (`./niches`).
- Produces:
```ts
export function renderAuxPages(config: SiteConfig): Record<string, string>;
// keys: "privacy.html","terms.html","404.html","sitemap.xml","robots.txt",
// "site.webmanifest","favicon.svg","vercel.json","services/{slug}.html" (×5-6)
export function patchIndexDomain(html: string, fromBase: string, toBase: string): string;
export function generateTodoList(config: SiteConfig): string[]; // photos×8, licence, avis, GBP, Turnstile, favicon custom, domaine
```
Contenu : chaque page `<head>` complet (title/meta 140-160 uniques, canonical `${domain}${path}`, OG/Twitter `og:image = ${domain}/images/hero.jpg`, favicon, JSON-LD LocalBusiness : name/address/phone/hours/areaServed/geo si réels/sameAs si socials/aggregateRating ssi rating réel) ; privacy (form data uniquement, contact réel, RGPD/CCPA selon country) ; terms ; 404 brandée ; sitemap (index + services + privacy + terms, URLs absolues) ; robots (Allow + Sitemap) ; manifest (name/colors) ; favicon.svg monogramme ; vercel.json `{"cleanUrls":true}` ; pages services : title/paras/bullets/CTA call + `#quote → /#contact`, keywords ville.

- [ ] **Step 1: test** — config Positiflo (Task 1) : asserte présence des 11+ clés attendues ; `privacy.html` contient email réel et PAS « lorem » ; `sitemap.xml` parse en XML (indices `<urlset` + un `<loc>${domain}/services/leak-repair</loc>` clean sans `.html`) ; `robots.txt` contient `Sitemap: ${domain}/sitemap.xml` ; service page contient title service + « Call Now » + canonical ; rating 0 → aucun « aggregateRating » dans JSON-LD ; TODO list ≥ 4 items contenant « photos » et « license ».
- [ ] **Step 2: run** — `npm test` → FAIL (module absent).
- [ ] **Step 3: impl** — rendu déterministe ; paras repli (LLM KO) assemblées : P1 = short reformulé + ville/niche, P2 = bullets déroulées, P3 = engagement horaires/contact. Phrases EN/FR dans le module.
- [ ] **Step 4: run** — `npm test` OK + typecheck OK.
- [ ] **Step 5: commit** — `v6: bundle.ts pages auxiliaires déterministes + TODO list`

### Task 4: bundle.ts — fallback index déterministe

**Files:**
- Modify: `src/lib/bundle.ts`
- Test: `tests/bundle.test.ts` (extend)

**Interfaces:**
- Produces: `export function renderFallbackIndex(config: SiteConfig): string;`

- [ ] **Step 1: test** — asserte : commence `<!DOCTYPE html>` ; `data-reveal` présent, aucun `data-aos` ; aucun `src="http` externe (images = chemins locaux uniquement) ; onerror substitution `this.onerror=null;this.src='images/about.jpg'` sur les img ; 3 `class="section-divider"` ; form `action=config.formAction` + honeypot `name="website"` ; rating null → aucun « 4.8 »/aggregateRating ; mobile bar (`.mobile-bar` + `tel:`) ; PAS de FAB WhatsApp ; pas de modale légale ; liens `/privacy` `/terms`.
- [ ] **Step 2: run** — `npm test` → FAIL.
- [ ] **Step 3: impl** — index minimal conforme (tokens v5, sections : topbar, header, hero chips, trust bar, services 3×2, why 4 cartes, process 4 étapes, galerie dégradés si image absente, Google-bloc testimonials, service area, about, FAQ accordéon, contact 2 col, footer).
- [ ] **Step 4: run** — `npm test` OK + typecheck OK.
- [ ] **Step 5: commit** — `v6: fallback index déterministe conforme`

### Task 5: GOLDEN v6 — index créatif

**Files:**
- Modify: `src/lib/coder.ts` (GOLDEN_FR/GOLDEN_EN réécrits selon design §Coder ; nomenclature v6)

**Interfaces:**
- Consumes: `SiteConfig` fields (Task 1) — le prompt décrit les champs RÉELS fournis (name, phone, formAction, chemins images locaux, services cliquables `/services/{slug}`, rating réel ou absent, mapUrl propre).
- Produces: `index.html` créatif conforme au brief (structure 14 sections du design, tokens v5, WCAG AA).

Interdits explicites dans le prompt : `data-aos`, compteurs animés sur rating/reviews (valeurs statiques rendues), FABs (WhatsApp supprimé → barre sticky mobile `Call Now` + `Get Quote` avec safe-area), modales légales (liens réels `/privacy` `/terms`), srcset/hotlinks, « Get Directions » (CTA secondaire = « Get a Free Quote » → `#contact`), numéros 01-06 sur services, placeholders `[XXX]`. Nomenclature : `.mobile-bar`, `.trust-bar` unique, `.service-card[href^="/services/"]`, `.section-divider` ×3, `data-reveal`, honeypot, form action formAction, onerror substitution locale, JSON-LD + FAQPage, map iframe lazy + fallback lien `mapUrl`.

- [ ] **Step 1: réécriture** — remplace les blocs obsolètes des deux prompts (hero stat cards, FABs, modales, Formspree, srcset, rayures/blobs restants) par les règles design §3 ; gardes : tokens, data-reveal, dividers, responsive.
- [ ] **Step 2: vérification** — `rg -n "data-aos|Formspree|WhatsApp|srcset|stat-card|legalModal" src/lib/coder.ts` → zéro occurrence hors interdictions explicites ; `npm test` + typecheck OK (prompts = strings).
- [ ] **Step 3: commit** — `v6: GOLDEN index créatif (structure brief, mobile bar, form API)`

### Task 6: bundle-images.ts — download local

**Files:**
- Create: `src/lib/bundle-images.ts`
- Test: `tests/bundle-images.test.ts`
- Modify: `scripts/test.mjs` (LIB_FILES += `bundle-images.ts`)

**Interfaces:**
- Produces:
```ts
export type LocalImages = { files: Record<string, string>; hero: string | null; about: string | null; gallery: string[] };
export async function downloadImages(
  slots: { slot: "hero" | "about" | "gallery"; url: string }[],
  fetchImpl?: typeof fetch,
): Promise<LocalImages>;
```
Comportement : fetch GET (timeout 12 s, UA navigateur, `AbortSignal.timeout`), 2 essais par URL, si échec → url de repli fournie par le caller est déjà dans `slots` (le caller passe hero url + about url + gallery ×6 + réserve du pool) ; garde bytes > 10 Ko ; clé fichier `images/hero.jpg`/`images/about.jpg`/`images/work-N.jpg` ; slot sans succès → `null`/absent (NUNCA fallback hotlink) ; retour files = filename → base64 (sans préfixe data:).

- [ ] **Step 1: test** — fetchImpl factice : succès (Response bytes 15 Ko, content-type image/jpeg) → files remplis, hero chemin correct ; échec réseau 2× sur hero → `hero===null`, files sans `images/hero.jpg` ; taille < 10 Ko → rejeté ; galeries : 6 urls dont 2 échouent + réserve → gallery complète via réserve.
- [ ] **Step 2: run** — `npm test` → FAIL.
- [ ] **Step 3: impl** — paquets de 3 en parallèle, retry ×2, slice base64.
- [ ] **Step 4: run** — `npm test` OK + typecheck OK.
- [ ] **Step 5: commit** — `v6: download images locales (retry, réserve, zéro hotlink)`

### Task 7: buildSiteBundle + schema site_bundle

**Files:**
- Modify: `src/lib/coder.ts` (`buildSiteBundle`), `src/db/schema.ts` (+ `siteBundle: jsonb("site_bundle")`), `src/lib/pipeline.ts` (`buildProspectSite`), migration drizzle
- Test: `tests/bundle-build.test.ts` (structure, avec mocks)

**Interfaces:**
- Consumes: `buildSiteConfig` (T1), `renderAuxPages`/`renderFallbackIndex`/`generateTodoList` (T3/T4), `downloadImages` (T6), GOLDEN v6 (T5), `geminiCompleteStep` (existant).
- Produces:
```ts
export async function buildSiteBundle(sheet: Record<string, string>, prospectId: number): Promise<{
  html: string; bundle: Record<string, string>; engine: "gemini" | "fallback"; todoList: string[];
}>;
```
Ordre : download images (pool seeded existant `pickSeededImagesSafe` → slots hero/about/gallery ×6 + réserve ×4) → config (domain = `https://${slug}.vercel.app`, slug = `decideSlug` déjà appelé avant ? non — `buildProspectSite` : slug d'abord, puis bundle) → Gemini index (user prompt = config sérialisée + kickoff) → si Gemini KO → `renderFallbackIndex` → bundle = { "index.html": html, "vercel.json", "robots.txt", "sitemap.xml", "site.webmanifest", "favicon.svg", "privacy.html", "terms.html", "404.html", images/*, services/*.html }. `IMAGE_SOURCE = "local"` posé dans sheet avant config. pipeline persiste `{ siteHtml: bundle["index.html"], siteBundle: bundle }`. `npm run db:push` (drizzle-kit push) appliqué.

- [ ] **Step 1: migration** — schema `siteBundle` + `npx drizzle-kit push` (vérifier colonne en DB).
- [ ] **Step 2: impl** — `buildSiteBundle` ; images en échec total → slots null → config.images hero = `""` → fallback/dégradés CSS + TODO items « hero photo ».
- [ ] **Step 3: test** — mock `geminiCompleteStep` (module injecté — refactor : `buildSiteBundle` accepte `geminiImpl` param optionnel par défaut l'import dynamique réel) → asserte bundle keys attendues, index contient formAction, engine="fallback" si geminiImpl renvoie null.
- [ ] **Step 4: run** — `npm test` OK + typecheck OK.
- [ ] **Step 5: commit** — `v6: buildSiteBundle orchestration + site_bundle jsonb`

### Task 8: Deployer multi-fichiers + alias stable

**Files:**
- Modify: `src/lib/deploy.ts`, `src/lib/pipeline.ts` (`deployProspectSite`)

**Interfaces:**
- Produces: `export async function deploySiteBundle(slug: string, bundle: Record<string, string>): Promise<string>;` → v13 inline files (array de fichiers, base64), `target: "production"` → URL stable `https://${slug}.vercel.app` retournée/persistée ; PATCH `ssoProtection: null` (déjà en place) ; ancien chemin `siteBundle === null` → déploiement legacy site_html (compat leads anciens).

- [ ] **Step 1: impl** — deployer : files array [{file: path, data: base64, encoding: "base64"}...] ; project name = slug ; retourne l'alias stable ; pipeline : if `p.siteBundle` → bundle sinon legacy.
- [ ] **Step 2: vérif** — typecheck OK ; e2e T11 valide le déploiement réel.
- [ ] **Step 3: commit** — `v6: deployer bundle multi-fichiers + alias stable`

### Task 9: API formulaire + table site_leads

**Files:**
- Create: `src/app/api/site-form/[id]/route.ts`, `src/lib/form-receive.ts`
- Modify: `src/db/schema.ts` (table `siteLeads`), migration drizzle, `src/lib/telegram.ts` (appel existant)

**Interfaces:**
- Consumes: `validateFormSubmission` (pur, dans `form-receive.ts`), `logActivity`/Telegram existants, Brevo via `emailer.ts` (`brevoConfigured`).
- Produces:
```ts
export function validateFormSubmission(body: unknown): { ok: boolean; errors: string[]; values?: {
  name: string; phone: string; email: string | null; zip: string; service: string; message: string } };
export async function insertSiteLead(...): Promise<void>; // dans form-receive.ts, imports DB dynamiques
```
Route POST `[id]` : honeypot `website` non vide → `{ok:true}` silencieux ; rate limit in-memory 5/min/IP → 429 ; validation stricte (name ≥2, phone regex, message ≥10, service ∈ sheet SERVICES titres, consent true) → insert `site_leads` (prospect_id, payload jsonb, ip, created_at) ; email Brevo au client (from: plateforme, to: sheet EMAIL, texte propre avec name/phone/service/message/zip) ; Telegram « 📩 Demande depuis le site X » ; réponse `{ok:true}` / `{ok:false,errors}` ; jamais 500 brut (try/catch → 500 JSON propre).

- [ ] **Step 1: migration** — table `siteLeads` + push.
- [ ] **Step 2: test** — `tests/form-receive.test.ts` : payloads invalides (name court, message court, consent false, service inconnu, honeypot rempli) → ok:false/errors ; payload valide → ok:true, values trimées.
- [ ] **Step 3: impl route** — fine (validate → insert → email → telegram → reply).
- [ ] **Step 4: run** — `npm test` OK + typecheck OK.
- [ ] **Step 5: commit** — `v6: /api/site-form + site_leads (Brevo, honeypot, rate limit)`

### Task 10: TODO report email + re-rendu domaine custom

**Files:**
- Modify: `src/lib/emailer.ts` (`sendSalesEmail(p, previewUrl, todoList?: string[])`), `src/lib/pipeline.ts` (`linkProspectDomain`), `src/lib/bundle.ts` (re-export `patchIndexDomain`)

**Interfaces:**
- Consumes: `generateTodoList` (T3), bundle stocké (T7), `deploySiteBundle` (T8).
- Produces: au link du domaine custom : `const newBundle = { ...bundle }` → aux re-rendus avec `config.domain = https://{custom}` + `index.html` = `patchIndexDomain(bundle["index.html"], oldBase, newBase)` → `deploySiteBundle(slug, newBundle)` → persiste `siteBundle` + `deployedUrl`.

- [ ] **Step 1: impl emailer** — todoList optionnelle injectée en checklist HTML dans le template de livraison (param défaut []).
- [ ] **Step 2: impl pipeline** — `linkProspectDomain` : re-render (import dynamique bundle + site-config) + patch + redeploy + persistance.
- [ ] **Step 3: vérif** — typecheck OK ; e2e T11 couvre le flux déploiement (domain link non e2e — vérification manuelle documentée).
- [ ] **Step 4: commit** — `v6: TODO email livraison + re-rendu bundle au domaine custom`

### Task 11: e2e v6 lead #1952 + PSI + QA report

**Files:**
- Temp: `C:\Users\hp\AppData\Local\Temp\opencode\e2e-v6.mjs` (créé puis SUPPRIMÉ à la fin)

**Interfaces:**
- Consumes: tout le pipeline (map → build → deploy via API admin `http://localhost:3000/api/prospects/1952/advance`, dev server lancé en arrière-plan, pattern v5).

- [ ] **Step 1: map** — advance `map` → vérifier DB `client_data.SERVICES_FULL` présent (ou repli déterministe si LLM).
- [ ] **Step 2: build** — advance `build` → asserter `site_bundle` : contient `index.html`, `privacy.html`, `terms.html`, `404.html`, `sitemap.xml`, `robots.txt`, `site.webmanifest`, `favicon.svg`, `vercel.json`, ≥5 `services/*.html`, images `images/*.jpg` (ou zéro images + TODO) ; index : aucun `src="http` externe (sauf form action gosite.digital + maps iframe), `data-reveal`, 3 dividers, `.mobile-bar`, honeypot, pas de `data-aos`, pas de FAB WhatsApp, rating statique.
- [ ] **Step 3: deploy** — advance `deploy` → URL `https://professional-quality-test.vercel.app` → GET live : 200, pas de login SSO, taille > 50 Ko, data-reveal, `images/hero.jpg` servi (GET 200 image/*), `/privacy` 200, `/services/leak-repair` 200, sitemap.xml 200.
- [ ] **Step 4: PSI** — GET `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=…&strategy=mobile` (sans clé, report-only, skip gracieux si 429) → logger scores.
- [ ] **Step 5: form** — POST live `/api/site-form/1952` payload valide via dev server → `{ok:true}` ; honeypot → `{ok:true}` silencieux ; vérifier ligne `site_leads` + Telegram (log activity).
- [ ] **Step 6: QA checklist** — rapport dans le message final (brief QA) + supprimer `e2e-v6.mjs` + ledger.
- [ ] **Step 7: commit** — tout résiduel + push ; CI prod READY ; prod advance `deploy` (pattern v5 : poll-deploy "v6" puis advance-prod.mjs deploy).

## Self-review

- Spec coverage : structure 14 sections (T5 prompt + T4 fallback), images locales (T2/T6/T7), form API (T9), pages légales/services (T3), sitemap/robots/manifest/favicon (T3), TODO report (T3/T10), PSI (T11), re-rendu domaine (T10), fallbacks (T4/T6/T7), schema (T7/T9). ✅
- Chaque step = une action ; prompts décrits par règles design (pas de transcription HTML). ✅
- Types cohérents SiteConfig/renderAuxPages/downloadImages/buildSiteBundle/patchIndexDomain entre tâches. ✅
- Review Focus : lignes 1→T6/T7, 2→T4/T7, 3→T1/T4/T11, 4→T3, 5→T9. ✅
