# Archive des emails envoyés (Saler) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Archiver tout email envoyé par Saler (objet + corps HTML + statut) en base, consultable via une page « Emails envoyés » et la fiche prospect, avec rétro-complétion des anciens envois via l'API Brevo.

**Architecture:** Table `emails` créée par le bootstrap DDL idempotent existant. `sendSalesEmail` renvoie désormais le contenu réel envoyé ; le pipeline l'archive (succès et échec). Trois endpoints API + une page `/emails` + une section sur la fiche prospect.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM (driver dual-mode Neon/PGlite), lucide-react, style CSS vars existant ; pas de framework de test (verification = `npm run typecheck`, `npm run build`, HTTP smokes).

**Spec:** `docs/superpowers/specs/2026-11-03-email-archive-design.md`

## Global Constraints
- Aucune modification des logs d'activité existants ni des notifications Telegram (ces comportements restent inchangés).
- Serverless : chaque endpoint/API doit rester bref (< 60s Vercel) ; la rétro-complétion est par lot (max 25).
- Requêtes DB via `db` de `@/db` + `ensureSchema()` implicite (déjà branché).
- UI en français, style du thème actuel (CSS vars, `chip`, `card`, `navlink`).
- Commits : uniquement sur demande explicite de l'utilisateur (« commite et pousse ») — le plan se termine par la proposition de commit.

## Review Focus
- Email archivé sans prospect lié (`prospectId` null) → l'UI affiche le destinataire brut, pas de crash. Test pinned: Task 4 Step 4 (curl liste avec ligne orpheline simulée via SQL si dispo).
- Corps HTML hostile ou volumineux → rendu uniquement dans `<iframe sandbox="" srcDoc={...}>`, jamais `innerHTML`. Test pinned: Task 4 Step 2 (code review au moment de la construction).
- Backfill partiel (clé absente, messageId inconnu, rétention Brevo expirée) → compte-rendu `{fetched, archived, skipped, missing}` sans crash, idempotent (unique sur `message_id`). Test pinned: Task 3 Step 4.
- Format variable de l'API Brevo (`htmlContent` string ou array) → extraction tolérante, contenu vide → `skipped`. Test pinned: Task 3 Step 3.
- Renvoi du même prospect (boucle autopilote) → une ligne d'archive par envoi, aucune écriture bloquante. Test pinned: Task 2 Step 3 (code review : pas de check-upsert qui throw).

---

### Task 1: Table DB `emails` (Drizzle + bootstrap)

**Files:**
- Modify: `src/db/schema.ts` (après `activities`, ~ligne 95)
- Modify: `src/db/bootstrap.ts` (DDL, après la table `activities` ~ligne 74, et index après ligne 160)

**Interfaces:**
- Produces (pour Tasks 2-5): table drizzle `emails` exportée depuis `@/db/schema`, colonnes: `id` serial PK; `prospectId` integer ("prospect_id"); `toEmail` text ("to_email") NOT NULL; `subject` text; `bodyHtml` text ("body_html"); `status` text NOT NULL DEFAULT 'sent' (valeurs: sent | failed | simulated | backfilled); `messageId` text ("message_id") UNIQUE définit le moins possible; `error` text; `createdAt` timestamp ("created_at") NOT NULL DEFAULT now().

- [ ] **Step 1: Déclarer la table Drizzle** dans `src/db/schema.ts` avec les colonnes ci-dessus + `export type EmailRow` (inferred), suivi du pattern `activities`.

- [ ] **Step 2: Ajouter le DDL** `CREATE TABLE IF NOT EXISTS emails (...)` dans `bootstrap.ts` (colonnes miroir snake_case) + `CREATE INDEX IF NOT EXISTS idx_emails_prospect ON emails (prospect_id);` + `CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_message ON emails (message_id);`.

- [ ] **Step 3: Vérifier** — Run: `npm run typecheck` → PASS (aucune erreur nouvelle).

### Task 2: emailer renvoie le contenu + archivage pipeline

**Files:**
- Modify: `src/lib/emailer.ts` (type `SendResult` ligne 72, `sendSalesEmail` lignes 74-119)
- Modify: `src/lib/pipeline.ts` (fonction `contactProspect`, lignes 427-446)

**Interfaces:**
- Consumes: table `emails` (Task 1).
- Produces (pour Tasks 3-5): les lignes archivées contiennent `subject`, `bodyHtml`, `status` ∈ {sent, failed, simulated}, `messageId`, `error` les échecs ; nouvelle signature `SendResult = { ok: boolean; simulated: boolean; messageId?: string; error?: string; subject?: string; bodyHtml?: string }`.

- [ ] **Step 1: emailer** — dans `sendSalesEmail`: générer `bodyHtml = renderEmail({...})` une seule fois avant la branche d'envoi; inclure `subject` et `bodyHtml` dans chaque retour (succès Brevo, simulation, erreurs "Email absent"/"Brevo non configuré" incluses — le corps existe déjà).

- [ ] **Step 2: pipeline** — dans `contactProspect`: importer `emails` de `@/db/schema`; branche échec (avant le throw): `db.insert(emails).values({ prospectId: p.id, toEmail: p.email ?? "", subject: res.subject, bodyHtml: res.bodyHtml, status: "failed", error: res.error })` ; branche succès (avant `logActivity`): `db.insert(emails).values({ prospectId: p.id, toEmail: p.email ?? "", subject: res.subject, bodyHtml: res.bodyHtml, status: res.simulated ? "simulated" : "sent", messageId: res.messageId })` (résultat ignoré, pas de await-chain qui throw).

- [ ] **Step 3: Vérifier** — Run: `npm run typecheck` → PASS; code review: aucune tendance throw dans l'archivage.

### Task 3: API `/api/emails`, `/api/emails/[id]`, `/api/emails/backfill`

**Files:**
- Create: `src/app/api/emails/route.ts`
- Create: `src/app/api/emails/[id]/route.ts`
- Create: `src/app/api/emails/backfill/route.ts`

**Interfaces:**
- Consumes: table `emails`, `prospects` (Task 1), `getSetting("BREVO_API_KEY")` de `@/lib/settings`.
- Produces: `GET /api/emails?status=&prospectId=` → `NextResponse.json({ emails: [{ id, prospectId, businessName, toEmail, subject, status, error, messageId, createdAt }] })` (limit 50, order by createdAt desc, leftJoin prospects); `GET /api/emails/[id]` → `{ ...emails row, businessName }` ou `NextResponse.json({ error: "Introuvable" }, { status: 404 })`; `POST /api/emails/backfill` → `{ fetched, archived, skipped, missing }`.

- [ ] **Step 1: route liste** — pattern de `src/app/api/activity/route.ts` (`runtime = "nodejs"`, `dynamic = "force-dynamic"`, limit 50, leftJoin `prospects` pour `businessName`, champs minimaux sans `bodyHtml`). **Step 2: route détail** — contenu complet incluant `bodyHtml`.

- [ ] **Step 3: route backfill** — POST: 1) `getSetting("BREVO_API_KEY")`; si absente → `{ error: "BREVO_API_KEY non configurée", fetched: 0, archived: 0, skipped: 0, missing: 0 }` (200). 2) Sélectionner les prospects ayant `salesEmailId` et dont l'id n'est pas présent avec le même `messageId` dans `emails` (NOT IN via leftJoin anti-join), max 25. 3) Pour chacun: `GET https://api.brevo.com/v3/smtp/emails/{messageId}` (header `api-key`); extraction tolérante: `subject = data.subject ?? null`; `html = Array.isArray(data.htmlContent) ? data.htmlContent.join("") : data.htmlContent ?? ""`; HTML vide → pointeur `skipped`; 404/HTTP != 200 → `missing`; sinon INSERT status "backfilled" + prospectId + messageId → `archived`. 4) Retourner les compteurs. Chaque fetch en `try/catch` silencieux → classé `missing`.

- [ ] **Step 4: Vérifier** — Run: `npm run typecheck` → PASS. Smoke condensé sans boucle: `npm run build 2>&1 | Select-Object -Last 3` → OK.

### Task 4: Page `/emails` + lien sidebar

**Files:**
- Create: `src/app/emails/page.tsx`
- Modify: `src/components/app-shell.tsx` (NAV lignes 12-19, import lucide ligne 6)

**Interfaces:**
- Consumes: endpoints Task 3.
- Produces: page UI de référence pour la Task 5 (liste compacte dupliquée, pas de composant partagé — 1 usage).

- [ ] **Step 1: NAV sidebar** — ajouter `{ href: "/emails", label: "Emails envoyés", icon: Mail }` dans `NAV` (import `Mail` chez les icônes lucide existantes).

- [ ] **Step 2: page liste** — page `"use client"` `/emails`: `useApi<{ emails: EmailRow[] }>("/api/emails", 20000)`; ligne = objet + destinataire (ou `businessName`), chip de statut (couleurs: sent=var(--accent), simulated=style warn, failed=rouge), "il y a …" via `timeAgo` copié du pattern `src/app/page.tsx:60`; clic → détail via `GET /api/emails/${id}` → `<iframe sandbox="" srcDoc={bodyHtml} style={{ width: "100%", minHeight: 480, background: "#fff", borderRadius: 12 }} />`.

- [ ] **Step 3: bouton rétro-complétion** — « Récupérer les anciens emails »: POST `/api/emails/backfill` puis reload; affiche `archivés: X, ignorés: Y, introuvables: Z` en toast.

- [ ] **Step 4: Vérifier** — Run: `npm run typecheck; npm run build 2>&1 | Select-Object -Last 3` → PASS + `ƒ (Dynamic)`. Smoke HTTP après start local: `Invoke-WebRequest https://.../emails` → 200 (fait sur PROD après déploiement, pas obligatoire ici).

### Task 5: Section « Emails » sur la fiche prospect

**Files:**
- Modify: `src/app/prospects/[id]/page.tsx` (~lignes 45-62 pour le load, rendering dans le JSX principal après la timeline)

**Interfaces:**
- Consumes: `GET /api/emails?prospectId=` (Task 3); style de liste Task 4 (duplicatié compact, pas de composant partagé — 1 usage).

- [ ] **Step 1: load** — ajouter `useApi<{ emails: EmailListRow[] }>(\`/api/emails?prospectId=${id}\`, 15000)`.

- [ ] **Step 2: render** — sous la timeline: titre « Emails envoyés », liste compacte (objet, chip, date), expansion iframe idem Task 4; si aucune ligne et `p.salesEmailId` présent → bouton backfill (réutilise POST) ; si aucune et pas de salesEmailId → ligne « Aucun email envoyé ».

- [ ] **Step 3: Vérifier** — Run: `npm run typecheck; npm run build 2>&1 | Select-Object -Last 3` → PASS.

### Task 6: Vérification finale + proposition de commit

- [ ] **Step 1:** `npm run typecheck` → PASS.
- [ ] **Step 2:** `npm run build` → OK sans erreurs (warnings lint préexistantes tolérées).
- [ ] **Step 3 (après redéploiement prod si push):** smokes HTTP: `/emails` 200, `/api/emails` 200 JSON, `/api/emails/backfill` POST → compteurs JSON.
- [ ] **Step 4:** Résumer à l'utilisateur + demander « commite et pousse » si voeux.
