# Design — Email d'offre professionnel qui convertit (Saler)

Date : 2026-11-16 · Statut : en approbation

## Intention et pourquoi

L'email d'offre actuel ne convertit pas : copie générique répétée, vocabulaire hors-métier
(« photos de chantier » envoyé à des salles de sport), chiffre inventé (« +30 % de trafic »),
CTA « gratuit » sur une offre payante, encadré prix sans substance, et un bug de devise qui
affiche « 259 MAD » (~26 $) au lieu de 259 USD. Objectif : un email de vente professionnel,
riche en informations **réelles**, qui donne au client tout ce qu'il faut pour dire oui —
sans agressivité, sans fait inventé.

## L'offre réelle (donnée par l'opérateur — source de vérité)

- Création complète : **259 $ USD, paiement unique**.
- Inclus : **nom de domaine 1 an** + **hébergement 1 an**.
- **Support et modifications : 3 mois gratuits**.
- Année suivante : **45 $/an** (renouvellement domaine + hébergement).
- Le montant est **converti automatiquement** dans la devise du lead (EUR, MAD, GBP…).
- Les avantages à lister sont ceux du **site réellement généré** (détectés depuis le bundle).

## Approches considérées

- **A. Correctif minimal** — bugs seulement, template inchangé. Écarté : l'email reste maigre,
  ne répond pas à la demande de conversion.
- **B. Email complet + copie pro (choisi)** — sections déterministes alimentées par les vraies
  données du site, brief IA durci, conversion de devise réelle, garde-fous anti-invention.
- **C. Page de vente longue** — FAQ, comparatif, témoignages. Écarté : trop lourd pour un
  premier contact à froid (spam, lecture mobile tronquée).

## Périmètre

### 1. Conversion de devise — `src/lib/fx.ts` (nouveau, testé)

- Prix de base **toujours en USD**, ancré par la constante `OFFER_BASE_CURRENCY = "USD"` dans
  `fx.ts` — jamais lu des settings (une config fausse ne peut pas recréer le bug « 259 MAD »).
  Les settings en production passent à `OFFER_CURRENCY=USD` (aujourd'hui le chiffre est
  réutilisé tel quel dans une autre devise) pour aligner l'affichage RIO et le lien Whop simulé.
- Devise d'affichage du lead : `clientData.CURRENCY` **prioritaire** — le Mapper la remplit
  déjà pour chaque lead via `localeFor` (MAD/USD/GBP/EUR, défaut EUR). Le mapping pays → devise
  (US→USD, GB→GBP, MA→MAD, défaut EUR si francophone sinon USD) ne sert que de **repli** si la
  fiche est absente/invalide. Pas de CHF/CAD : `localeFor` ne les produit pas, ce seraient des
  chemins morts.
- Taux réels via `open.er-api.com/v6/latest/USD` (gratuit, sans clé), **cache 24 h** dans la
  table settings (`FX_RATES`). Fallbacks : cache expiré si l'API échoue ; jamais de cache du
  tout → affichage en USD `$259` (jamais un montant faux).
- Arrondi marketing **vers le bas** : multiple de 10 (< 10 000), de 100 (< 100 000), sinon 1 000.
  Ex. 2 573 → 2 570 MAD. Jamais plus cher que le taux réel.
- `formatMoney` : `$259`, `£210`, `2 570 MAD`, `249 €` (Intl.NumberFormat).
- Affichage email : devise du lead en principal, « ≈ 259 $ » discret si devise ≠ USD
  (le checkout Whop reste dans sa devise ; le « ≈ » garantit l'honnêteté).

### 2. Contenu déterministe — `src/lib/bundle.ts`

- Nouveau `generateIncludedFeatures(config): string[]` (fr/en) — uniquement des faits du
  bundle : page d'accueil à votre image, vos services détaillés, galerie, formulaire de
  contact, horaires/carte, parfait sur mobile, référencement Google local, mentions légales.
- `generateTodoList` : vocabulaire **niche-neutre** (« vos propres photos », « vos coordonnées
  légales ») — et surtout **retirée de l'email d'offre** (les demandes de données vivent dans
  l'étape « Comment ça marche »).

### 3. Template email — `src/lib/emailer.ts` (renderEmail / renderEmailText)

Structure : header (inchangé) → hook IA → **3 bullets personnalisées IA** (bloc ✓ à sa position
actuelle : l'observation et l'enjeu métier du lead) → **« Ce que votre site inclut déjà »**
(liste
déterministe) → **« Comment ça marche »** (3 étapes fixes : 1. vous répondez à cet email,
2. on finalise avec vos infos et on met en ligne sous 48 h, 3. un seul paiement, quand vous
êtes prêt) → **encadré offre** (prix converti en gros ; ligne création ; domaine 1 an inclus ;
hébergement 1 an inclus ; support & modifs 3 mois ; année suivante 45 $/an converti) → preuve
Google (existante) → **CTA unique** « Voir votre site → » + « Une réponse à cet email suffit »
→ signature + footer STOP (inchangés). Version texte calquée. Plus de bloc `todoList`.

### 4. Brief IA durci + garde-fou (testé)

- Le LLM ne rédige **que** : subject, hook, 3 bullets personnalisées par métier (appuyées sur
  SELLING_ANGLE / TAGLINE / aiInsight), closing. Prix, étapes, inclusions = déterministes.
- Brief conversion : cadre PAS allégé, ton pro humain, vouvoiement, une seule action, interdits
  explicites : pourcentages et stats non vérifiables, « gratuit » (réservé aux inclusions
  réelles), superlatifs non prouvés, faux compte à rebours.
- `sanitizeCopy` (fonction pure) : supprime toute bullet/subject contenant un `%` ou un
  « gratuit » illégitime ; retombe sur les fallbacks si moins de 2 bullets survivent. Passe 2
  « directeur commercial » conservée.

### 5. Pipeline — `src/lib/pipeline.ts`

`contactProspect` ne génère plus la checklist ni ne la passe à `sendSalesEmail`.

### 6. Surfaces de prix périmées — alignées au passage

- Brief Validator (pipeline.ts:145) : « ~490€ » codé en dur → lit `OFFER_PRICE`
  (zéro fait inventé : le validateur doit évaluer avec le vrai prix).
- Placeholder « 490 » des Réglages → reflète 259.
- `whop.ts` : inchangé (lit déjà `OFFER_PRICE`/`OFFER_CURRENCY`, alignés en prod).

## Contraintes

- Aucune nouvelle clé d'API (taux sans clé). Zéro fait inventé (principe du repo).
- LLM indisponible → fallbacks complets par langue (comme aujourd'hui, jamais de blocage).
- List-Unsubscribe / STOP conservés.

## Anti-goals

Pas de garantie/remboursement (pas annoncé par l'opérateur), pas de faux témoignages, pas de
pression artificielle (rareté, urgence), pas de relance automatisée dans ce chantier.

## Définition de « fini »

- Emails de test régénérés sur de vrais leads récents (gym, salon) : devise convertie correcte,
  sections présentes, zéro vocabulaire hors-métier, zéro chiffre inventé, CTA cohérent.
- `tests/fx.test.ts` + `tests/offer-copy.test.ts` câblés dans `scripts/test.mjs` : conversion,
  arrondi, fallbacks, sanitize (le « +30 % » du lead 2084 serait attrapé), inclusions, checklist
  neutre. Typecheck + lint OK.
- Settings prod mis à jour (`OFFER_CURRENCY=USD`, `RENEWAL_PRICE=45`), deploy vérifié.

## Resté au builder

Formatage fin des montants, placement exact du « ≈ 259 $ », wording final des étapes, tailles
de police/bordures des nouveaux blocs (esprit du template actuel conservé).
