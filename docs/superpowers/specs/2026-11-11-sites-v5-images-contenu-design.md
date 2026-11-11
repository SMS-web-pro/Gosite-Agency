# Design — Génération de sites v5 : images réelles du secteur + contenu personnalisé du lead + design system pro

Date : 2026-11-11 · Statut : approuvé en conversation (approche Serper Images + personnalisation par données réelles)

## Intent et pourquoi

Le produit vend des sites vitrines générés automatiquement à des commerces locaux.
Le client (utilisateur) a comparé le résultat à la référence arena.com et rejette le
site actuel pour 7 défauts : images génériques ou cassées, contenu basic non
personnalisé, UI mal structurée, animations/arrières-plans/transitions
non professionnels.

Cause racine trouvée dans le code : le site est généré depuis des **templates
statiques par secteur** (`niches.ts` : 6 secteurs, pools de 5 photos Unsplash
chacun) et le LLM invente tout le contenu à partir du seul secteur + ville. La
description réelle du lead, son site web et ses avis n'entrent jamais dans le
prompt du Coder.

## Goals

1. **Images matchées au secteur du lead, jamais cassées** — recherchées via
   Serper Images (`google.serper.dev/images`, clés déjà en rotation dans la
   table `serper_keys`), validées (HTTP 200, content-type image, taille > 20 Ko,
   largeur >= 600 px), avec fallback automatique sur le pool Unsplash de la
   niche.
2. **Contenu personnalisé à partir des données réelles du lead** — description
   Google Maps, services extraits du site web du lead si présent, avis réels
   (note + count déjà en DB), heures, adresse/zip.
3. **Design system professionnel** — échelle typographique fluide HD, animations
   reveal coordonnées, transitions de sections (dividers, overlaps), niveaux de
   fond alternés, cohérence 8px.
4. **Zéro image masquée silencieusement** — `onerror` ne doit plus cacher une
   image : substitution par une image du pool.

## Non-goals

- Ne pas changer l'architecture du pipeline (étapes validate/verify/map/build/
  deploy/contact restent).
- Ne pas générer d'images IA (lent, coûteux, moins crédible).
- Ne pas inventer des témoignages clients (règle anti-fake conservée, motif de
  rejet).
- **Garder le rejet des leads possédant déjà un site web** (décision
  utilisateur) : donc PAS de scraping du site du lead. `SERVICES` est dérivé de
  la description Google Maps + secteur + ville. Si `SERVICES` sort vide, les
  cartes services reprennent le template de niche — avec variante anglaise
  (niches.ts actuel est français seul : ajouter `labelEn`-cohérents services EN).
- Ne pas réécrire `site-template.ts` (moteur gabarit de secours) SAUF une
  correction chirurgicale : son `onerror` en `display:none` devient une
  substitution `src` par une image du pool (goal 4). Le reste du gabarit reste
  en v4 (il ne sert qu'en cas d'échec Gemini + LLM).
- Pas de nouvelle étape de "check visuel" automatisé pour l'instant.

## Approches (décision)

- **A. Serper Images + données réelles du lead + design system dans le prompt
  (retenu)** — le Coder reçoit des URLs d'images validées du secteur réel et les
  services réels du lead. Coût ~5-10 crédits Serper par site (quota 2500/clé,
  plusieurs clés en rotation). Images uniques par lead.
- B. Pool Unsplash curé élargi — zéro risque, mais images identiques entre sites
  du même secteur (rejet du besoin "matché au secteur/à la ville").
- C. Génération IA d'images — rejetée (latence, coût, crédibilité).

## Parts of the how (décidées)

1. **Nouveau module `src/lib/images-search.ts`** :
   - `searchValidImages(query, gl, hl, count)` : POST `https://google.serper.dev/images`
     `{q, gl, hl, num: 20}` + header `X-API-KEY` (rotation via le code existant
     de `serper.ts`) → filtre `imageUrl`, `imageWidth >= 600`, exclut les SVG et
     les URL de dimension absurde (< 600px de haut) → validation HEAD
     (status 200, `content-type` image/*, `content-length` > 20 000) avec
     timeout 8s, parallélisme limité (6 à la fois) → retourne `count` URLs
     validées.
   - La requête de recherche : `"{businessType} {services déduits} professional photo"`
     en langue du lead (hl/gl déduits du pays) — sans la ville (les photos
     "à Dallas" sont rarement dispo ; la concordance vient du secteur).
   - Rotation seedée par lead (réutiliser `hashSeed`/`rotateSeeded` de
     `images.ts`) pour que deux leads différents ne reçoivent pas le même
     sous-ensemble.
2. **Intégration dans `mapProspect` (mapper)**, pas une étape du pipeline :
   - **D'abord un appel Serper `/maps`** (1 crédit) pour récupérer la vraie
     description Google Maps + les horaires du lead (`p.description` n'est PAS
     peuplé à l'ingestion et est écrasé par l'IA ensuite ; `openingHours` aussi
     vide) → sert d'input réel à l'enrichissement et peuple `HOURS_*`.
   - Ensuite `searchValidImages` : si >= 5 images validées : `HERO_IMAGE_URL`
     (index 0), `ABOUT_IMAGE_URL` (1), `GALLERY_IMAGE_URLS` (2-7) ; on complète
     JUSQU'À 8 avec le pool niches seedé (le contrat "8 URLs" reste entier) ;
     sinon fallback pool niches complet.
   - Nouveau champ fiche `IMAGE_SOURCE: "serper" | "pool"` (traçabilité).
   - Appels Serper comptés dans les crédits (réutiliser la comptabilité
     existante de serper.ts : credits_used + épuisement + provision). Budget :
     2-3 crédits par lead (1 /maps + 1 /images + marge HEAD sans crédit).
3. **Contenu personnalisé** (SANS scraping — les leads avec site sont rejetés) :
   - L'input d'enrichissement LLM du mapper reçoit la description Google Maps
     réelle (appel /maps ci-dessus) + type + ville + note/avis.
   - Sortie enrichie ajoutée : `services: [{title, desc}]` (5-6 services
     DÉRIVÉS de la description réelle et du secteur ; si la description est
     trop pauvre → services du template de niche, en EN si site anglais).
   - La description Google Maps réelle est condensée dans `ABOUT_SOURCE`.
   - `HOURS_WEEKDAY/SAT/SUN` peuplés depuis `openingHours` (quand disponibles).
4. **Prompt Coder v5** (GOLDEN_FR + GOLDEN_EN réécrits, `coder.ts`) :
   - **Contrat produit/UX conservé** : les 16 sections (dont #topbar et
     #guarantees), les modales légales 600+ mots, le formulaire Formspree, les
     FABs, le topbar marquee, le héros 2 colonnes avec Ken Burns et stat cards
     flottantes restent obligatoires. Ce qui change :
   - **Typo HD** : échelle fluide `clamp()` (h1 2.6-4.4rem selon variante,
     h2 1.9-3rem, corps 1.05rem/1.7), display font réservée h1/h2/nombres,
     `text-wrap: balance` sur les titres, `max-width` 68ch sur les paragraphes,
     interlignage généreux, hiérarchie stricte (les H3 ne peuvent pas être plus
     gros qu'un H2 de section).
   - **Reveal coordonné** : UN système `data-reveal` (IntersectionObserver,
     translateY 24px + opacity, durée .7s cubic-bezier(.16,1,.3,1), stagger 90ms
     entre enfants d'un groupe) ; interdiction de tout autre système
     (`data-aos`, keyframes d'apparition par section, observer multiples).
   - **Arrières-plans** : SUPPRESSION du zoo des 5 fonds animés (grilles
     rayées, blobs multiples) ; conservation : particules du héros, Ken Burns
     héros, patterns statiques très subtils (opacité <= 0.04) sur stats et
     cta-banner.
   - **Transitions de sections** : rythme par BLOCS (pas d'alternance stricte
     1:1) : hero foncé → trust-bar+services clairs → about clair (image côté
     alterné selon variante) → stats foncé (divider SVG) → process+gallery
     clairs → reputation+faq clairs → cta-banner foncé (divider SVG) → contact
     clair → footer foncé. Dividers SVG (vague ou biais, fill = couleur de la
     section suivante) aux 3 changements majeurs (stats, cta, footer).
   - **Images HD** : héros `w=2400` + `srcset` 800/1600/2400 + `sizes` UNIQUEMENT
     pour les URLs du pool (paramètres Unsplash) ; images Serper (hosts tiers
     arbitraires) : `<img>` simple + `width`/`height` explicites + aspect-ratio
     CSS pour éviter le layout shift. `loading="lazy"` partout sauf héros
     (`fetchpriority="high"`).
   - **Micro-interactions cohérentes** : une seule échelle d'ombres (3 niveaux),
     un seul radius system (6/14/24/999), transitions 200ms standard / 400ms
     sur fond, hover toujours lié à une transformation (pas de simple fade).
   - **Contenu** : services numérotés DÉRIVÉS de `SERVICES` du lead (titre réel
     + bénéfice concret), FAQ ancrées sur les services réels + la ville,
     "à propos" = `ABOUT_SOURCE` reformulé (jamais contradictoire avec la
     description Google), sections stats uniquement chiffres réels (inchangé).
   - **onerror** : `onerror="this.onerror=null;this.src='URL_FALLBACK_POOL';"`
     (URL fournie en champ `IMAGE_FALLBACK_URL`), jamais `display:none`.
5. **`mapper.ts`** : ajout champs `SERVICES`, `ABOUT_SOURCE`, `IMAGE_FALLBACK_URL`,
   `IMAGE_SOURCE` à la fiche (28 → 32 champs), propagation dans la liste des
   champs du prompt Coder. Si la langue du site est EN, les services de repli
   viennent d'un template de niche EN (nouvelles variantes `servicesEn`/`faqEn`
   dans niches.ts pour les 6 niches + default).

## Constraints

- Budget : 2-3 crédits Serper par lead (1 `/maps` + 1 `/images`, HEAD sans
  crédit), au lieu d'un seul — accepté avec la rotation multi-clés existante.
- Build total doit rester < 300 s (maxDuration 300) : /maps + images + HEAD
  ~20-25 s, enrichissement mapper LLM déjà existant, coder Gemini 90-180 s.
- Le déploiement reste tel quel (v13 + ssoProtection null, déployé aujourd'hui).
- Rester en Node stdlib (fetch, AbortSignal) — aucune nouvelle dépendance.
- L'`onerror` fallback s'applique aussi à site-template.ts (fix chirurgicale
  unique), le reste du gabarit v4 reste inchangé.

## What's left to the builder

- Le wording exact des prompts v5 (français et anglais) reste libre tant que
  toutes les contraintes ci-dessus sont couvertes.
- L'ordre exact des validations HEAD et le parallélisme (6 conseillé).
- Le fallback si Serper échoue réseau : pool niches, jamais une étape en échec
  dur.
