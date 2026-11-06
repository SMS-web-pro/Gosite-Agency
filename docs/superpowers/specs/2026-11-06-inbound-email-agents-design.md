# Design — Réponses entrantes automatiques (Saler / Paymer / Support)

Date : 2026-11-06 · Statut : approuvé · Revue builder : intégrée

## Intention et pourquoi

Les leads qui répondent à nos emails de vente écrivent à `contact@gosite.digital`,
adresse routée par Cloudflare Email Routing vers la boîte `siteup.services@gmail.com`.
Aujourd'hui ces réponses s'entassent dans Gmail sans être lues par le système :
aucun agent ne réagit, le lead refroidit.

Objectif : que **Saler, Paymer et Support** restent en écoute de toutes les
réponses/propositions reçues et y répondent automatiquement, en temps réel,
sans intervention de l'opérateur (qui garde une vue et une coupure globale).

## Contraintes

- L'utilisateur final est unique (opérateur de l'agence) : pas de multi-compte.
- `contact@gosite.digital` est créé dans **Cloudflare** (Email Routing → forward
  vers `siteup.services@gmail.com`). Nous pouvons y ajouter un Worker.
- Envoi sortant : API Brevo (`BREVO_API_KEY`, expéditeur `BREVO_SENDER_EMAIL`,
  `replyTo` = expéditeur). L'expéditeur recommandé est `contact@gosite.digital`
  (**ops** : valider ce sender dans Brevo + SPF/DKIM/DMARC du domaine, sinon
  spam — noté dans le doc d'installation).
- Le cron tick tourne **une fois par jour** (13:30 UTC) : impossible d'attendre
  le tick pour répondre → traitement temps réel dans le webhook.
- Conformité acquise à préserver : DNC (`do_not_contact`), `looksLikeOptOut`,
  List-Unsubscribe, footer `AGENCY_ADDRESS`.
- Exigence explicite : ne répondre qu'aux emails **de clients existants**,
  jamais aux autres emails de la boîte.

## Approches envisagées

1. **Worker Cloudflare (temps réel) — retenue.** Le route Cloudflare envoie le
   MIME brut à un Worker ; le Worker le transmet à notre webhook et fait suivre
   à Gmail. Réponse en secondes, zéro identifiant Google, gratuit.
2. **Polling Gmail API (OAuth).** Rejeté : setup Google Cloud lourd, tokens à
   maintenir, latence jusqu'au tick suivant.
3. **Polling IMAP (mot de passe d'application).** Rejeté : fragile, latence,
   Google décourage l'IMAP.

## Design

### Flux complet

```
Client → contact@gosite.digital
  → Cloudflare Email Routing → Worker « gsd-inbound »
      ├─ message.forward("siteup.services@gmail.com")  D'ABORD, toujours
      └─ POST JSON parsé (ctx.waitUntil, try/catch) →
           https://gosite.digital/api/webhooks/email?secret=EMAIL_WEBHOOK_SECRET
              1. Vérif secret
              2. INSERT inbound_emails (status "new") — AVANT tout traitement
              3. Filtres non-répondre
              4. Rattachement au prospect
              5. Garde DNC/opt-out (sur le texte NOUVEAU, pas les citations)
              6. Garde anti-backscatter + rate-limit
              7. Décision d'agent + réponse (1 appel LLM)
              8. Envoi Brevo + archive + notif Telegram
```

Le Worker ne jette jamais avant le forward : `forward()` d'abord, webhook ensuite
en `ctx.waitUntil` avec try/catch. Une panne du webhook ne prive jamais Gmail.

### Filtres « ne pas répondre » (status `ignored`)

- expéditeur = `BREVO_SENDER_EMAIL` ou `CONTACT_EMAIL` (local part insensible
  à la casse) → casse les boucles ;
- auto-réponses : `Auto-Submitted` ≠ `no`, `X-Autoreply`,
  `X-Auto-Response-Suppress`, `X-Autorespond`, `Precedence: bulk|junk|list`,
  `List-Id`, expéditeur `mailer-daemon@`/`postmaster@`/`noreply@`/`no-reply@` ;
- **DSN structurels** (bounces) : `Content-Type: multipart/report;
  report-type=delivery-status`, `X-Failed-Recipients`, objets
  « Undelivered / Mail Delivery / Échec de remise » → pas de LLM, pas de
  réponse, **mais notification Telegram** (adresse morte à nettoyer) ;
- corps vide (< 2 caractères utiles) — le seuil ne s'applique **qu'aux
  unmatched** : un client matché qui écrit « Oui » déclenche une réponse
  (et toujours une notification Telegram, même ignoré).

### Extraction du texte NOUVEAU (anti faux-STOP)

Gmail cite notre footer (« Répondez "STOP"… ») dans chaque réponse du fil.
Tout traitement (opt-out, LLM) porte sur le texte **coupé après** les
marqueurs de citation : lignes `> `, « De : », « -----Message d'origine----- »,
« -----Original Message----- », « On … wrote: ». Le brut reste archivé (audit).
Fallback html-only : `text || stripHtml(html)` côté Worker.

### Rattachement au prospect

1. `In-Reply-To`/`References` (IDs normalisés : `<…>` strippés, casse
   insensible, **tous** les IDs de References testés) → `emails.message_id`
   → `prospect_id` ; fallback `prospects.salesEmailId`.
2. Sinon `From` normalisé = `prospects.email`.

Sans prospect (status `unmatched`) : archivé, pas de réponse, pas de LLM.

### Garde conformité

`looksLikeOptOut(texte_nouveau)` → `addDoNotContact(prospect)` + status
`optout` + Telegram « STOP demandé » ; aucune réponse envoyée.

### Garde anti-backscatter (nouvelle)

On ne répond que si **on a déjà écrit** à ce prospect
(`emails` status `sent`/`agent_reply` pour lui) — un forgeur qui usurpe un
`From` ne reçoit jamais de réponse d'une adresse qu'on n'a pas contactée.
Rate-limit : **≤ 2 réponses automatiques / adresse / 24 h**, cap global
configurable (`AUTO_REPLY_HOURLY_CAP`, défaut 20/h). Dépassement → status
`new` + Telegram (file humaine silencieuse).

### Décision d'agent et réponse (un seul appel LLM)

Un appel `chatCompletion` (timeout `AbortSignal` ~30 s) avec :
- **system** : les trois personas (Saler : négociation, questions sur le
  service ; Paymer : accord/paiement ; Support : technique, FAQ) + règles :
  langue du lead (US/UK → anglais, MA/FR → français), ≤ 120 mots, zéro
  promesse/donnée inventée, strictement le prix affiché, List-Unsubscribe et
  footer ajoutés par l'emailer.
- **user** : historique (6 derniers messages du prospect, chronologiques,
  texte nouveau uniquement) + message entrant.
- **sortie JSON coercée** (`llm-coerce`) :
  `{ agent: "saler"|"paymer"|"support", reply: string, needsHuman: boolean }`.
- **Anti prompt-injection** : la réponse sortante ne peut contenir que des
  URL en whitelist (`prospects.paymentUrl`, `deployedUrl`) ; tout autre lien
  est retiré ; cap de longueur 2 000 caractères.
- `needsHuman=true` (question juridique, demande insolite, agressivité, échec
  ou timeout LLM) → **status `human`**, pas d'envoi, Telegram « intervention
  humaine souhaitée ».
- Si `agent="paymer"` : **réutilisation** de `prospects.paymentUrl` si
  `paymentStatus="pending"`, sinon `createPaymentLink` (1 LLM max au total ; **réutilisation** de `paymentUrl` tant que
  `paymentStatus="pending"`, création seulement sinon — *décision*).
- Si `AUTO_REPLY_ENABLED` ≠ `on` : status `new` + Telegram avec le texte reçu
  (réponse manuelle depuis Gmail).

### Fiabilité (lesson du timeout 60 s)

- Row `inbound_emails` insérée **avant** tout travail (retry Cloudflare :
  dédoublonnée par index unique `message_id`).
- Le webhook traite en synchrone **un seul** appel LLM ; chaque `fetch`
  (LLM, Brevo, Telegram) a un `AbortSignal.timeout`.
- Le tick quotidien **réconcilie** : rows `new` de plus de 15 min → retraitement
  (idempotent, dédoublonné par status) ; après 3 tentatives → `human`.

### Envoi et archive

- `sendAgentReply` (emailer) : Brevo v3, `headers` = `In-Reply-To` =
  **Message-Id du message client entrant** (pas du dernier sortant) +
  `References` reconstitué, `replyTo` = expéditeur, **mêmes headers de
  conformité** (`List-Unsubscribe`/-Post) et **mêmes footer** `AGENCY_ADDRESS`
  que les emails de vente.
- Objet : `Re: {objet courant}`.
- Archive sortante : ligne `emails` `status = "agent_reply"`.
- Telegram : « 💬 {prospect} → {agent} : extrait… » (échappement HTML, extraits
  tronqués).

### Schéma

Nouvelle table `inbound_emails` (bootstrap inclus) :

| colonne | type | notes |
|---|---|---|
| id | serial pk | |
| prospect_id | integer nullable | null si unmatched |
| message_id | text notNull | Message-Id entrant, **index unique** (dédup retries) |
| from_email | text notNull | normalisée |
| from_name | text | |
| subject | text | |
| body_text | text notNull | texte brut du Worker (text + fallback stripHtml) |
| in_reply_to | text | IDs normalisés (References inclus) |
| status | text notNull default `new` | new \| replied \| ignored \| unmatched \| optout \| human |
| created_at | timestamp | |

Indexs : `message_id` unique, `prospect_id`, `from_email`.
`emails.status` gagne `agent_reply` (commentaire mis à jour).

### Réglages

Nouveaux settings (`settings.ts` + carte « Réception (Cloudflare) » dans
Réglages & API) :
- `CONTACT_EMAIL` — email de réception (placeholder `contact@gosite.digital`).
- `AUTO_REPLY_ENABLED` — `on`/`off`, **défaut `off`** (décision : semaine d'observation en Telegram seul, bascule manuelle dans Réglages).
- `AUTO_REPLY_HOURLY_CAP` — cap global/h (défaut 20).
- `EMAIL_WEBHOOK_SECRET` — secret dédié du webhook (généré, visible dans
  Réglages ; ne réutilise pas `CRON_SECRET`).

La carte affiche l'URL webhook complète à coller dans le Worker et renvoie vers
`docs/cloudflare-email-worker.md`.

### Worker Cloudflare (installé par l'opérateur, code fourni)

`docs/cloudflare-email-worker.md` : code Worker complet (handler `email`,
`postal-mime`, `forward()` Gmail **d'abord**, POST webhook en `waitUntil`
avec try/catch, fallback stripHtml) + pas-à-pas dashboard (Email Workers →
créer → route `contact@gosite.digital` → action Worker) + rappel ops
Brevo/SPF/DKIM.

### Fichiers touchés

- `src/db/schema.ts`, `src/db/bootstrap.ts` : table `inbound_emails`.
- `src/lib/inbound.ts` (nouveau, logique pure testée) : normalisation,
  filtres, extraction texte nouveau, rattachement, statuts, coercition,
  whitelist URL, rate-limit (compteurs en DB via `inbound_emails`).
- `src/lib/emailer.ts` : `sendAgentReply`.
- `src/app/api/webhooks/email/route.ts` (nouveau) : `runtime="nodejs"`,
  secret, orchestration, `maxDuration = 60`.
- `src/lib/settings.ts` : `CONTACT_EMAIL`, `AUTO_REPLY_ENABLED`,
  `AUTO_REPLY_HOURLY_CAP`, `EMAIL_WEBHOOK_SECRET`.
- `src/app/settings/page.tsx` : carte « Réception (Cloudflare) ».
- `src/lib/autopilot.ts` : réconciliation des `new` au tick.
- Notifications Telegram (canal existant).
- `tests/inbound.test.ts` : filtres, extraction, matching, coercition,
  whitelist, rate-limit.
- `docs/cloudflare-email-worker.md`.

## Décisions propriétaire (tranchées)

1. **`AUTO_REPLY_ENABLED` défaut `off`** — semaine d'observation en Telegram
   seul, bascule manuelle dans Réglages.
2. **Périmètre : uniquement les leads déjà contactés** (`stage ≥ contacted` /
   on leur a envoyé l'offre) — aussi protection anti-usurpation : une adresse
   jamais contactée ne reçoit aucune réponse automatique.
3. **Paiement** : réutilisation de `prospects.paymentUrl` tant que
   `paymentStatus="pending"`, création d'un lien seulement sinon.
   **Prix strictement non négociable** : aucune remise autorisée au LLM.

## Non-goals

- Pas de réponse automatique aux inconnus (spam, newsletters, fournisseurs).
- Pas de multi-boîte (une seule adresse de réception).
- Pas d'interface de lecture des entrants dans l'app pour l'instant
  (Telegram + page prospect suffisent) — pourra venir ensuite.
- Pas de pièces jointes (le texte du corps suffit ; les PJ restent dans Gmail).

## Anti-goals (échecs même si ça marche)

- Répondre à un email qui n'est pas d'un client (spam, notif, newsletter).
- Boucle d'auto-réponses entre deux serveurs de messagerie.
- Envoyer une réponse après un STOP — y compris via un footer cité.
- Répondre à une adresse que nous n'avons jamais contactée (backscatter).
- Réponse dans la mauvaise langue ou avec un prix/remise inventée.
