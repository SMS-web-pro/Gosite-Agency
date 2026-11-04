# Design — Saler professionnel 2 passes + emails multilingues

Date : 2026-11-03 · Statut : soumis à approbation · Taille : changement moyen

## Intent / pourquoi
Les emails actuels (1 passe LLM + template basique) ne convertissent pas : un prospect doit
recevoir une offre **digne d'un vrai commercial** — structure de vente éprouvée, ton pro,
design d'agence — **et dans SA langue** (prospect USA → anglais, France/Maroc → français).

## Buts
1. **Rédaction 2 passes** : ① brouillon commercial (framework PAS : Problème → Douleur →
   Solution + preuve factuelle + garantie), ② passe « directeur commercial » qui critique et
   affine (spécificité, douleur, CTA, longueur). ~2× tokens par email, modèle actuel
   (Réglages → LLM_MODEL).
2. **Email multilingue** : la langue est déduite du prospect dans cet ordre :
   `clientData.LANG` (fiche Mapper) → table pays → repli `fr` par défaut.
   Table initiale : USA/États-Unis/US… → `en` ; UK/Royaume-Uni/GB → `en` ; Canada/Maroc/Algérie/
   Tunisie/France/Belgique → `fr`. Extensible sans code (objet JS).
3. **Template d'agence** : table HTML responsive 600px en styles inline (compat Gmail/Outlook),
   bandeau GoSite Digital, intro personnalisée, 3 bullets de valeur avec pictos, **encadré
   d'offre** (prix + monnaie depuis la fiche client, délai 48h, sans abonnement), ligne de
   réassurance factuelle (note/avis du lead, aucune invention), CTA unique, signature,
   footer légal + désinscription. Libellés traduits par langue (fr/en au départ).
4. **L'archive n'est pas touchée** (le corps HTML archivé reste exactement l'envoyé).

## Non-buts
- Pas de faux témoignages / chiffres inventés (réassurance factuelle uniquement).
- Pas d'envoi manuel depuis l'UI, pas de tracking des ouvertures.
- Pas d'arabe/RTL ni d'autres langues au départ (pack langues extensible).

## Contraintes
- Serverless : les 2 passes LLM séquentielles sont tolérées (emailing n'est pas dans le chemin
  critique du cron — un échec est journalisé comme aujourd'hui).
- Génération JSON tolérante : réutiliser l'infrastructure existante `agentThinkJson`.
- Si la passe 2 échoue → envoi du brouillon de la passe 1 (repli, jamais de blocage pipeline).
- Prix depuis Réglages (`OFFER_PRICE`) ; monnaie : `clientData.CURRENCY` sinon `OFFER_CURRENCY`.

## Approches considérées
- **A** 1 passe + template : écartée sur demande client (qualité jugée insuffisante).
- **B (retenu)** 2 passes + template agence + multilingue.
- **C** changer de modèle (`LLM_MODEL` dans Réglages) : complément possible à tout instant,
  testé après ; ne fait pas partie du code à écrire.

## Parties prévues
1. `src/lib/emailer.ts` : pack de libellés par langue (`LANG_PACK`: fr/en) + helper
   `resolveLang(p)` ; `aiSalesCopy` → 2 appels `agentThinkJson` (rédacteur, puis critique)
   retournant une structure JSON précise (subject, hook, bullets ×3, proofLine,
   offerTitle, cta, closing) **rédigée dans la langue résolue** ; `renderEmail` réécrit en
   table responsive consommant cette structure ; replis conservés (sans LLM → contenu fixe
   déjà traduit par langue).
2. Aucun changement pipeline / archivage / API / UI du jour — l'archive continue d'enregistrer
   exactement le corps envoyé.
3. Vérifications : typecheck + build ; ensuite un envoi réel déclenché par l'utilisateur
   (action Deploie → contact sur un lead) pour juger le rendu dans l'archive et sa boîte mail.

## Laissé au builder
Copy exacte des packs fr/en (français/anglais commercial naturel), détails visuels du template,
2 à 4 bullets selon les éléments réellement disponibles dans la fiche.
