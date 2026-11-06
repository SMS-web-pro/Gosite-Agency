# Réponses entrantes automatiques — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Les réponses des clients reçues sur `contact@gosite.digital` (via Worker Cloudflare) déclenchent une réponse automatique de Saler/Paymer/Support, archivée et notifiée Telegram.

**Architecture:** Worker Cloudflare parse le MIME, forward à Gmail, POST JSON au webhook `/api/webhooks/email` (secret dédié). Le webhook insère la row d'abord (dédup par `message_id` unique), filtre (auto-réponses, boucles, DSN, inconnus), rattache au prospect (fil In-Reply-To/References puis adresse), garde DNC sur le texte nouveau, puis un seul appel LLM décide l'agent et rédige la réponse envoyée par Brevo. Le tick quotidien réconcilie les rows `new` échouées.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle 0.45.2, PostgreSQL (Neon), Brevo v3, tests `node --experimental-strip-types` via `scripts/test.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-06-inbound-email-agents-design.md`

## Global Constraints

- Drizzle 0.45.2 : `.returning()` **sans projection** (0 argument), update comme insert/delete.
- Ne jamais éditer les fichiers via round-trip PowerShell `Get-Content|Set-Content` (corruption des accents) — outils d'édition uniquement.
- Décisions tranchées : `AUTO_REPLY_ENABLED` défaut **`off`** ; rattachement réservé aux prospects **`stage >= "contacted"`** (STAGES : discovered, validated, email_verified, mapped, site_built, deployed, contacted, paid, domain_linked) ; `paymentUrl` **réutilisé** tant que `paymentStatus="pending"` ; **prix non négociable** (le prompt l'interdit, `sanitizeReplyUrls` ne garde que `paymentUrl`/`deployedUrl`).
- Rate-limits : `RATE_PER_ADDRESS_24H = 2` ; cap global `AUTO_REPLY_HOURLY_CAP` (défaut 20/h).
- Anti-backscatter : réponse seulement si le prospect a déjà reçu de nous un email (`emails.status in ("sent","agent_reply")`).
- Toujours répondre HTTP 200 au Worker après insertion de la row (pas de retry-storm) ; erreurs → status `new`/`human` + Telegram.
- Le Worker forward Gmail **avant** le webhook (dans le doc, Task 7).
- Commentaires en français, style du repo, sobres.

## Review Focus

1. Un client cite notre footer « Répondez STOP… » dans sa réponse → **pas** de DNC. Test : `extractNewText` coupe aux marqueurs de citation (Task 2).
2. Email html-only (Gmail fréquent) → `stripHtml` en fallback, corps non vide (Task 2, Task 7).
3. Réponse ultra-courte d'un client matché (« Oui », « OK ») → répondue ; le seuil de longueur ne s'applique qu'aux unmatched (Task 5).
4. Retry Cloudflare (même `message_id` en POST 2 fois) → dédoublonné par index unique, une seule réponse (Task 1, Task 5).
5. Boucle avec auto-répondeur sans headers → filet : rate-limit 2/24 h + filtre `isOwnAddress` (Task 2, Task 5).

---

### Task 1: Table `inbound_emails` (schema + bootstrap)

**Files:**
- Modify: `src/db/schema.ts` (après `emails`, ~ligne 113)
- Modify: `src/db/bootstrap.ts` (à côté de `do_not_contact`, ~ligne 136)

**Interfaces:**
- Produces: table Drizzle `inboundEmails` utilisée par Tasks 2/5/6 ; SQL bootstrap idempotent exécuté au démarrage prod.

- [ ] **Step 1: Ajouter la table dans `src/db/schema.ts`** (copier le patron `emails`) :

```ts
export const inboundEmails = pgTable("inbound_emails", {
  id: serial("id").primaryKey(),
  prospectId: integer("prospect_id"),
  messageId: text("message_id").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  subject: text("subject"),
  bodyText: text("body_text").notNull(),
  inReplyTo: text("in_reply_to"),
  status: text("status").notNull().default("new"), // new | replied | ignored | unmatched | optout | human
  headers: jsonb("headers").$type<Record<string, string | undefined>>(),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Mettre à jour le commentaire de `emails.status` : `// sent | failed | simulated | backfilled | agent_reply`.

- [ ] **Step 2: Ajouter le bootstrap SQL** (patron `do_not_contact`) :

```sql
CREATE TABLE IF NOT EXISTS inbound_emails (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER,
  message_id TEXT NOT NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body_text TEXT NOT NULL,
  in_reply_to TEXT,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_message_id ON inbound_emails (message_id);
CREATE INDEX IF NOT EXISTS idx_inbound_prospect ON inbound_emails (prospect_id);
CREATE INDEX IF NOT EXISTS idx_inbound_from ON inbound_emails (from_email);
```

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts src/db/bootstrap.ts
git commit -m "feat: table inbound_emails (schema + bootstrap)"
```

### Task 2: Logique pure `src/lib/inbound.ts` + tests (TDD)

**Files:**
- Create: `src/lib/inbound.ts`
- Test: `tests/inbound.test.ts`
- Modify: `scripts/test.mjs` (liste de copie : ajouter `inbound` à `src/lib/{format,niches,mapper,site-template,dnc,llm-coerce,inbound}.ts`)

**Interfaces:**
- Consumes: rien (fichier pur, zéro import `@/db` — obligatoire pour le runner de tests).
- Produces (signatures exactes pour Tasks 5/6) :

```ts
export type InboundHeaders = {
  autoSubmitted?: string; precedence?: string; autoReplySuppressed?: string;
  autorespond?: string; listId?: string; contentType?: string;
  xFailedRecipients?: string; inReplyTo?: string; references?: string;
};
export const RATE_PER_ADDRESS_24H = 2;
export function extractNewText(body: string): string;
export function stripHtml(html: string): string;
export function isAutoReply(h: InboundHeaders, fromEmail: string): boolean;
export function isDeliveryStatus(h: InboundHeaders, subject: string): boolean;
export function isOwnAddress(fromEmail: string, ownAddresses: string[]): boolean;
export function normalizeMessageIds(raw: string | null | undefined): string[];
export function coerceInboundDecision(raw: unknown): { agent: "saler" | "paymer" | "support"; reply: string; needsHuman: boolean } | null;
export function sanitizeReplyUrls(reply: string, allowedUrls: string[]): string;
export function shouldIgnoreShortUnmatched(text: string, matched: boolean): boolean;
```

- [ ] **Step 1: Écrire les tests (`tests/inbound.test.ts`, patron `tests/dnc.test.ts`, imports avec extension `.ts`)** — assertions exactes :
  - `extractNewText("Question sur le site\n\n> Répondez STOP\n\nLe 1 nov, X a écrit :")` ne contient ni `STOP` ni `a écrit` et contient `Question sur le site` ; coupe aussi sur `-----Original Message-----`, `-----Message d'origine-----`, `De :`/`From:` en début de ligne.
  - `stripHtml("<p>Bonjour <b>max</b></p>")` contient `Bonjour max` et ne contient pas `<`.
  - `isAutoReply({autoSubmitted:"auto-generated"},"a@b.c")` vrai ; `isAutoReply({precedence:"bulk"},"a@b.c")` vrai ; `isAutoReply({},"mailer-daemon@mf.sendgrid.net")` vrai (local part `mailer-daemon|postmaster|noreply|no-reply` insensible casse) ; `isAutoReply({autoSubmitted:"no"},"client@x.com")` faux.
  - `isDeliveryStatus({contentType:"multipart/report; report-type=delivery-status"},"x")` vrai ; `isDeliveryStatus({}, "Undelivered Mail Returned to Sender")` vrai ; `isDeliveryStatus({}, "Échec de remise")` vrai ; `isDeliveryStatus({},"Bonjour")` faux.
  - `isOwnAddress("CONTACT@Gosite.Digital",["contact@gosite.digital"])` vrai.
  - `normalizeMessageIds("<A@x> <b@y>")` = `["a@x","b@y"]` ; `normalizeMessageIds(null)` = `[]`.
  - `coerceInboundDecision({agent:"paymer",reply:"Voici le lien.",needsHuman:false})` → objet complet ; `{agent:"banque",...}` → `null` ; `null` → `null`.
  - `shouldIgnoreShortUnmatched("Oui", true)` faux ; `shouldIgnoreShortUnmatched("", true)` faux (un client matche n est jamais ignore pour longueur) ; `shouldIgnoreShortUnmatched("ok", false)` vrai ; `shouldIgnoreShortUnmatched("Message complet au-dela du seuil trente caracteres", false)` faux.
  - `sanitizeReplyUrls("Voir https://evil.com et https://whop.com/pay/x", ["https://whop.com/pay/x"])` ne contient pas `evil.com` et contient `whop.com/pay/x` ; sortie tronquée à 2000 caractères.

- [ ] **Step 2: Vérifier que ça échoue**

Run: `node scripts/test.mjs`
Expected: FAIL suite inbound (module absent).

- [ ] **Step 3: Implémenter `src/lib/inbound.ts`** (pur, aucun import) : marqueurs de citation en regex ancrés début de ligne ; local parts auto-répondeur en tableau ; URLs via regex `https?://\S+` filtrées par whitelist prefix ; troncature 2000.

- [ ] **Step 4: Vérifier que ça passe**

Run: `node scripts/test.mjs`
Expected: toutes suites OK (5/5).

- [ ] **Step 5: Commit**

```bash
git add src/lib/inbound.ts tests/inbound.test.ts scripts/test.mjs
git commit -m "feat: logique pure entrants (filtres, extraction, coercition, whitelist URL)"
```

### Task 3: Settings + carte Réglages « Réception (Cloudflare) »

**Files:**
- Modify: `src/lib/settings.ts` (KEYS + DEFAULTS + liste du GET filtré)
- Modify: `src/app/settings/page.tsx` (nouveau groupe dans la liste des cartes, patron « Whop — Paiements » ligne ~56)

**Interfaces:**
- Produces: `getSetting("CONTACT_EMAIL" | "AUTO_REPLY_ENABLED" | "AUTO_REPLY_HOURLY_CAP" | "EMAIL_WEBHOOK_SECRET")` pour Tasks 5/6.

- [ ] **Step 1: settings.ts** — 4 clés dans KEYS/DEFAULTS : `CONTACT_EMAIL` (`""`), `AUTO_REPLY_ENABLED` (`"off"`), `AUTO_REPLY_HOURLY_CAP` (`"20"`), `EMAIL_WEBHOOK_SECRET` (générer une constante hex 36 car. via `node -e "console.log(require('crypto').randomBytes(18).toString('hex'))"` et la coller en défaut, patron `CRON_SECRET`). Ne **pas** retirer `EMAIL_WEBHOOK_SECRET` du GET (le dashboard doit l'afficher pour composer l'URL du Worker).

- [ ] **Step 2: settings/page.tsx** — nouveau groupe `{ title: "Réception — Cloudflare Email", icon: Inbox, color: "#f472b6", fields: [...] }` :
  - `CONTACT_EMAIL` label `Email de réception` placeholder `contact@gosite.digital` hint `Route Cloudflare → Worker. URL webhook du Worker : https://gosite.digital/api/webhooks/email?secret=<EMAIL_WEBHOOK_SECRET> — voir docs/cloudflare-email-worker.md`
  - `AUTO_REPLY_ENABLED` label `Réponses automatiques` placeholder `on|off` hint `off = notifications Telegram seulement (recommandé la première semaine)`
  - `AUTO_REPLY_HOURLY_CAP` label `Cap global / heure` placeholder `20`
  - `EMAIL_WEBHOOK_SECRET` label `Secret webhook` secret `true`
  Importer l'icône `Inbox` de `lucide-react`.

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck && npm run lint`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add src/lib/settings.ts src/app/settings/page.tsx
git commit -m "feat: réglages réception (CONTACT_EMAIL, AUTO_REPLY_*, EMAIL_WEBHOOK_SECRET)"
```

### Task 4: `sendAgentReply` + moteur `src/lib/inbound-process.ts`

**Files:**
- Modify: `src/lib/emailer.ts` (après `sendSalesEmail`)
- Create: `src/lib/inbound-process.ts`

**Interfaces:**
- Consumes: `inbound.ts` (Task 2), `dnc.ts` (`looksLikeOptOut`, `addDoNotContact`, `isDoNotContact`, `normalizeEmail`), `llm.ts` (`chatCompletion({system,user,maxTokens,temperature}) => string|null`), `llm-coerce.ts`, `pipeline.ts` (`createPaymentLink(p)`), `telegram.ts` (`notifyTelegram(text)`), `settings.ts`, schema (`inboundEmails`, `emails`, `prospects`).
- Produces: `processInboundRow(id: number): Promise<{ ok: boolean; status: string }>` — utilisée par le webhook (Task 5) et le tick (Task 6).

- [ ] **Step 1: `emailer.ts` — ajouter** (réutiliser le patron Brevo de `sendSalesEmail`, mêmes headers de conformité `List-Unsubscribe`/-Post, même footer `AGENCY_ADDRESS` ajouté au texte) :

```ts
export async function sendAgentReply(params: {
  to: string; subject: string; bodyText: string;
  inReplyTo?: string; references?: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string; simulated?: boolean }>
```

Objet passé tel quel par l'appelant (préfixé `Re:`) ; `sender`/`replyTo` = `BREVO_SENDER_EMAIL` ; `textContent` ; `headers` Brevo = `{ "In-Reply-To": params.inReplyTo, References: params.references }` (seulement si fournis) ; timeout `AbortSignal.timeout(20000)`.

- [ ] **Step 2: `inbound-process.ts` — orchestration de `processInboundRow(id)`** :
  1. Charger la row ; si `status != "new"` → `{ok:true,status:row.status}`.
  2. `attempts + 1` en UPDATE (drizzle `.returning()` sans args).
  3. Si `attempts >= 4` → status `human` + Telegram, stop.
  4. Filtres purs (Task 2) sur la row : `row.headers` (jsonb, Task 1) casté en `InboundHeaders`, `row.fromEmail`, `row.subject`, `row.bodyText`, liste `[BREVO_SENDER_EMAIL, CONTACT_EMAIL]`. Les filtres `isAutoReply`/`isDeliveryStatus`/`isOwnAddress` s'appliquent sur `row.headers` / `row.fromEmail` / liste `[BREVO_SENDER_EMAIL, CONTACT_EMAIL]` → status `ignored` (+ Telegram si DSN, mention « bounce »).
  5. Rattachement : `normalizeMessageIds(row.inReplyTo)` (ids stockés bruts) ∩ `emails.messageId` du prospect → sinon `prospects.email = normalizeEmail(row.fromEmail)`. Aucun match → `unmatched`. Match mais `STAGES.indexOf(p.stage) < STAGES.indexOf("contacted")` OU zéro email sortant (`emails.prospectId = p.id` et status in sent/agent_reply) → `unmatched` (anti-backscatter).
  6. Texte nouveau : `extractNewText(row.bodyText)` ; opt-out (`looksLikeOptOut`) → `addDoNotContact(p.email, "stop_reply")` + status `optout` + Telegram.
  7. Seuil longueur : texte nouveau < 2 caractères **et** prospect matché → ne pas bloquer (Review Focus 3) ; row unmatched avec corps < 20 caractères → `ignored` silencieux.
  8. `AUTO_REPLY_ENABLED != "on"` → status `new` (conservé) + Telegram « réponse reçue, répondez manuellement » + extrait.
  9. Rate-limits : réponses `agent_reply` à `row.fromEmail` sur 24 h ≥ `RATE_PER_ADDRESS_24H`, ou global/heure ≥ `AUTO_REPLY_HOURLY_CAP` → status `human` + Telegram.
  10. Un appel `chatCompletion` (system : personas + langue du pays + prix non négociable + zéro invention ; user : historique 6 derniers messages + texte nouveau + lien payment si pending) → `coerceInboundDecision` ; `null` ou `needsHuman` → status `human` + Telegram.
  11. `agent = "paymer"` : `paymentStatus === "pending" && paymentUrl` → réutiliser, sinon `createPaymentLink(p)` et injecter `paymentUrl`/`deployedUrl` dans les URLs autorisées.
  12. `sanitizeReplyUrls(reply, allowed)` ; objet `Re: {dernier sujet sortant ou row.subject}` ; `sendAgentReply` avec `inReplyTo` = **Message-Id entrant du client** (`row.messageId`), `references` = ids concaténés.
  13. Succès : UPDATE status `replied` + INSERT `emails` (`status: "agent_reply"`, `toEmail`, `subject`, `bodyHtml: null`, `bodyText` non prévu — stocker le texte dans `subject` ? Non : `bodyHtml` reçoit `<p>` + texte échappé via `escapeHtml` de `format.ts`) + `notifyTelegram("💬 …")`. Échec Brevo : status `new` + Telegram, `{ok:false}`.
  14. Journal `activities` (agent `saler|paymer|support`, action `inbound_reply`) + `aiCalls` (1 par appel LLM) comme le reste du code.

- [ ] **Step 3: Vérifier**

Run: `npm run typecheck`
Expected: 0 erreur.

- [ ] **Step 4: Commit**

```bash
git add src/lib/emailer.ts src/lib/inbound-process.ts src/db/schema.ts src/db/bootstrap.ts
git commit -m "feat: moteur de réponse entrante (sendAgentReply + processInboundRow)"
```

### Task 5: Webhook `/api/webhooks/email`

**Files:**
- Create: `src/app/api/webhooks/email/route.ts` (patron `webhooks/whop/route.ts`)

**Interfaces:**
- Consumes: `EMAIL_WEBHOOK_SECRET`, `processInboundRow` (Task 4), filtres purs (Task 2).
- Produces: endpoint POSTé par le Worker Cloudflare (Task 7).

- [ ] **Step 1: Route** — `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60` :
  - `GET` → `{ ok: true, setup: "POST depuis le Worker Cloudflare — voir docs/cloudflare-email-worker.md" }`.
  - `POST` : secret via `?secret=` ou header `x-webhook-secret` comparé à `EMAIL_WEBHOOK_SECRET` (env ou settings) → 401 sinon.
  - Body JSON : `{ messageId, fromEmail, fromName, subject, text, html, headers }` (headers = objet brut strings).
  - `messageId` absent → 400. INSERT row (`body_text = text || stripHtml(html)`, `in_reply_to = [inReplyTo, references].filter(Boolean).join(" ")`, `headers` normalisés) `onConflictDoNothing` → si conflict, `{ ok: true, dedup: true }` (Review Focus 4).
  - Puis `await processInboundRow(row.id)` ; **toujours** répondre 200 `{ ok: true, status }` après insertion (erreurs internes attrapées → 200 `{ ok:false }` + Telegram).

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck && npm run lint`
Expected: 0 erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/webhooks/email/route.ts
git commit -m "feat: webhook email entrant (secret dédié, dédoublonnage, 200 always)"
```

### Task 6: Réconciliation au tick

**Files:**
- Modify: `src/lib/autopilot.ts` (dans `runTickBody`, après le pipeline, patron maintenance)

**Interfaces:**
- Consumes: `processInboundRow` (Task 4), `inboundEmails`.

- [ ] **Step 1: Au tick** — sélectionner `inbound_emails` `status = "new"` et `created_at < now() - 15 min`, limiter à 5, boucler `processInboundRow` (try/catch par row), compter `{ reconciled, human }` et l'ajouter au résumé du tick (comme `purge`).

- [ ] **Step 2: Vérifier**

Run: `npm run typecheck && npm test`
Expected: 0 erreur, 5/5 suites.

- [ ] **Step 3: Commit**

```bash
git add src/lib/autopilot.ts
git commit -m "feat: réconciliation des entrants non traités au tick"
```

### Task 7: Doc d'installation `docs/cloudflare-email-worker.md`

**Files:**
- Create: `docs/cloudflare-email-worker.md`

**Interfaces:**
- Consumes: rien du code ; URL webhook + secret lisibles dans Réglages (Task 3).

- [ ] **Step 1: Écrire le doc** — sections :
  1. **Code Worker complet** (à coller dans le dashboard) : handler `email(message, env, ctx)` ; `const mime = await postalMime.parse(message.raw)` ; **d'abord** `await message.forward("siteup.services@gmail.com")` dans try/catch (jamais throw avant) ; puis extraction `{messageId, from, subject, text, html, headers}` (headers utiles : Auto-Submitted, Precedence, X-Auto-Response-Suppress, X-Autorespond, List-Id, Content-Type, X-Failed-Recipients, In-Reply-To, References) ; `ctx.waitUntil(fetch(WEBHOOK_URL, {method:"POST", body: JSON.stringify(...)}))` avec try/catch — le forward ne dépend jamais du webhook. `import PostalMime from "postal-mime"` (esm.sh).
  2. **Pas-à-pas dashboard Cloudflare** : Email → Email Routing → Email Workers → Create → coller le code → Add route : adresse `contact@gosite.digital` → action **Send to Worker**.
  3. **Ops Brevo/DNS** : valider `contact@gosite.digital` comme sender Brevo (SPF/DKIM du domaine), sinon spam.
  4. **Test de bout en bout** : mail depuis une adresse d'un prospect contacté de la DB → attendre < 1 min → vérifier status `replied` dans la DB / notification Telegram ; puis `AUTO_REPLY_ENABLED=on`.

- [ ] **Step 2: Vérifier**

Run: `git status`
Expected: doc présent, rien d'autre d'oublié.

- [ ] **Step 3: Commit**

```bash
git add docs/cloudflare-email-worker.md
git commit -m "docs: installation du Worker Cloudflare de réception"
```

### Task 8: Vérification globale, déploiement, contrôles prod

**Files:** aucun nouveau.

- [ ] **Step 1: Suite complète locale**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: 0 erreur, 5/5 suites, build OK.

- [ ] **Step 2: Push + attendre READY** (API Vercel, patron existant : `GET /v6/deployments?projectId=prj_tQlwj5gLxEmYKap4WMpghfqXvh6i&target=production`, boucle 10 s jusqu'à `READY`).

- [ ] **Step 3: Contrôles prod (script node temporaire, patron des phases précédentes)** :
  - `GET /api/webhooks/email` sans secret → 401 ; POST sans secret → 401.
  - POST avec `?secret=EMAIL_WEBHOOK_SECRET` et `messageId` de test `verify-<timestamp>@gosite.digital`, `fromEmail: "inconnu@example.com"` → 200 + row `unmatched` en DB (puis la supprimer).
  - Table `inbound_emails` + index unique présents en prod (bootstrap).
  - Carte Réglages visible (GET /settings authentifié contient `EMAIL_WEBHOOK_SECRET`).

- [ ] **Step 4: Commit éventuel (chore) + résumé final à l'utilisateur** avec les clics Cloudflare restants (Task 7) et le rappel Brevo/DNS.
