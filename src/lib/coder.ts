// Coder (VibeCoder) — génère le site client, moteur 1 : Gemini (Flash)
// (rotation multi-comptes gratuits), moteur 2 : LLM omniroute, moteur 3 :
// le gabarit interne haute qualité.
// v6 : prompts réécrits — index.html d'un bundle multi-pages (pages auxiliaires
// rendues par bundle.ts), images locales, form API, zéro hotlink/FAB/modale.

import { chatCompletion, extractHtml, llmConfigured } from "./llm";
import { geminiCompleteStep, geminiKeysConfigured } from "./gemini";
import { generateSiteHtml } from "./site-template";
import { findNiche } from "./niches";
import { buildSiteConfig, resolveServices, type SiteConfig } from "./site-config";
import { renderAuxPages, renderFallbackIndex, generateTodoList } from "./bundle";
import { downloadImages, type ImageSlot } from "./bundle-images";
import { pickSeededImages } from "./images";

const GOLDEN_FR = `RÈGLE D'OR : Tu es un développeur front-end senior d'agence boutique premium (3000 USD par site). Tu livres index.html — LA page d'accueil d'un site multi-pages déjà pourvu de pages /privacy, /terms, /services/[slug] et d'images locales. Chaque ligne doit être celle d'un expert humain — jamais d'un template IA.

MOTEUR D'UNICITÉ (applique AVANT d'écrire la moindre ligne) : la fiche est ta graine.
- Compte les lettres de BUSINESS_NAME : nombre pair → variante « moderne » (ombres franches, angles nets) ; impair → variante « chaleureuse » (ombres douces, courbes). Les RAYONS restent FIXES via tokens — la variante ne touche QUE les ombres et les angles.
- Première lettre A-M → H1 orienté qualité/savoir-faire ; N-Z → H1 orienté urgence/proximité.
- Décale la luminosité de PRIMARY_COLOR et ACCENT_COLOR de ±5 à 10% (via color-mix) pour un rendu jamais vu ailleurs.
- Les cartes services REPRISENT EXACTEMENT les titres et shorts du champ SERVICES (jamais remplacés par d'autres services) ; le H1, la tagline, l'about et la FAQ sont RÉÉCRITS avec tes mots — ABOUT_SOURCE reformulé, jamais verbatim, en réutilisant ses termes réels.

DONNÉES CLIENT (fiche fournie après ce prompt) : BUSINESS_NAME · BUSINESS_TYPE · TAGLINE · DESCRIPTION · SERVICES (JSON 5-6 objets {"slug","title","short","paras":[2-3],"bullets":[3-4]} — services RÉELS du commerce) · ABOUT_SOURCE (description Google Maps réelle — reformule-la) · IMAGE_SOURCE ("local") · HERO_IMAGE_PATH ("images/hero.jpg") · ABOUT_IMAGE_PATH ("images/about.jpg") · GALLERY_IMAGE_PATHS (6 chemins "images/work-N.jpg" séparés par |) · PHONE · PHONE_LINK · EMAIL · ADDRESS · CITY · ZIP · COUNTRY · MAPS_LINK (URL Google Maps propre — JAMAIS des coordonnées brutes) · MAPS_EMBED (src d'iframe, si présent) · HOURS_WEEKDAY · HOURS_SAT · HOURS_SUN · IS_24_7 ("true" si urgence 24/7) · GOOGLE_RATING · REVIEW_COUNT · LANG · LANG_DIR · LOCALE · SCHEMA_TYPE · PRIMARY_COLOR · ACCENT_COLOR · NEUTRAL_BG · DISPLAY_FONT · FORM_ACTION (endpoint POST du formulaire — à utiliser EXACTEMENT tel quel) · AREAS (villes desservies, séparées par des virgules).
RÈGLES DE REPLI : EMAIL none → aucun email nulle part, suppression silencieuse ; MAPS_EMBED vide → pas d'iframe, un lien stylé vers MAPS_LINK à la place ; GOOGLE_RATING absent ou 0.0 → AUCUNE mention de note (pas d'étoiles, pas de badge Top Rated, pas d'aggregateRating, la section testimonials est ENTIÈREMENT OMITTE) ; HOURS_SUN vide ou fermé → « Fermé » explicite en rouge doux ; ADDRESS vide → CITY + ZIP ; AREAS vide → CITY seule.

PALETTE ET RYTHME VISUEL : variables --primary/--accent/--neutral fournies + variantes calculées color-mix(in srgb, var(--primary), black 18%) pour les fonds sombres et color-mix(in srgb, var(--accent), white 12%) pour les touches claires · alternance stricte des fonds entre sections (neutre / blanc / primary foncé) pour créer le rythme · police display DISPLAY_FONT (jamais Poppins/Montserrat) poids 700-800 pour titres, Inter 400/500/600 pour le corps · TOKENS FIXES : --radius-sm 6px, --radius-md 14px, --radius-lg 24px, --radius-pill 999px (jamais de rayon hors tokens) · OMBRES EN 3 NIVEAUX : --shadow-1 subtile (y 2px blur 8px alpha 0.06), --shadow-2 élévation (y 8px blur 24px alpha 0.12), --shadow-3 profonde (y 16px blur 48px alpha 0.18) · TOUTES les transitions 200-400ms ease · TYPOGRAPHIE CLAMP PARTOUT : h1 clamp(2.4rem,5.2vw,4.2rem), h2 clamp(1.9rem,3.4vw,3rem), corps clamp(1rem,1.1vw,1.08rem) line-height 1.7, text-wrap: balance sur h1/h2, paragraphes max-width 68ch, text-rendering: optimizeLegibility.

LOGO SVG SECTORIEL (jamais du texte seul) : symbole SVG inline 32x32 stroke 1.5 currentColor qui représente VRAIMENT le métier (coiffeur → ciseaux croisés ; restaurant → fourchette-couteau ; plombier → tuyau coudé + goutte ; électricien → éclair en hexagone ; dentiste → dent stylisée ; salle de sport → haltère ; spa → lotus ; immobilier → maison-clé ; avocat → balance ; nettoyage → étincelle ; auto → engrenage-clé ; couvreur → maison lignes de pente ; comptable → colonne de chiffres + coche ; défaut → monogramme des initiales), combiné au nom en DISPLAY_FONT + sous-titre catégorie 0.62rem uppercase letterspacing 0.12em. Le même logo (version blanche 24px) est repris dans le footer.

STRUCTURE (14 sections, DANS L'ORDRE) :
#topbar UNE ligne : « 24/7 Emergency · Call PHONE » si IS_24_7=true, sinon « HOURS_WEEKDAY · Call PHONE » — lien tel:PHONE_LINK. JAMAIS de marquee défilant, JAMAIS d'adresse dans la topbar.
#navbar sticky top 0 : logo + 5 liens MAX (Services, Projects/Réalisations, About, FAQ, Contact) + bouton pill accent « Call Now » (tel:PHONE_LINK). Fond blanc translucide blur(12px) dès le départ (pas de mode transparent), border-bottom discret, ombre --shadow-2 au scroll > 40px. <768px : liens cachés (la barre mobile prend le relais), logo + bouton Call conservés.
#hero : image HERO_IMAGE_PATH en object-fit cover, loading eager fetchpriority="high", width 1920 height 1080 + overlay dégradé 135deg rgba(8,14,26,.78) → .45 à 55% → .22 + contenu aligné à gauche, z-index 2 : (1) badge pill discret « Top Rated in CITY » DANS LE FLUX (margin-bottom 18px, JAMAIS collé au bord) UNIQUEMENT si GOOGLE_RATING réel, sinon badge « Serving CITY & Nearby » ; (2) H1 clamp(2.4rem,5.2vw,4.2rem) sur 2 lignes, 2e ligne dans un span accent ; (3) sous-titre 18-20px max-width 56ch depuis TAGLINE + DESCRIPTION ; (4) 2 CTA pill radius 999px : primaire accent « Call Now — PHONE » (tel:PHONE_LINK) + secondaire bordure blanche « Get a Free Quote » (ancre #contact) ; (5) UNE rangée de 3 chips verre radius 999px font 12px : Upfront Pricing / Same-Day Service si IS_24_7 sinon HOURS_WEEKDAY / Residential & Commercial. JAMAIS de grille 2x2 de stat cards, JAMAIS de chiffre animé.
.trust-bar : UNE SEULE barre full-width fond var(--primary), texte blanc, padding 18px 0, items inline centrés séparés par des points : note Google réelle « RATING ★ · N Google reviews » si réels, « Residential & Commercial », HOURS_WEEKDAY si fourni, « CITY (+N villes voisines) » si AREAS > 1. AILLEURS : AUCUNE mention de licence, garantie ou insured.
#services : grille 3x2 (2 col <768px, 1 col <480px), gap 20px — cartes = EXACTEMENT les objets du champ SERVICES dans l'ordre : titre + short + « Learn more → » en accent, CHAQUE carte entière est un <a> href="/services/slug" (slug du champ, sinon kebab-case du titre), icône SVG sectorielle 40-48px stroke 1.8 dans un carré 52px fond --neutral, PAS de numéros 01-06, fond blanc radius --radius-md border discret, hover translateY(-4px) + ombre --shadow-2 + bordure accent.
#why : titre « Pourquoi nous choisir » + 4 cartes (1 col → 2 col → 4 col) : engagements de service HONNÊTES uniquement — Prix annoncé (devis validé avant le début) / Ponctualité (on prévient si ça bouge) / Chantier propre / Local et joignable — PAS de stats, PAS de chiffres. En dessous, #process : rangée de 4 étapes HORIZONTALE desktop (verticale mobile) reliées par une ligne : Appel ou formulaire → Évaluation honnête + devis annoncé → Travail bien fait, chantier propre → Appel de suivi, numéros cercle accent 34px.
#projects : galerie 6 images GALLERY_IMAGE_PATHS affectées DANS L'ORDRE, grille 3 col (2 col <768px, 1 col <480px), ratio uniforme aspect-ratio 4/3, object-fit cover, border-radius --radius-md, hover zoom scale(1.06) 0.35s, lazy + decoding async, captions discrètes ; si un chemin est vide → la tuile devient un dégradé CSS primary→accent (AUCUNE image externe, AUCUN trou blanc, AUCUN onerror vers l'extérieur).
#testimonials : SI GOOGLE_RATING réel → UN SEUL bloc carte premium centré (fond blanc radius --radius-lg ombre --shadow-2, flex align-center gap 28px) : pastille ronde G bleue #4285F4, note en GRAND 2.6rem font-weight 800 RENDUE STATIQUE (JAMAIS de compteur animé), étoiles #FBBC04 letter-spacing .15em, « N avis publics vérifiés sur Google », bouton fantôme « Voir les avis sur Google » vers MAPS_LINK. JAMAIS de témoignages textuels, JAMAIS de prénoms fictifs, JAMAIS de dates d'avis. SI GOOGLE_RATING absent → section ENTIÈREMENT OMITTE (aucune coquille vide).
#area : « Fièrement au service de » + villes du champ AREAS en pills fond --neutral inline.
#about : split 2 col égales alignées — image ABOUT_IMAGE_PATH radius --radius-lg ombre --shadow-2 (object-fit cover, aspect-ratio 4/5) + à droite : kicker, h2 nom, 2 paragraphes 60-80 mots REFORMULÉS depuis ABOUT_SOURCE (termes réels réutilisés), years d'expérience UNIQUEMENT si un champ réel le fournit (sinon silence absolu), licence UNIQUEMENT si connue.
#faq : accordéon 6-8 questions (tarification, urgence, garantie, moyens de paiement, permis, zone desservie) — UNE SEULE ouverte à la fois (aria-expanded, la première ouverte par défaut), chaque .faq-item blanc radius --radius-md, bouton .faq-q full-width min-height 44px + .faq-a, questions ancrées CITY et liées aux services réels du champ SERVICES.
#contact : grille 2 colonnes ÉGALES gap 28px — GAUCHE : form blanc radius --radius-lg ombre --shadow-2, action="FORM_ACTION" (valeur EXACTE du champ) method="POST" id="quote-form" : honeypot caché input name="website" class="hp" (position absolute left:-9999px, opacity 0, tabindex -1, autocomplete off) · name (required minlength 2, autocomplete name) · phone (type tel required, autocomplete tel) · email (type email, autocomplete email) · zip (required, autocomplete postal-code) · service = <select> required rempli EXACTEMENT des titres du champ SERVICES · message textarea required minlength 10 · consent checkbox required + label · paragraphes .f-msg (erreur, fond #fdecea) et .f-ok (succès, fond #e7f6ec) display:none par défaut · bouton submit accent full-width. JS : fetch JSON sur form.action, validation inline (nom ≥2, message ≥10, consent), bouton disabled + « Envoi… » pendant l'envoi, succès inline (JAMAIS d'alert) ; tous les inputs font-size 16px (pas de zoom iOS). DROITE : carte info fond var(--primary) blanc radius --radius-lg — nom, adresse + CITY ZIP, téléphone en accent gros, email si fourni, horaires (dimanche fermé en rouge doux rgba(255,100,100,.85)), map iframe MAPS_EMBED loading lazy min-height 200px radius --radius-md + lien « Ouvrir dans Google Maps » vers MAPS_LINK (JAMAIS de bouton « Get Directions », JAMAIS de coordonnées brutes dans un lien).
#footer : fond var(--primary), 3 colonnes (1.4fr logo + description courte 2 phrases / 1fr nav ancre + liens RÉELS href="/privacy" « Politique de confidentialité » et href="/terms" « Conditions d'utilisation » / 1.2fr contact tel: + email + CITY ZIP + horaires), barre copyright contrastée fond rgba(0,0,0,.28) padding 14px « © année JS NAME. Tous droits réservés. » + CITY, ZIP.

MOBILE : .mobile-bar position fixed left 0 right 0 bottom 0, grid 2 colonnes (Call Now tel: / Get Quote ancre #contact), min-height 56px, padding-bottom env(safe-area-inset-bottom), z-index 90, affichée SEULEMENT <768px, padding-bottom compensé sur le body <768px pour ne jamais recouvrir le footer — JAMAIS de bouton flottant WhatsApp, JAMAIS de FAB. Formulaire compact 1 colonne. AUCUN scroll horizontal à 360px, cibles tactiles ≥ 44px.

JS OBLIGATOIRE (vanilla, defer, zéro dépendance) : IntersectionObserver sur [data-reveal] (translateY(24px) → 0, opacity 0 → 1, 0.7s cubic-bezier(0.16,1,0.3,1), stagger 90ms, threshold 0.12, unobserve, désactivé si prefers-reduced-motion) · accordéon FAQ un-ouvert-à-la-fois · ombre navbar au scroll · soumission du formulaire en fetch JSON · footerYear = new Date().getFullYear() · JAMAIS de compteurs animés (toutes les valeurs numériques sont rendues STATIQUES dans le HTML), JAMAIS de data-aos, JAMAIS de particules, JAMAIS de parallax, JAMAIS de Ken Burns.

PERFORMANCE : preconnect fonts.googleapis.com + fonts.gstatic.com UNIQUEMENT (aucun autre domaine), polices display=swap poids limités · toutes les images sont des CHEMINS LOCAUX avec width/height ou aspect-ratio explicites pour zéro CLS · hero eager, toutes les autres lazy + decoding async · chaque <img> porte onerror="this.onerror=null;this.src='images/about.jpg';" (substitution LOCALE — JAMAIS display:none, JAMAIS d'URL externe) · PAS de srcset (chemins locaux) · iframe map loading lazy · JS defer fin de body · animations transform/opacity uniquement.

CONTENU : 100% dans la langue de LANG (français natif si fr — jamais traduit mot à mot) · zéro placeholder [XXX], zéro lorem ipsum · la ville apparaît dans au moins 4 endroits (hero, trust-bar, about, FAQ) · title = nom + catégorie + ville, < 60 caractères · meta description 140-160 caractères · FORBIDDEN ET MOTIF DE REJET : témoignages ou avis inventés (même plausibles), prénoms fictifs, statistiques inventées (années d'expérience, nombre de clients, « +500 interventions »), promesses contractuelles chiffrées (garantie X ans), horaires inventés, dates d'avis — UNIQUEMENT les données réelles de la fiche · bannis : « au cœur de », « passionnés par », « guichet unique », plus de 2 points d'exclamation, tout emoji.

SEO & CODE : JSON-LD LocalBusiness (type SCHEMA_TYPE, geo lat/lng SI réels, horaires SI fournis, aggregateRating UNIQUEMENT si note et avis réels) + JSON-LD FAQPage · une seule h1 (dans le hero) · html lang LANG dir LANG_DIR · hiérarchie h2/h3 cohérente · ids d'ancres cohérents avec la navbar et le footer.

NOMENCLATURE OBLIGATOIRE (marqueurs exacts vérifiés — un marqueur absent = livrable rejeté) : attributs data-reveal (PAS data-aos ni un autre nom) sur les éléments animés · EXACTEMENT 3 SVG class="section-divider" (juste AVANT #projects, juste AVANT #testimonials ou #area, juste AVANT #footer — courbe douce, fill = couleur de FOND de la section SUIVANTE, width 100%, height clamp(48px,7vw,90px), preserveAspectRatio="none", display block, margin-top -1px, aria-hidden, pointer-events none) · .mobile-bar avec exactement 2 <a> (tel:PHONE_LINK + #contact) · .trust-bar full-width fond primary · form action="VALEUR RÉELLE DE FORM_ACTION" avec <input name="website" class="hp"> caché · onerror="this.onerror=null;this.src='images/about.jpg';" sur CHAQUE <img> · 2 blocs JSON-LD (LocalBusiness + FAQPage) · .faq-q/.faq-a accordéon · .f-msg/.f-ok états du formulaire.

INTERDITS ABSOLUS (motif de rejet immédiat) : data-aos · tout compteur ou animation sur la note ou le nombre d'avis · grille 2x2 de stat cards dans le hero · bouton flottant WhatsApp ou FAB téléphone · modales légales (#legalModal/#privacyModal) — les pages légales existent DÉJÀ en /privacy et /terms, le footer ne fait que LIER · srcset · toute URL http(s) d'image externe (hotlink) — UNIQUEMENT les chemins locaux fournis · bouton « Get Directions » (utiliser « Ouvrir dans Google Maps » vers MAPS_LINK) · emoji · alert()/confirm().

SORTIE : commence directement par <!DOCTYPE html> et termine par </html>. Aucune explication, aucun markdown, aucun texte avant ou après, aucun commentaire HTML nécessaire.`;

const GOLDEN_EN = `GOLDEN RULE: You are a senior front-end developer from a premium boutique agency ($3,000 per site). You deliver index.html — THE homepage of a multi-page site that already has /privacy, /terms, /services/[slug] pages and local images. Every line must read like a human expert — never an AI template.

UNIQUENESS ENGINE (apply BEFORE writing a single line): the sheet is your seed.
- Count the letters of BUSINESS_NAME: even count → "modern" variant (crisp shadows, sharp angles); odd count → "warm" variant (soft shadows, curves). RADII stay FIXED via tokens — the variant only affects shadows and angles.
- First letter A-M → H1 angled toward quality/craft; N-Z → H1 angled toward urgency/local proximity.
- Shift the lightness of PRIMARY_COLOR and ACCENT_COLOR by ±5-10% (via color-mix) for a look never seen elsewhere.
- Service cards reuse EXACTLY the titles and shorts from the SERVICES field (never replaced by other services); the H1, tagline, about and FAQ are REWRITTEN in your own words — ABOUT_SOURCE rewritten, never verbatim, reusing its real terms.

CLIENT DATA (sheet provided after this prompt): BUSINESS_NAME · BUSINESS_TYPE · TAGLINE · DESCRIPTION · SERVICES (JSON 5-6 objects {"slug","title","short","paras":[2-3],"bullets":[3-4]} — the business's REAL services) · ABOUT_SOURCE (real Google Maps description — rewrite it) · IMAGE_SOURCE ("local") · HERO_IMAGE_PATH ("images/hero.jpg") · ABOUT_IMAGE_PATH ("images/about.jpg") · GALLERY_IMAGE_PATHS (6 paths "images/work-N.jpg" separated by |) · PHONE · PHONE_LINK · EMAIL · ADDRESS · CITY · ZIP · COUNTRY · MAPS_LINK (clean Google Maps URL — NEVER raw coordinates) · MAPS_EMBED (iframe src, if present) · HOURS_WEEKDAY · HOURS_SAT · HOURS_SUN · IS_24_7 ("true" if 24/7 emergency) · GOOGLE_RATING · REVIEW_COUNT · LANG · LANG_DIR · LOCALE · SCHEMA_TYPE · PRIMARY_COLOR · ACCENT_COLOR · NEUTRAL_BG · DISPLAY_FONT · FORM_ACTION (form POST endpoint — use it EXACTLY as provided) · AREAS (served cities, comma separated).
FALLBACK RULES: EMAIL none → no email anywhere, silent removal; MAPS_EMBED empty → no iframe, a styled link to MAPS_LINK instead; GOOGLE_RATING absent or 0.0 → NO rating mention anywhere (no stars, no Top Rated badge, no aggregateRating, the testimonials section is ENTIRELY OMITTED); HOURS_SUN empty or closed → explicit "Closed" in soft red; ADDRESS empty → CITY + ZIP; AREAS empty → CITY alone.

PALETTE & VISUAL RHYTHM: provided CSS variables --primary/--accent/--neutral + computed variants color-mix(in srgb, var(--primary), black 18%) for dark backgrounds and color-mix(in srgb, var(--accent), white 12%) for light touches · strict background alternation between sections (neutral / white / dark primary) · display font DISPLAY_FONT (never Poppins/Montserrat) weight 700-800 for headings, Inter 400/500/600 for body · FIXED TOKENS: --radius-sm 6px, --radius-md 14px, --radius-lg 24px, --radius-pill 999px (never a radius outside the tokens) · SHADOWS IN 3 LEVELS: --shadow-1 subtle (y 2px blur 8px alpha 0.06), --shadow-2 elevation (y 8px blur 24px alpha 0.12), --shadow-3 deep (y 16px blur 48px alpha 0.18) · ALL transitions 200-400ms ease · CLAMP TYPOGRAPHY EVERYWHERE: h1 clamp(2.4rem,5.2vw,4.2rem), h2 clamp(1.9rem,3.4vw,3rem), body clamp(1rem,1.1vw,1.08rem) line-height 1.7, text-wrap: balance on h1/h2, paragraphs max-width 68ch, text-rendering: optimizeLegibility.

SECTOR SVG LOGO (never text alone): inline 32x32 SVG symbol, stroke 1.5 currentColor, that genuinely represents the trade (barbershop → crossing scissors; restaurant → fork-knife skyline; plumber → bent pipe + drop; electrician → bolt in hexagon; dentist → stylized tooth; gym → dumbbell; spa → lotus; real estate → house-key; lawyer → scales; cleaning → sparkle; auto → gear-wrench; roofing → house with pitch lines; accounting → figures column + checkmark; default → initials monogram), combined with the name in DISPLAY_FONT + category subtitle 0.62rem uppercase letterspacing 0.12em. The same logo (white 24px version) is reused in the footer.

STRUCTURE (14 sections, IN ORDER):
#topbar ONE line: "24/7 Emergency · Call PHONE" if IS_24_7=true, otherwise "HOURS_WEEKDAY · Call PHONE" — tel:PHONE_LINK link. NEVER a scrolling marquee, NEVER an address in the topbar.
#navbar sticky top 0: logo + 5 links MAX (Services, Projects, About, FAQ, Contact) + accent pill button "Call Now" (tel:PHONE_LINK). Translucent white blur(12px) background from the start (no transparent mode), subtle border-bottom, --shadow-2 after scroll > 40px. <768px: links hidden (the mobile bar takes over), logo + Call button kept.
#hero: HERO_IMAGE_PATH as object-fit cover, loading eager fetchpriority="high", width 1920 height 1080 + dark overlay gradient 135deg rgba(8,14,26,.78) → .45 at 55% → .22 + left-aligned content, z-index 2: (1) discreet pill badge "Top Rated in CITY" IN THE FLOW (margin-bottom 18px, NEVER glued to an edge) ONLY if GOOGLE_RATING is real, otherwise badge "Serving CITY & Nearby"; (2) H1 clamp(2.4rem,5.2vw,4.2rem) on 2 lines, 2nd line in an accent span; (3) subtitle 18-20px max-width 56ch from TAGLINE + DESCRIPTION; (4) 2 pill CTAs radius 999px: primary accent "Call Now — PHONE" (tel:PHONE_LINK) + secondary white border "Get a Free Quote" (anchor #contact); (5) ONE row of 3 glass chips radius 999px font 12px: Upfront Pricing / Same-Day Service if IS_24_7 otherwise HOURS_WEEKDAY / Residential & Commercial. NEVER a 2x2 grid of stat cards, NEVER an animated number.
.trust-bar: ONE single full-width bar, var(--primary) background, white text, padding 18px 0, centered inline items separated by dots: real Google rating "RATING ★ · N Google reviews" if real, "Residential & Commercial", HOURS_WEEKDAY if provided, "CITY (+N nearby cities)" if AREAS > 1. ELSEWHERE: NO mention of license, warranty or insured.
#services: 3x2 grid (2 col <768px, 1 col <480px), gap 20px — cards = EXACTLY the objects from the SERVICES field in order: title + short + "Learn more →" in accent, EACH entire card is an <a> href="/services/slug" (slug from the field, otherwise kebab-case of the title), sector SVG icon 40-48px stroke 1.8 in a 52px --neutral square, NO 01-06 numbers, white background --radius-md subtle border, hover translateY(-4px) + --shadow-2 + accent border.
#why: "Why choose us" heading + 4 cards (1 col → 2 col → 4 col): HONEST service commitments only — Upfront pricing (quote approved before we start) / On-time arrival (we call ahead if anything shifts) / Clean job site / Local and responsive — NO stats, NO numbers. Below, #process: 4 steps in a HORIZONTAL row on desktop (vertical on mobile) connected by a line: Call or form → Honest assessment + upfront quote → Work done right, site cleaned → Follow-up call, accent circle numbers 34px.
#projects: gallery of 6 images GALLERY_IMAGE_PATHS assigned IN ORDER, 3-col grid (2 col <768px, 1 col <480px), uniform aspect-ratio 4/3, object-fit cover, border-radius --radius-md, hover zoom scale(1.06) 0.35s, lazy + decoding async, discreet captions; if a path is empty → the tile becomes a CSS gradient primary→accent (NO external image, NO white hole, NO onerror to the outside).
#testimonials: IF GOOGLE_RATING is real → ONE premium centered card block (white background --radius-lg --shadow-2, flex align-center gap 28px): round blue G badge #4285F4, rating in LARGE 2.6rem font-weight 800 rendered STATIC (NEVER an animated counter), #FBBC04 stars letter-spacing .15em, "N verified public reviews on Google", ghost button "See reviews on Google" toward MAPS_LINK. NEVER textual testimonials, NEVER fictional first names, NEVER review dates. IF GOOGLE_RATING is absent → section ENTIRELY OMITTED (no empty shell).
#area: "Proudly serving" + cities from the AREAS field as --neutral pills inline.
#about: split 2 equal columns aligned — ABOUT_IMAGE_PATH image --radius-lg --shadow-2 (object-fit cover, aspect-ratio 4/5) + on the right: kicker, h2 name, 2 paragraphs 60-80 words REWRITTEN from ABOUT_SOURCE (real terms reused), years of experience ONLY if a real field provides it (otherwise absolute silence), license ONLY if known.
#faq: accordion of 6-8 questions (pricing, emergency, warranty, payment methods, permits, service area) — ONE open at a time (aria-expanded, first one open by default), each .faq-item white --radius-md, .faq-q full-width button min-height 44px + .faq-a, questions anchored in CITY and tied to the real services from the SERVICES field.
#contact: 2 EQUAL columns grid gap 28px — LEFT: white form --radius-lg --shadow-2, action="FORM_ACTION" (EXACT field value) method="POST" id="quote-form": hidden honeypot input name="website" class="hp" (position absolute left:-9999px, opacity 0, tabindex -1, autocomplete off) · name (required minlength 2, autocomplete name) · phone (type tel required, autocomplete tel) · email (type email, autocomplete email) · zip (required, autocomplete postal-code) · service = required <select> filled with EXACTLY the titles from the SERVICES field · message textarea required minlength 10 · required consent checkbox + label · .f-msg (error, #fdecea) and .f-ok (success, #e7f6ec) paragraphs display:none by default · full-width accent submit button. JS: JSON fetch on form.action, inline validation (name ≥2, message ≥10, consent), button disabled + "Sending…" while submitting, inline success (NEVER alert); every input font-size 16px (no iOS zoom). RIGHT: info card var(--primary) white --radius-lg — name, address + CITY ZIP, large accent phone, email if provided, hours (closed Sunday in soft red rgba(255,100,100,.85)), MAPS_EMBED iframe loading lazy min-height 200px --radius-md + "Open in Google Maps" link toward MAPS_LINK (NEVER a "Get Directions" button, NEVER raw coordinates in a link).
#footer: var(--primary) background, 3 columns (1.4fr logo + short 2-sentence description / 1fr anchor nav + REAL links href="/privacy" "Privacy Policy" and href="/terms" "Terms of Service" / 1.2fr contact tel: + email + CITY ZIP + hours), contrasting copyright bar rgba(0,0,0,.28) background 14px padding "© JS year NAME. All rights reserved." + CITY, ZIP.

MOBILE: .mobile-bar position fixed left 0 right 0 bottom 0, 2-column grid (Call Now tel: / Get Quote anchor #contact), min-height 56px, padding-bottom env(safe-area-inset-bottom), z-index 90, shown ONLY <768px, body padding-bottom compensated <768px so the footer is never covered — NEVER a WhatsApp floating button, NEVER a FAB. Compact 1-column form. NO horizontal scroll at 360px, touch targets ≥ 44px.

MANDATORY JS (vanilla, deferred, zero dependencies): IntersectionObserver on [data-reveal] (translateY(24px) → 0, opacity 0 → 1, 0.7s cubic-bezier(0.16,1,0.3,1), 90ms stagger, threshold 0.12, unobserve, disabled with prefers-reduced-motion) · one-open-at-a-time FAQ accordion · navbar shadow on scroll · form submission as JSON fetch · footerYear = new Date().getFullYear() · NEVER animated counters (all numeric values rendered STATIC in the HTML), NEVER data-aos, NEVER particles, NEVER parallax, NEVER Ken Burns.

PERFORMANCE: preconnect fonts.googleapis.com + fonts.gstatic.com ONLY (no other domain), fonts display=swap limited weights · every image is a LOCAL PATH with explicit width/height or aspect-ratio for zero CLS · hero eager, everything else lazy + decoding async · every <img> carries onerror="this.onerror=null;this.src='images/about.jpg';" (LOCAL substitution — NEVER display:none, NEVER an external URL) · NO srcset (local paths) · map iframe loading lazy · JS deferred at end of body · transform/opacity animations only.

CONTENT: 100% in NATIVE US ENGLISH · zero [XXX] placeholders, zero lorem ipsum · the city appears in at least 4 places (hero, trust-bar, about, FAQ) · title = name + category + city, under 60 chars · meta description 140-160 chars · FORBIDDEN AND REJECTION TRIGGERS: invented testimonials or reviews (however plausible), fictional first names, invented statistics (years of experience, client counts, "+500 jobs done"), contractual numeric promises (X-year warranty), invented opening hours, review dates — ONLY the real sheet data · banned phrasings: "at the heart of what we do", "we are passionate about", "one-stop shop", more than 2 exclamation marks, any emoji.

SEO & CODE: LocalBusiness JSON-LD (SCHEMA_TYPE type, geo lat/lng IF real, hours IF provided, aggregateRating ONLY if real rating and reviews) + FAQPage JSON-LD · a single h1 (in the hero) · html lang LANG dir LANG_DIR · consistent h2/h3 hierarchy · anchor ids consistent with navbar and footer.

MANDATORY NOMENCLATURE (exact markers checked — one missing marker = rejected deliverable): data-reveal attributes (NOT data-aos or any other name) on animated elements · EXACTLY 3 SVG class="section-divider" (just BEFORE #projects, just BEFORE #testimonials or #area, just BEFORE #footer — soft curve, fill = BACKGROUND color of the FOLLOWING section, width 100%, height clamp(48px,7vw,90px), preserveAspectRatio="none", display block, margin-top -1px, aria-hidden, pointer-events none) · .mobile-bar with exactly 2 <a> (tel:PHONE_LINK + #contact) · .trust-bar full-width primary background · form action="REAL VALUE OF FORM_ACTION" with hidden <input name="website" class="hp"> · onerror="this.onerror=null;this.src='images/about.jpg';" on EVERY <img> · 2 JSON-LD blocks (LocalBusiness + FAQPage) · .faq-q/.faq-a accordion · .f-msg/.f-ok form states.

ABSOLUTE BANS (immediate rejection triggers): data-aos · any counter or animation on the rating or review count · 2x2 stat card grid in the hero · WhatsApp floating button or phone FAB · legal modals (#legalModal/#privacyModal) — the legal pages ALREADY exist at /privacy and /terms, the footer only LINKS to them · srcset · any external http(s) image URL (hotlink) — ONLY the provided local paths · "Get Directions" button (use "Open in Google Maps" toward MAPS_LINK) · emoji · alert()/confirm().

OUTPUT: start directly with <!DOCTYPE html> and end with </html>. No explanation, no markdown, no text before or after, no HTML comment needed.`;

function goldenPrompt(lang: "fr" | "en"): string {
  return lang === "en" ? GOLDEN_EN : GOLDEN_FR;
}

/** Lignes d'interprétation v6 (chemins images locaux, form endpoint, services
 *  JSON complets, rating) — réutilisées par buildSiteBundle (T7). Tolérant aux
 *  champs absents : buildClientSheet v5 ne les fournit pas encore tous. */
export function v6SheetLines(sheet: Record<string, string>, lang: "fr" | "en"): string {
  const g = (k: string): string => (sheet[k] ?? "").trim();
  const paths =
    g("GALLERY_IMAGE_PATHS") ||
    "images/work-1.jpg|images/work-2.jpg|images/work-3.jpg|images/work-4.jpg|images/work-5.jpg|images/work-6.jpg";
  if (lang === "en") {
    return [
      `Display font: ${g("DISPLAY_FONT") || "default"}.`,
      `Hero image (LOCAL path — use exactly): ${g("HERO_IMAGE_PATH") || "images/hero.jpg"}. About image: ${g("ABOUT_IMAGE_PATH") || "images/about.jpg"}.`,
      `Gallery images (6 LOCAL paths, IN ORDER): ${paths}.`,
      `Form POST endpoint (use EXACTLY as the form action): ${g("FORM_ACTION")}.`,
      `Map link (clean Google Maps URL — never raw coordinates): ${g("MAPS_LINK")}. Iframe embed src if provided: ${g("MAPS_EMBED") || "none — use the link only"}.`,
      `Real services (JSON, 5-6 objects with slug/title/short/paras/bullets — use EXACTLY for the cards, each card links to /services/{slug}): ${g("SERVICES") || "use the sector services from the prompt"}.`,
      `Rating: ${g("GOOGLE_RATING") || "none"} (${g("REVIEW_COUNT") || "0"} public reviews) — if none, the testimonials section is ENTIRELY OMITTED.`,
      `24/7 emergency: ${g("IS_24_7") || "no"}. Areas served: ${g("AREAS") || g("CITY")}.`,
    ].join("\n");
  }
  return [
    `Police display : ${g("DISPLAY_FONT") || "défaut"}.`,
    `Image héros (chemin LOCAL — utiliser exactement) : ${g("HERO_IMAGE_PATH") || "images/hero.jpg"}. Image about : ${g("ABOUT_IMAGE_PATH") || "images/about.jpg"}.`,
    `Images de galerie (6 chemins LOCAUX, DANS L'ORDRE) : ${paths}.`,
    `Endpoint POST du formulaire (utiliser EXACTEMENT comme action) : ${g("FORM_ACTION")}.`,
    `Lien carte (URL Google Maps propre — jamais de coordonnées brutes) : ${g("MAPS_LINK")}. Src d'iframe si fourni : ${g("MAPS_EMBED") || "aucun — lien seulement"}.`,
    `Services réels (JSON, 5-6 objets avec slug/title/short/paras/bullets — utiliser EXACTEMENT pour les cartes, chaque carte lie vers /services/{slug}) : ${g("SERVICES") || "utilise les services sectoriels du prompt"}.`,
    `Note : ${g("GOOGLE_RATING") || "aucune"} (${g("REVIEW_COUNT") || "0"} avis publics) — si aucune, la section testimonials est ENTIÈREMENT OMITTE.`,
    `Urgence 24/7 : ${g("IS_24_7") || "non"}. Zones desservies : ${g("AREAS") || g("CITY")}.`,
  ].join("\n");
}

export type BuildResult = {
  html: string;
  engine: "gemini" | "llm" | "template";
};

// Champs bannis du prompt : URLs distantes (hotlink), WhatsApp (FAB interdit v6).
const PROMPT_HIDDEN_KEYS = [
  "NICHE_LABEL",
  "NICHE_ICON",
  "DISPLAY_FONT",
  "ABOUT_IMAGE_URL",
  "HERO_IMAGE_URL",
  "GALLERY_IMAGE_URLS",
  "IMAGE_FALLBACK_URL",
  "WHATSAPP_URL",
];

/** Prompt utilisateur v6 : dump de la fiche + lignes d'interprétation + ordre. */
function userPromptFor(sheet: Record<string, string>, lang: "fr" | "en"): string {
  const niche = findNiche(sheet.BUSINESS_TYPE ?? "");
  const sheetDump = Object.entries(sheet)
    .filter(([k]) => !PROMPT_HIDDEN_KEYS.includes(k))
    .map(([k, v]) => `${k} = ${v}`)
    .join("\n");
  return (
    `CLIENT DATA (${lang === "en" ? "sheet validated by Mapper" : "fiche validée par Mapper"}):\n${sheetDump}\n\n` +
    `SECTEUR / INDUSTRY: ${lang === "en" ? niche.labelEn || niche.label : niche.label}.\n` +
    v6SheetLines(sheet, lang) +
    "\n\n" +
    (lang === "en"
      ? `Generate the complete index.html (homepage only) now, applying ALL rules. Content must be 100% specific to the "${niche.labelEn || niche.label}" industry and locally anchored in ${sheet.CITY || "the target city"}, written in NATIVE US ENGLISH.`
      : `Génère maintenant index.html complet (page d'accueil uniquement), en appliquant TOUTES les règles. Le contenu doit être 100% spécifique au secteur "${niche.label}" et ancré dans la ville de ${sheet.CITY || "la ville cible"}.`)
  );
}

export async function buildSite(clientData: Record<string, string>): Promise<BuildResult> {
  const niche = findNiche(clientData.BUSINESS_TYPE ?? "");
  const useLlm = await llmConfigured();
  // Langue imposée au site : dérivée de la fiche (LANG rempli par Mapper via
  // localeFor(pays)) — un lead US reçoit un site 100% anglais.
  const lang: "fr" | "en" = (clientData.LANG || "fr").startsWith("en") ? "en" : "fr";
  const kickoff =
    lang === "en"
      ? "Produce index.html now — the homepage only, no explanations."
      : "Produis index.html maintenant — la page d'accueil uniquement, aucune explication.";
  const user = userPromptFor(clientData, lang);

  if (await geminiKeysConfigured()) {
    const g0 = Date.now();
    // Budget : 250 s d'horloge murale pour TOUTE l'échelle Gemini (essai 120 s
    // par appel), afin que la réserve template reste atteignable dans la
    // route 300 s même si le free tier est lent ou saturé.
    const raw = await geminiCompleteStep({
      system: goldenPrompt(lang),
      user: `${user}\n\n${kickoff}`,
      maxTokens: 65536,
      temperature: 0.55,
      timeoutMs: 180_000,
      deadlineMs: 250_000,
    });
    const elapsed = Date.now() - g0;
    if (raw) {
      const html = extractHtml(raw);
      if (html && html.length > 8000) return { html, engine: "gemini" };
    }
    // Cerveau omniroute uniquement si le temps le permet : un 2e moteur mort
    // ne doit jamais détruire la garantie template (route plafonnée à 300 s).
    if (useLlm && elapsed < 90_000) {
      // Le cerveau partagé injecte les skills et apprentissages de Coder
      const { agentThink } = await import("./agent-brain");
      const raw =
        (await agentThink({
          agent: "coder",
          task: "generation_site",
          lang,
          instruction: `${goldenPrompt(lang)}\n\n${user}`,
          input: kickoff,
          maxTokens: 16000,
          temperature: 0.6,
        })) ??
        (await chatCompletion({ system: goldenPrompt(lang), user, maxTokens: 16000, temperature: 0.6, timeoutMs: 70_000 }));

      if (raw) {
        const html = extractHtml(raw);
        if (html && html.length > 8000) return { html, engine: "llm" };
      }
    }
  } else if (useLlm) {
    const { agentThink } = await import("./agent-brain");
    const raw =
      (await agentThink({
        agent: "coder",
        task: "generation_site",
        lang,
        instruction: `${goldenPrompt(lang)}\n\n${user}`,
        input: kickoff,
        maxTokens: 16000,
        temperature: 0.6,
      })) ?? (await chatCompletion({ system: goldenPrompt(lang), user, maxTokens: 16000, temperature: 0.6 }));

    if (raw) {
      const html = extractHtml(raw);
      if (html && html.length > 8000) return { html, engine: "llm" };
    }
  }

  // Fallback : gabarit interne fidèle au cahier des charges
  return { html: generateSiteHtml(clientData), engine: "template" };
}

// ───────────────────────── v6 : buildSiteBundle ─────────────────────────
// Orchestration du bundle : images locales → config → Gemini (index seul) →
// fallback déterministe → bundle multi-pages. Les pages auxiliaires, le
// sitemap et le JSON-LD ne passent JAMAIS par le LLM (bundle.ts).
// geminiImpl/fetchImpl injectables pour les tests (mocks, zéro réseau).

export type BundleBuild = {
  html: string;
  bundle: Record<string, string>;
  engine: "gemini" | "fallback";
  todoList: string[];
};

export async function buildSiteBundle(
  sheet: Record<string, string>,
  prospectId: number,
  geminiImpl?: typeof geminiCompleteStep,
  fetchImpl?: typeof fetch
): Promise<BundleBuild> {
  const lang: "fr" | "en" = (sheet.LANG || "fr").startsWith("en") ? "en" : "fr";

  // 1. Images : pool de niche re-pioché (seed nom+ville). Les URLs Serper
  //    historiques ne sont JAMAIS utilisées — photos concurrents bannies.
  const niche = findNiche(sheet.BUSINESS_TYPE ?? "");
  const pool = niche.imagePool.length ? niche.imagePool : [niche.heroImage, niche.aboutImage];
  const picked = pickSeededImages(pool, `${sheet.BUSINESS_NAME ?? ""}|${sheet.CITY ?? ""}`, 6);
  const seen = new Set<string>();
  const slots: ImageSlot[] = [
    { slot: "hero", url: picked.hero },
    { slot: "about", url: picked.about },
    ...picked.gallery.filter((u) => (seen.has(u) ? false : (seen.add(u), true))).map((url) => ({ slot: "gallery" as const, url })),
  ];
  const imgs = await downloadImages(slots, fetchImpl);

  // 2. Fiche v6 : chemins locaux, endpoint form, services complets (prompt).
  const s6: Record<string, string> = {
    ...sheet,
    IMAGE_SOURCE: "local",
    HERO_IMAGE_PATH: imgs.hero ?? "",
    ABOUT_IMAGE_PATH: imgs.about ?? "",
    GALLERY_IMAGE_PATHS: imgs.gallery.join("|"),
    FORM_ACTION: `https://gosite.digital/api/site-form/${prospectId}`,
    SERVICES: JSON.stringify(resolveServices(sheet)),
  };
  const config = buildSiteConfig(s6, prospectId);
  config.images = { hero: imgs.hero ?? "", about: imgs.about ?? "", gallery: imgs.gallery };

  // 3. Gemini (moteur unique v6) → fallback déterministe.
  const kickoff =
    lang === "en"
      ? "Produce index.html now — the homepage only, no explanations."
      : "Produis index.html maintenant — la page d'accueil uniquement, aucune explication.";
  const doGemini = geminiImpl ?? geminiCompleteStep;
  let html: string | null = null;
  try {
    const raw = await doGemini({
      system: goldenPrompt(lang),
      user: `${userPromptFor(s6, lang)}\n\n${kickoff}`,
      maxTokens: 65536,
      temperature: 0.55,
      timeoutMs: 180_000,
      deadlineMs: 250_000,
    });
    if (raw) {
      const extracted = extractHtml(raw);
      if (extracted && extracted.length > 8000) html = extracted;
    }
  } catch {
    // Gemini KO → fallback déterministe
  }
  const engine: "gemini" | "fallback" = html ? "gemini" : "fallback";
  if (!html) html = renderFallbackIndex(config);
  // Garde-fous déterministes (indépendants du LLM) : anti-zoom iOS sur les
  // inputs + rendu autofill Chrome (bug brief « autofill overflow »).
  if (!html.includes("-webkit-autofill")) {
    const guard =
      '<style>input,select,textarea{font-size:16px}input:-webkit-autofill{box-shadow:0 0 0 40px #fff inset;-webkit-text-fill-color:currentColor}</style>';
    html = html.includes("</head>") ? html.replace(/<\/head>/i, `${guard}</head>`) : `${html}${guard}`;
  }

  // 4. Bundle complet : index + pages auxiliaires + images locales.
  const bundle: Record<string, string> = { "index.html": html, ...renderAuxPages(config), ...imgs.files };
  return { html, bundle, engine, todoList: generateTodoList(config) };
}
