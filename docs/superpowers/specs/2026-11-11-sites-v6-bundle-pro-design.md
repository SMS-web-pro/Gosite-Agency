# Design — Sites v6 : bundle pro multi-pages (qualité client)

Date : 2026-11-11 · Statut : validé par l'utilisateur (approche A)

## Intent / pourquoi

Le site v5 généré est un brouillon : images volées aux concurrents (logo « SOPHIA » visible), pages légales en modales, formulaire Formspree, stats animées faux (0.5 au lieu de 4.8), contenu générique. L'utilisateur fournit un brief client-excellence complet (structure de pages, mobile-first, WCAG AA, SEO technique, QA list). Objectif : **le générateur produit, pour chaque lead, un bundle de site pro approuvable par un client** — zéro actif volé, zéro fait inventé, Lighthouse-ready.

## Goals / non-goals / anti-goals

**Goals**
- Bundle multi-fichiers : index (créatif) + pages réelles `/privacy`, `/terms`, `/404`, `/services/[slug]`, sitemap, robots, manifest, favicon, images locales.
- Images : **téléchargées** au build, embarquées localement, zéro hotlink, zéro logo concurrent (Serper Images abandonné).
- Une seule source de vérité : la fiche → `SiteConfig` (typed) → tous les fichiers.
- Formulaire réel : POST → API gosite.digital → Brevo → email client + log DB + Telegram. Honeypot + validation client/serveur.
- Règle anti-invention : avis/licence/années → jamais inventés ; section testimonials devient bloc Google + TODO si pas d'avis.
- QA automatisé dans l'e2e : assertions bundle + PSI (Lighthouse) sur l'URL déployée.

**Non-goals**
- WebP strict (re-encodage) — pas de dépendance `sharp` pour l'instant ; `.jpg` optimisés Unsplash (`w=1600&q=80`).
- Cloudflare Turnstile/reCAPTCHA (clés par client irréalistes) — honeypot suffit, Turnstile listé en TODO.
- Dashboard client, CMS, édition du contenu par le client.
- Lighthouse CI automatique (vérification PSI manuelle/e2e sur le site de test).

**Anti-goals (échec même si ça marche)**
- Un seul fait inventé (avis, licence, année, « +500 clients ») → échec.
- Un seul URL d'image externe dans le bundle → échec.
- Placeholder visible type « [ADD REAL TESTIMONIAL] » en prod → échec.

## Contraintes

- Stack inchangée : Next.js 16 + Drizzle/Supabase + Gemini (3 clés, `gemini-3.6-flash`, maxTokens 65536) + Brevo SMTP + Vercel API v13 inline files.
- Le lead reste un lead généré : nom/type/ville/notes réels Google, le reste vient de la fiche. Données manquantes → TODO report au client (jamais un placeholder en prod).
- Windows dev : PowerShell pièges connus (`.mjs` en fichiers), runner de tests `scripts/test.mjs` sans filtrage, modules purs copiés dans `tests/_lib`.

## Approches (décision : A)

- **A — Hybride (choisi)** : Gemini ne génère que `index.html` ; le reste est rendu déterministiquement par TS depuis la config. Cohérence garantie, coût tokens inchangé, pages légales parfaites.
- **B — Tout déterministe** : rejeté — variété visuelle « site unique » perdue, gros chantier template.
- **C — Gemini multi-fichiers** : rejeté — coût ×4-5, incohérences inter-pages, timeouts.

## Architecture

### 1. Mapper (avant le Coder)

- `SERVICES_FULL` : l'appel LLM existant de `mapProspect` produit en plus 6 services × `{slug, title, desc, paras[2-3], bullets[3-4]}` ancrés ville (JSON ~4-6 Ko, maxTokens 8000). Repli : blocs sectoriels niche.
- Images : abandon Serper Images (`images-search.ts` retiré du flux, module conservé). Pool niches étendu à **12 images/niche** (héros + about + 6 galerie + réserve). Au build : téléchargement des 8 URLs choisies → bytes → bundle `/images/hero.jpg`, `about.jpg`, `work-1..6.jpg`. `IMAGE_SOURCE = "local"`. Échec download d'une image → image suivante du pool (jamais de hotlink, jamais de trou).
- `fetchLeadDetails` (Serper /maps) **conservé** : description + horaires réels = données factuelles du lead (pas du contenu volé).

### 2. SiteConfig (source de vérité unique)

`src/lib/site-config.ts` : `buildSiteConfig(sheet)` → objet typed : name, tagline, phone, phoneLink, email, address, city, zip, country, domain (deployed_url ou custom), mapUrl (Google Maps search URL propre, pas des raw coords), mapEmbed, rating?, reviewCount?, hours, emergency (HOURS_24/7 si "24/7" détecté), services[] (slug, title, short, paras, bullets), areas (cities), socials?, formAction (`https://gosite.digital/api/site-form/{prospectId}`), images (chemins locaux), legal (copyright, year), locale.
→ consommé par : prompt Gemini (index), renderer TS (pages auxiliaires), JSON-LD, sitemap, email TODO.

### 3. Coder (index.html)

GOLDEN v6 : réécriture des sections selon le brief (une seule passe, mêmes tokens design v5 : rayons/ombres/clamp/data-reveal/AA) :

- Topbar UNE ligne : « 24/7 Emergency · Call PHONE » si 24/7, sinon horaires réels. Fini le marquee adresse/notes.
- Header sticky : logo, max 5 liens (Services, Projects, About, FAQ, Contact) + bouton orange « Call Now ». Mêmes labels mobile.
- Hero : H1 + sous-titre 18-20px + CTA primaire « Call Now » + secondaire « Get a Free Quote » (ancre #contact) + 3 chips (Licensed & Insured si licence connue sinon Resolved Fast / Upfront Pricing / Same-Day Service si vrais). Photo locale `images/hero.jpg` overlay sombre. Badge « Top Rated » dans le flux, pas collé au bord. **Plus de 2×2 stat cards** → une rangée de 3 chips.
- **UNE** trust bar : rating réel + reviews, licence si connue, garantie si réelle, insured si réelle. Ailleurs : rien.
- Services : grille 3×2, icônes 40-48px, PAS de numéros 01-06, carte cliquable → `/services/[slug]`, « Learn more → ».
- Why Choose Us : 4 cartes (fusion badges + commitments + about bullets).
- Process : 4 étapes horizontales desktop / verticales mobile.
- Projects : galerie 6 images locales ratio uniforme, hover zoom, swipe carousel mobile.
- Testimonials : si avis réels fiche → cartes ; sinon bloc « 4.8 ★ sur Google » + lien profil + mention « verified reviews ». (TODO avis demandés au client.)
- Service Area : liste villes desservies.
- About : `images/about.jpg`, histoire courte, years si réels, licence si réelle.
- FAQ : accordéon un-ouvert-à-la-fois, 6-8 questions (pricing, emergency, warranty, payment, permits, service area) + JSON-LD FAQPage.
- Contact fusionné : 2 colonnes égales — form (name, phone, email, zip, service select, message, consent) à gauche ; coordonnées + horaires + carte (iframe lazy + fallback lien « Open in Google Maps ») à droite. `action=formAction`, `method=POST`, inputs types/autocomplete corrects, honeypot caché `website`.
- Footer : logo, description courte, nav, horaires, contact, liens réels `/privacy` `/terms`, licence si connue, copyright contrasté.
- Mobile : **barre d'action sticky bas** (Call Now + Get Quote, safe-area insets), plus de FAB WhatsApp ; formulaire compact 1 colonne.
- Interdits v6 : `data-aos`, compteurs animés sur rating/reviews (valeurs rendues statiques), FABs flottants, modales légales, srcset (URLs locales), hotlinks externes.

### 4. Renderer TS des pages auxiliaires (`src/lib/bundle.ts`)

Déterministe, depuis SiteConfig : `privacy.html` (pratiques réelles : données du form seulement, contact réel, RGPD/CCPA selon pays), `terms.html`, `404.html` (brandée, lien accueil), `sitemap.xml` (index + 6 services + privacy + terms), `robots.txt` (Allow + Sitemap), `site.webmanifest`, `favicon.svg` (monogramme initiales), `vercel.json` (`{"cleanUrls": true}`), pages `/services/[slug].html` (titre, 2-3 paras, bullets, CTA appel + lien devis, keywords ville). Chaque page : `<head>` complet (title/description uniques, canonical, OG/Twitter avec `images/hero.jpg` en share image, favicon, lang en, JSON-LD LocalBusiness).

### 5. Deployer

`deploy.ts` : accepte un **bundle** `{ "index.html": base64, "images/hero.jpg": base64, ... }` (v13 inline files, déjà prouvé). Schema : nouvelle colonne `site_bundle` (jsonb) à côté de `site_html` (index conservé pour compat/logs). Déploiement = files array + PATCH `ssoProtection: null` (déjà en place).

### 6. API formulaire

`/api/site-form/[id]/route.ts` : POST JSON → honeypot `website` rempli → 200 silencieux ; validation serveur (name ≥2, phone regex, message ≥10, consent true, service ∈ liste) ; insert table `site_leads` (prospect_id, payload, ip, created_at) ; email Brevo au client (template texte propre) + notification plateforme ; Telegram « Nouvelle demande du site X ». Rate limit léger par IP (5/min). Réponse `{ok:true}` ; erreur → `{ok:false, message}` avec fallback téléphone.

### 7. TODO report + email

À chaque build, liste TODO dérivée de la config (photos à remplacer ×N, avis à fournir, licence, Turnstile, favicon custom, GBP link, domaine) → injectée dans l'email de livraison existant (Brevo) comme checklist client.

## Bugs du brief → fixes (mapping)

| Brief | Fix v6 |
|---|---|
| Photos concurrents (SOPHIA…) | Serper abandonné → pool local téléchargé |
| Tile galerie blanche | Download au build + fallback image suivante |
| Map iframe grise | iframe lazy + fallback lien Maps (URL propre GBP/search) |
| Compteurs 0.5/5 | Rendu statique, zéro animation sur rating/reviews |
| WhatsApp FAB | Supprimé → barre sticky mobile |
| Get Directions raw coords | mapUrl = Maps search/GBP propre |
| Autofill overflow email | CSS input (font-size 16px, padding, -webkit-autofill) |
| Modales légales | Pages réelles `/privacy` `/terms` |

## QA (e2e v6)

Assertions bundle : zéro `src="http` externe (images), tous les anchors internes résolvent (fichiers présents), form action correct, JSON-LD parse, sitemap XML valide, title/meta uniques par page, pas de `display:none` dans onerror, honeypot présent. Puis PSI API sur l'URL déployée → scores reportés. Site de test : lead #1952 redéployé.

## Laissé au builder

- Ordre exact des tâches/commits, découpage modules purs vs DB.
- Détails CSS du GOLDEN (micro-espacements) dans le cadre tokens existants.
- Choix table `site_leads` (nouvelle) vs réutilisation `activities` (préférence : nouvelle table, drizzle push).
- Timing e2e (budgets 300s step).
