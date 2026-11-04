# Saler pro 2-passe + multilingue - Plan d'implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Saler redige des emails de vente professionnels en 2 passes LLM, dans la langue du prospect (en/fr), rendus dans un template HTML d'agence, avec replis traduits sans LLM.

**Architecture:** Tout vit dans src/lib/emailer.ts : resolveLang (clientData.LANG puis table pays puis fr), pack de libelles LANG_PACKS par langue, aiSalesCopy en 2 appels agentThinkJson sequentiels (redacteur puis directeur commercial qui critique), renderEmail reecrit en table responsive 600px. Aucun changement ailleurs (pipeline, archive, API, UI).

**Tech Stack:** TypeScript, agentThinkJson existant (src/lib/agent-brain.ts), HTML email styles inline. Verification: npm run typecheck / npm run build (pas d'infra de test).

**Spec:** docs/superpowers/specs/2026-11-03-saler-pro-multilangue-design.md

## Global Constraints
- Signature INCHANGEE pour l'exterieur: sendSalesEmail(p, previewUrl) : Promise&lt;SendResult&gt; avec { ok, simulated, messageId?, error?, subject?, bodyHtml? }. Le pipeline et l'archive continuent sans modification.
- Repli jamais bloquant: passe 2 echouee -> brouillon passe 1 ; passe 1 echouee -> contenu fixe du pack (fr/en) ; prospect hors pack -> fr.
- Reassurance UNIQUEMENT factuelle (note Google, avis, site deja cree). Aucun temoignage invente.
- Template: table HTML responsive 600px, styles inline (compat Gmail/Outlook), aucune balise script.

## Review Focus
- Melange de langues dans un email (prospect US, LANG absent -> anglais pur). Verifie en Task 1 Step 5.
- HTML invalide si le LLM croit des guillemets ou HTML: escapeHtml sur toute valeur inseree.
- Valeurs JSON manquantes (bullets vides, cta absent): repli du pack, jamais "undefined".

### Task 1: Reecriture de src/lib/emailer.ts

**Files:**
- Modify: src/lib/emailer.ts

**Interfaces:**
- Consumes: agentThinkJson de @/lib/agent-brain, getSetting (OFFER_PRICE, OFFER_CURRENCY, BREVO_*), Prospect de @/db/schema.
- Produces:
  - resolveLang(p: Prospect): "fr" | "en"
  - type SalesCopy = { lang: "fr"|"en"; subject: string; hook: string; bullets: string[]; proofLine: string; offerTitle: string; cta: string; closing: string }
  - sendSalesEmail: meme signature externe.

**Steps:**
- [ ] Step 1: LANG_PACKS (fr/en) : cles brandSub, offerDays ("Mise en ligne sous 48h"), offerAll ("tout compris, sans abonnement"), stopLine, signature, fallback complet (hook, 3 bullets, proofLine, cta, closing) redige en commercial naturel par langue.
- [ ] Step 2: resolveLang : clientData.LANG si "en"/"fr" ; sinon p.country normalise : usa/united states/etats-unis -> en; uk/united kingdom/royaume-uni/england/gb -> en; france/canada/belgium/belgique/maroc/morocco/algerie/algeria/tunisie/tunisia -> fr ; defaut fr.
- [ ] Step 3: aiSalesCopy(p) : pass 1 redacteur (framework PAS : probleme/douleur puis solution), pass 2 directeur commercial qui critique et renvoie le JSON final (memes cles, meme langue), maxTokens ~900 par passe. Enchainement : pass 2 echoue -> pass 1 ; pass 1 echoue -> null.
- [ ] Step 4: renderEmail({p, copy, previewUrl, price, currency}) : table 600px inline styles : bandeau marque (#0B1220 + accent #00E5A0), hook, 3 bullets avec pictos unicode, proof factuelle, encadre offre (bordure accent 2px : offre + prix + offerDays + offerAll), CTA pill, closing + signature, footer legal + stopLine. escapeHtml sur toute valeur LLM.
- [ ] Step 5: sendSalesEmail rebranche : copy = aiSalesCopy ?? fallback pack ; subject = copy.subject ; bodyHtml = renderEmail ; tous les retours (succes, simulation, erreurs) gardent subject/bodyHtml.
- [ ] Step 6: Verifier : npm run typecheck (PASS) puis npm run build (OK).

### Task 2: Verification humaine

- [ ] Step 1: Apres deploiement, l'utilisateur declenche un envoi ; l'email archive dans /emails est verifie : bonne langue, structure PAS, design propre.
- [ ] Step 2: Ajustements de copy eventuels a la demande.
