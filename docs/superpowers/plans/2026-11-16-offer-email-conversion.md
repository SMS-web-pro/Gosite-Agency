# Plan — Email d'offre professionnel qui convertit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'email d'offre (Saler) devient un email de vente complet : inclusions réelles du site généré, « comment ça marche », prix 259 $ converti dans la devise du lead, garde-fous anti-invention.

**Architecture:** Deux modules purs nouveaux (`fx.ts` devise, `offer-copy.ts` sanitize/coerce), une fonction pure de plus dans `bundle.ts` (inclusions), `emailer.ts` réécrit (template + brief IA + glue taux de change avec cache settings), pipeline allégé (plus de checklist), settings alignés sur 259 USD. Tout le testable est testé via le runner existant (`scripts/test.mjs` copie les modules purs dans `tests/_lib` avec stubs).

**Tech Stack:** TypeScript, Next.js, runner de tests maison (`node --experimental-strip-types`), Drizzle/Postgres (settings), API taux open.er-api.com (sans clé).

**Spec:** `docs/superpowers/specs/2026-11-16-offer-email-conversion-design.md`

## Global Constraints

- Zéro fait inventé dans l'email : tout chiffre/inclusion vient du bundle, de la fiche Google ou des Réglages.
- Prix de base **toujours USD**, ancré par `OFFER_BASE_CURRENCY = "USD"` (constante dans `fx.ts`, jamais lue des settings).
- Offre réelle (source de vérité opérateur) : 259 $ une fois · domaine 1 an inclus · hébergement 1 an inclus · support & modifications 3 mois gratuits · année suivante 45 $/an (domaine + hébergement).
- Arrondi marketing **vers le bas** : multiple de 10 (< 10 000), de 100 (< 100 000), sinon 1 000.
- Fallbacks complets par langue (fr/en) : LLM absent ou invalide → l'email part quand même, jamais de blocage.
- List-Unsubscribe / footer STOP / adresse agence : inchangés.
- Aucune nouvelle dépendance npm, aucune clé d'API nouvelle.
- Interdits LLM (sanitizés) : `%`, stats non vérifiables, « gratuit » hors inclusions réelles.

## Review Focus

1. API de taux en panne au premier envoi → afficher `$259` en USD, jamais un montant faux (testé : stub `FX_RATES=""` dans tests/offer-email.test.ts).
2. Lead sans `CURRENCY` en fiche → repli géo (MA→MAD, US→USD, GB→GBP, sinon EUR/USD) (testé : tests/fx.test.ts).
3. LLM renvoie des clés en trop (`offerTitle`, `cta`) ou un « +30 % » → ignoré/sanitizé, valeurs déterministes (testé : tests/offer-copy.test.ts).
4. Lead sans note Google → pas de ligne preuve, le reste de l'email intact (testé : tests/offer-email.test.ts, rating null).
5. Devise exotique absente des taux (ex. CNY) → repli USD, jamais NaN/undefined (testé : tests/fx.test.ts).

---

### Task 1: `src/lib/fx.ts` — devise pure (résolution, conversion, formatage)

**Files:**
- Create: `src/lib/fx.ts`
- Test: `tests/fx.test.ts`
- Modify: `scripts/test.mjs` (LIB_FILES += `"fx.ts"`)

**Interfaces:**
- Produces (consommé par Tasks 4-5) :
  - `export const OFFER_BASE_CURRENCY = "USD";`
  - `export type Rates = Record<string, number>;`
  - `export function resolveDisplayCurrency(p: { clientData?: Record<string, string> | null; country?: string | null }): string;`
  - `export function convertUsd(amountUsd: number, currency: string, rates: Rates): number | null;`
  - `export function roundMarketing(n: number): number;`
  - `export function formatMoney(amount: number, currency: string): string;`
  - `export function displayOffer(amountUsd: number, currency: string, rates: Rates | null): { main: string; approx: string | null };`

- [ ] **Step 1: Write the failing test** `tests/fx.test.ts` (style du repo : `check("nom", bool)` + compteur `fail`, imports depuis `./_lib/fx.ts`) :

```ts
check("base USD", OFFER_BASE_CURRENCY === "USD");
check("fiche CURRENCY prioritaire", resolveDisplayCurrency({ clientData: { CURRENCY: "MAD" }, country: "France" }) === "MAD");
check("CURRENCY invalide -> géo Maroc", resolveDisplayCurrency({ clientData: { CURRENCY: "XAF" }, country: "Maroc" }) === "MAD");
check("géo US", resolveDisplayCurrency({ country: "United States" }) === "USD");
check("géo GB", resolveDisplayCurrency({ country: "United Kingdom" }) === "GBP");
check("géo France", resolveDisplayCurrency({ country: "France" }) === "EUR");
check("géo inconnue non-francophone -> USD", resolveDisplayCurrency({ country: "Japan" }) === "USD");
check("convertUsd", convertUsd(259, "MAD", { MAD: 9.94 }) === 2574.46);
check("convertUsd USD = identité", convertUsd(259, "USD", {}) === 259);
check("convertUsd taux manquant -> null", convertUsd(259, "CNY", { MAD: 9.94 }) === null);
check("roundMarketing <10k -> multiple de 10", roundMarketing(2574.46) === 2570);
check("roundMarketing <100k -> multiple de 100", roundMarketing(25746) === 25700);
check("roundMarketing >=100k -> multiple de 1000", roundMarketing(257464) === 257000);
check("formatMoney USD", formatMoney(259, "USD") === "$259");
check("formatMoney GBP", formatMoney(210, "GBP") === "£210");
check("formatMoney MAD", formatMoney(2570, "MAD").includes("2 570") && formatMoney(2570, "MAD").endsWith("MAD"));
check("displayOffer converti + approx", (() => { const d = displayOffer(259, "MAD", { MAD: 9.94 }); return d.main.includes("2 570") && d.main.endsWith("MAD") && d.approx === "≈ $259"; })());
check("displayOffer sans taux -> USD", (() => { const d = displayOffer(259, "MAD", null); return d.main === "$259" && d.approx === null; })());
check("displayOffer USD -> pas d'approx", displayOffer(259, "USD", { MAD: 9.94 }).approx === null);
```

- [ ] **Step 2: Run to verify FAIL** — `npm test` : suite fx absente du LIB_FILES → l'ajouter d'abord à `scripts/test.mjs` (`LIB_FILES` += `"fx.ts"`), puis `npm test` → FAIL (module introuvable / assertions fausses).
- [ ] **Step 3: Implement** `src/lib/fx.ts` — module PUR (aucun import DB). Regex pays réutilisées du style d'emailer.ts (`EN_COUNTRIES`/`FR_COUNTRIES`) + `/maroc|morocco/i`→MAD. `formatMoney` : `$`/`£` préfixés, sinon `Intl.NumberFormat("fr-FR")` + ` ${currency}` en suffixe. `displayOffer` : `convertUsd`→`roundMarketing`→`formatMoney` ; `approx = "≈ $259"` seulement si devise ≠ USD et conversion possible.
- [ ] **Step 4: Run to verify PASS** — `npm test` (toutes suites OK).
- [ ] **Step 5: Commit** — `git add src/lib/fx.ts tests/fx.test.ts scripts/test.mjs && git commit -m "fx: resolution devise lead + conversion USD avec arrondi marketing (module pur)"`

### Task 2: `src/lib/offer-copy.ts` — types + sanitize + coerce (pur)

**Files:**
- Create: `src/lib/offer-copy.ts`
- Test: `tests/offer-copy.test.ts`
- Modify: `scripts/test.mjs` (LIB_FILES += `"offer-copy.ts"`)

**Interfaces:**
- Produces (consommé par Task 4) :
  - `export type SalesCopyRaw = { subject?: string; hook?: string; bullets?: string[]; offerTitle?: string; cta?: string; closing?: string };`
  - `export type SalesCopy = { subject: string; hook: string; bullets: string[]; offerTitle: string; cta: string; closing: string };`
  - `export function sanitizeCopyRaw(raw: SalesCopyRaw | null): SalesCopyRaw;` — supprime tout `%`, tout « gratuit » (insensible casse) du subject/hook/closing, et filtre les bullets pareil.
  - `export function coerceCopy(raw: SalesCopyRaw | null, fallbacks: SalesCopy): SalesCopy;` — validée/tronquée comme l'actuelle (subject 90, hook 420, bullets 2-4×120, offerTitle 60, cta 28, closing 300) ; `offerTitle`/`cta` du LLM **toujours ignorés** → repris de `fallbacks` ; moins de 2 bullets valides → fallback bullets.

- [ ] **Step 1: Write the failing test** `tests/offer-copy.test.ts` :

```ts
const F: SalesCopy = { subject: "Un site prêt pour Étoile", hook: "hook FB", bullets: ["b1", "b2"], offerTitle: "Notre offre", cta: "Voir votre site", closing: "Répondez à cet email." };
check("+30% supprimé", !sanitizeCopyRaw({ bullets: ["Acquisition +30 % de trafic", "b2"] }).bullets!.includes("Acquisition +30 % de trafic"));
check("gratuit supprimé du subject", sanitizeCopyRaw({ subject: "Voir mon site gratuit" }).subject === "");
check("subject sain conservé", sanitizeCopyRaw({ subject: "Un site prêt pour Étoile" }).subject === "Un site prêt pour Étoile");
check("offerTitle LLM ignoré", coerceCopy({ offerTitle: "SUPER PROMO", cta: "ACHTEZ" }, F).offerTitle === "Notre offre");
check("coerceCopy <2 bullets -> fallback", coerceCopy({ bullets: ["Acquisition +30 % de trafic"] }, F).bullets.join("|") === "b1|b2");
check("coerceCopy null -> fallback complet", JSON.stringify(coerceCopy(null, F)) === JSON.stringify(F));
```

- [ ] **Step 2: Run to verify FAIL** (après LIB_FILES += `"offer-copy.ts"`).
- [ ] **Step 3: Implement** — code repris de l'actuel `coerceCopy` (emailer.ts:179-196) avec `fallbacks` en paramètre + `sanitizeCopyRaw` en amont.
- [ ] **Step 4: Run to verify PASS.**
- [ ] **Step 5: Commit** — `git commit -m "offer-copy: sanitize anti-invention (+%, gratuit) + coerce a fallbacks (module pur)"`

### Task 3: `src/lib/bundle.ts` — inclusions réelles + checklist neutre

**Files:**
- Modify: `src/lib/bundle.ts` (ajout `generateIncludedFeatures` près de `generateTodoList:551` ; rewording de `generateTodoList`)
- Test: `tests/offer-features.test.ts`

**Interfaces:**
- Produces (consommé par Task 4) :
  - `export function generateIncludedFeatures(config: SiteConfig): string[];` — fr/en selon `config.lang`. Liste honnête dérivée du bundle : accueil complet ; « vos N services » si `config.services.length` ; galerie si `config.images.gallery.length` ; formulaire de contact ; parfait sur mobile ; référencement local Google (fiche, horaires, carte) ; mentions légales incluses.
- `generateTodoList` : même signature, vocabulaire niche-neutre (« vos propres photos », « vos informations légales si applicable ») — plus jamais « chantier »/« licence…barre de confiance » en dur.

- [ ] **Step 1: Write the failing test** `tests/offer-features.test.ts` (bundle.ts déjà dans LIB_FILES, import depuis `./_lib/bundle.ts`) — config minimale construite comme dans les tests bundle existants :

```ts
check("inclut accueil", feats.some((f) => /accueil|homepage/i.test(f)));
check("inclut services avec nombre", feats.some((f) => f.includes("2")));
check("inclut mobile + formulaire + légal", /mobile/i.test(feats.join(" ")) && /formulaire|form/i.test(feats.join(" ")) && /légales|legal/i.test(feats.join(" ")));
check("galerie conditionnelle", configSansGalerie.every((f) => !/galerie|gallery/i.test(f)));
check("checklist sans chantier", generateTodoList(config).every((t) => !/chantier/i.test(t)));
```

- [ ] **Step 2: Run to verify FAIL.**
- [ ] **Step 3: Implement** dans `bundle.ts`.
- [ ] **Step 4: Run to verify PASS.**
- [ ] **Step 5: Commit** — `git commit -m "bundle: liste d'inclusions reelles du site + checklist niche-neutre"`

### Task 4: `src/lib/emailer.ts` — template complet, brief IA durci, taux de change

**Files:**
- Modify: `src/lib/emailer.ts` (template :205-270, texte :274-292, copy :114-196, envoi :298-341)
- Test: `tests/offer-email.test.ts`
- Modify: `scripts/test.mjs` (copie d'emailer avec stubs + nouveaux stubs)

**Interfaces:**
- Consumes: `fx` (Task 1), `offer-copy` (Task 2), `generateIncludedFeatures` (Task 3), `getSetting`/`setSetting` (existants).
- Produces: `sendSalesEmail(p: Prospect, previewUrl: string): Promise<SendResult>` — **le paramètre `todoList` disparaît** (Task 5 adapte l'appel).

- [ ] **Step 1: Write the failing test** `tests/offer-email.test.ts` — rendu de bout en bout en mode simulé (aucun réseau) :

```ts
// Stubs fournis par test.mjs : getSetting lit FX_RATES (taux figés MAD 9.94),
// OFFER_PRICE 259, RENEWAL_PRICE 45, BREVO_API_KEY "" -> chemin simulé ;
// agentThinkJson -> null -> copy fallback (jamais de LLM en test).
const res = await sendSalesEmail(prospectFactice({ businessName: "DEEP FITNESS", rating: "4.8", reviewCount: 25, clientData: { CURRENCY: "MAD" } }), "https://deep-fitness.gosite.digital");
check("envoi simulé ok", res.ok === true && res.simulated === true);
check("prix converti", res.bodyHtml!.includes("2 570 MAD"));
check("base USD discrète", res.bodyHtml!.includes("≈ $259"));
check("renouvellement converti", res.bodyHtml!.includes("440 MAD")); // 45*9.94=447.3 -> floor au multiple de 10 = 440
check("inclusions présentes", res.bodyHtml!.includes("inclut déjà") || res.bodyHtml!.includes("includes"));
check("comment ça marche", res.bodyHtml!.includes("Comment ça marche") || res.bodyHtml!.includes("How it works"));
check("3 inclusions offertes", /domaine|domain/i.test(res.bodyHtml!) && /hébergement|hosting/i.test(res.bodyHtml!) && /3 mois|3 months/i.test(res.bodyHtml!));
check("un seul paiement", /une seule fois|one-time/i.test(res.bodyHtml!));
check("pas de chantier", !/chantier/i.test(res.bodyHtml!));
check("pas de +30%", !/\+\s?30\s?%/i.test(res.bodyHtml!));
check("CTA cohérent (pas de gratuit)", !/gratuit/i.test(res.bodyHtml!));
check("preuve Google", res.bodyHtml!.includes("4.8"));
```

- [ ] **Step 2: Run to verify FAIL** (suite absente).
- [ ] **Step 3: Implement** dans `emailer.ts` :
  - `LANG_PACKS` : ajouter `includedTitle` (« Ce que votre site inclut déjà » / « What your site already includes »), `howTitle` (« Comment ça marche » / « How it works »), `howSteps` (3 étapes : 1. vous répondez à cet email / you reply to this email ; 2. on finalise avec vos infos et on met en ligne sous 48 h / we finalize with your details and go live within 48h ; 3. un seul paiement, quand vous êtes prêt / one single payment, when you're ready), `domainIncluded`, `hostingIncluded`, `supportIncluded`, `renewalLabel` (« Année suivante » / « Next year »), `ctaLine` (« Une réponse à cet email suffit pour démarrer. » / « A reply to this email is all it takes to get started. »), `approxNote`. `fallbackSubject`/`fallbackHook`/`fallbackBullets`/`fallbackClosing` : réécrits dans l'esprit du brief (accroche factuelle, bénéfices concrets, une seule action) — **sans** « gratuit », **sans** `%`.
  - `aiSalesCopy` : brief réécrit (conversion pro, personnalisé par métier via SELLING_ANGLE/TAGLINE/aiInsight, PAS allégé, ton humain respectueux, vouvoiement, une seule action ; interdits explicites : %, stats inventées, « gratuit », superlatifs non prouvés, fausse urgence). JSON shape réduit à 4 clés : `subject`, `hook`, `bullets`, `closing`. Pass 2 directeur commercial conservée (mêmes 4 clés). Appeler `sanitizeCopyRaw(pass2 ?? pass1)` puis `coerceCopy(sanitized, fallbacks)` avec `offerTitle = pack.offerTitleFallback`, `cta = pack.cta`.
  - `getRates()` (glue non testée) : lire `FX_RATES` (JSON `{rates, fetchedAt}`) ; frais < 24 h → retour ; sinon fetch `https://open.er-api.com/v6/latest/USD` (`{result:"success", rates}`) avec `AbortSignal.timeout(8000)`, `setSetting("FX_RATES", JSON.stringify({rates, fetchedAt}))`, retour ; échec → cache expiré si présent, sinon `null`. Jamais de throw (l'email part en USD au pire).
  - `renderEmail`/`renderEmailText` : ordre = header (inchangé) → hook → bullets ✓ (position actuelle) → bloc `includedTitle` + `generateIncludedFeatures(config)` (liste à puces ✓ réutilisant le style `bulletsHtml`) → bloc `howTitle` + 3 étapes numérotées → encadré offre reconstruit : `offerTitle`, `displayOffer(price).main` en gros, `approxNote` (`≈ $259`) si non-USD, lignes création/domaine/hébergement/support, ligne `renewalLabel` + `displayOffer(renewal).main` + «/an (domaine + hébergement)» → preuve Google (existante) → CTA (inchangé) + `ctaLine` → closing → signature → footer (inchangé). Version texte calquée. Le `config` vient de `buildSiteConfig(p.clientData ?? {}, p.id)` importé dynamiquement (déjà le pattern de pipeline.ts:658) — en cas d'erreur, `includedFeatures = []` (bloc omis, jamais de crash).
  - `sendSalesEmail` : signature `(p, previewUrl)` ; plus de bloc todoList/todoHtml/todoText (326-341) ; `renewal = (await getSetting("RENEWAL_PRICE")) || "45"` ; devise = `resolveDisplayCurrency(p)` (remplace la logique geoCurrency locale :307-315) ; `rates = await getRates()`.
- [ ] **Step 4: Run to verify PASS** — `npm test` (ajuster `scripts/test.mjs` d'abord : copie `emailer.ts` avec réécritures `from "./settings"`→stub, `from "./agent-brain"`→stub, ajout stubs `"settings-emailer-stub.ts"` (getSetting/allowSimulation/BREVO), `"agent-brain-stub.ts"` (agentThinkJson→null), LIB_FILES += `"fx.ts"`, `"offer-copy.ts"`, `"track.ts"` déjà présent).
- [ ] **Step 5: typecheck** — `npm run typecheck` (les types fx/offer-copy consommés).
- [ ] **Step 6: Commit** — `git commit -m "emailer: email d'offre complet (inclusions, comment ca marche, offre detaillee, devise convertie) + brief IA durci sans invention"`

### Task 5: pipeline + settings alignés

**Files:**
- Modify: `src/lib/pipeline.ts` (contactProspect :654-669 ; aiQualify :144-145)
- Modify: `src/lib/settings.ts` (SETTING_KEYS/ENV_MAP : `RENEWAL_PRICE`, `FX_RATES` ; DEFAULTS :91-92 `OFFER_PRICE: "259"`, `OFFER_CURRENCY: "USD"`, `RENEWAL_PRICE: "45"`)
- Modify: `src/lib/whop.ts:60` (défaut `"490"` → `"259"`)
- Modify: `src/app/settings/page.tsx:86` (placeholder `"490"` → `"259"` ; ajouter la ligne `{ key: "RENEWAL_PRICE", label: "Renouvellement annuel (année 2)", placeholder: "45" }`)

**Interfaces:**
- Consumes: `sendSalesEmail(p, previewUrl)` (Task 4), `OFFER_BASE_CURRENCY` (Task 1).
- Produces: rien de nouveau — comportement aligné.

- [ ] **Step 1: Implement** — `contactProspect` : supprimer le bloc todoList (654-668) et appeler `sendSalesEmail(p, preview)` ; `aiQualify` : `"…une offre de site vitrine à ${price} ${OFFER_BASE_CURRENCY}"` avec `const price = (await getSetting("OFFER_PRICE")) || "259";` (+ import `getSetting` et `OFFER_BASE_CURRENCY`) ; settings/whop/page comme ci-dessus.
- [ ] **Step 2: Verify** — `npm run typecheck` et `npm test` → tout OK, 21/21 suites.
- [ ] **Step 3: Commit** — `git commit -m "pipeline: brief validator au vrai prix + fin de la checklist dans l'offre ; settings alignes 259 USD / renouvellement 45"`

### Task 6: Deploy + settings production + vérification réelle

**Files:** aucun (opérations).

- [ ] **Step 1: Full check** — `npm run typecheck && npm test` → OK.
- [ ] **Step 2: Commit restant + push** — `git push origin main` (deploy Vercel auto).
- [ ] **Step 3: Settings prod** — via psql/Pool (pattern `scripts/_last-offers.mjs`) : upsert `OFFER_CURRENCY=USD`, `RENEWAL_PRICE=45`, `OFFER_PRICE=259` (si ≠ 259), `FX_RATES` laissé vide (rempli au premier envoi).
- [ ] **Step 4: Vérifier le rendu réel** — attendre le prochain envoi automatique (tick), relire la dernière ligne `emails` (pattern `_last-offers.mjs`) : devise convertie correcte, sections présentes, zéro « chantier »/« +30 % »/« gratuit » illégitime, CTA « Voir votre site ». Supprimer les scripts temporaires après vérification.
- [ ] **Step 5: Commit éventuel des scripts de vérif supprimés** — `git status` propre.
