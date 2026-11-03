# Design — Archive des emails envoyés par Saler

Date : 2026-11-03 · Statut : approuvé (option A) · Taille : changement moyen

## Intent / pourquoi
Saler rédige et envoie des emails via Brevo, mais le contenu (objet + corps) est perdu
après l'envoi : impossible de vérifier ce que les prospects ont réellement reçu.
Objectif : une source de vérité locale, consultable depuis l'app.

## Buts
- Chaque email (succès **et** échec) est archivé en base : destinataire, objet, corps HTML complet, statut (`envoyé` / `échoué` / `simulé`), date, ID Brevo, erreur éventuelle.
- Une page **/emails** (sidebar) : liste paginée + lecture du contenu tel que reçu.
- Un aperçu des emails sur la fiche de chaque prospect (`/prospects/[id]`).
- Rétro-complétion : récupérer le contenu des emails **déjà envoyés** via l'API Brevo (par `salesEmailId`), bouton à la demande sur la page.

## Non-buts
- Aucun envoi depuis l'UI (l'envoi reste piloté par le pipeline).
- Ni tracking d'ouvertures/clics, ni boîte de réception, ni réponses (hors périmètre).
- Pas de statistiques Brevo avancées (délivrabilité etc.).

## Approches considérées
- **A (retenu)** — table locale + page app : source de vérité durable, recherche/consultation à tout moment, indépendant de la rétention Brevo.
- B — lecture à la demande via API Brevo : écarté (rétention limitée de Brevo, pas de recherche locale, dépendance externe à chaque consultation).

## Contraintes
- Serverless Vercel : tout endpoint doit rester court ; la rétro-complétion est déclenchée à la demande (bouton) puis traitée par lot.
- Schéma via le bootstrap DDL idempotent existant (`src/db/bootstrap.ts`), driver dual-mode (Neon/PGlite).
- Le corps est déjà rendu en HTML par `renderEmail()` ; `sendSalesEmail` renverra désormais aussi objet + corps au pipeline.

## Parties prévues
1. **DB** : table `emails` (id, prospect_id, to_email, subject, body_html, status, message_id, error, uploaded_at→created_at) + bootstrap.
2. **emailer.ts** : `sendSalesEmail` retourne `{ ...SendResult, subject?, bodyHtml? }` (contenu réel envoyé, IA ou repli).
3. **pipeline.ts** `contactProspect` : enregistre l'email en base (succès : `envoyé`+contenu ; échec : `échoué`+erreur) avant le log d'activité existant (inchangé).
4. **API** : `GET /api/emails` (liste jusqu'à 50, filtre statut) et `GET /api/emails/[id]` (contenu complet) ; `POST /api/emails/backfill` (lot Brevo, idempotent grâce au message_id).
5. **UI** : lien sidebar « Emails » ; liste (l'objet, prospect, statut, il y a …) ; vue de lecture rendant body_html ; section « Emails » dans la fiche prospect.

## Laissé au builder
Style des pages (assumer le thème existant), sandboxing iframe, pagination simple, génération texte français de l'UI.
