// Coder (VibeCoder) — génère le site client, moteur 1 : Gemini (Flash)
// (rotation multi-comptes gratuits), moteur 2 : LLM omniroute, moteur 3 :
// le gabarit interne haute qualité.

import { chatCompletion, extractHtml, llmConfigured } from "./llm";
import { geminiCompleteStep, geminiKeysConfigured } from "./gemini";
import { generateSiteHtml } from "./site-template";
import { findNiche } from "./niches";

const GOLDEN_FR = `RÈGLE D'OR : Tu es un développeur full-stack senior avec 12 ans d'expérience en studios d'agences primées (Awwwards). Tu livres UN fichier HTML complet, immédiatement live-ready, de niveau site-agence-portefeuille. Chaque ligne doit être celle d'un expert humain — jamais d'un template IA.

STRUCTURE OBLIGATOIRE (14 sections, dans l'ordre) : #topbar (marquee défilant : téléphone, adresse, horaires SI fournis uniquement, note Google SI fournie uniquement) · #navbar (logo typographié stylé + liens + CTA téléphone pill + burger mobile animé, sticky avec fond au scroll) · #hero (PLEIN ÉCRAN avec image Unsplash réelle fournie HERO_IMAGE_URL, overlay dégradé max 55% + grain SVG + 2 formes flottantes dégradées aria-hidden, badge étoiles Google UNIQUEMENT si note et avis réels fournis, H1 percutant max 8 mots, sous-titre 15-20 mots, 2 CTA dont un à balayage lumineux shimmer, indicateur scroll animé) · #trust-bar (4 badges réassurance avec icônes Lucide dans pills verre dépoli) · #services (6 cartes minimum avec icônes Lucide DIFFÉRENTES numérotées 01-06, hover translateY(-8px) + ombre portée colorée + barre gradient animée) · #about (split screen : image ABOUT_IMAGE_URL + badge flottant avec la note Google réelle SI fournie, sinon icône du secteur + 2 paragraphes substantiels 60-80 mots + checklist à coches stylées) · #stats (compteurs animés JS IntersectionObserver easing cubic sur fond primary, basés UNIQUEMENT sur les données réelles de la fiche : note Google, nombre d'avis ; complète la grille avec des éléments qualitatifs factuels — ville desservie, contact direct — jamais un chiffre inventé) · #process (4 étapes numérotées en timeline verticale avec ligne gradient animée, sectoriel) · #gallery (galerie photo : grille asymétrique des 6 photos réelles fournies GALLERY_IMAGE_URLS affectées dans l'ordre, chaque carte : img object-fit cover + hover zoom scale(1.06) + voile dégradé + badge tag en verre + icône en coin, chaque photo uniquement à sa position d'origine, jamais mélangées) · #reputation SI note Google et avis réels fournis (bandeau factuel : note réelle en très gros, nombre d'avis publics, lien vers la fiche Google — AUCUN témoignage rédigé, AUCUN prénom inventé ; si pas de note réelle, omettre la section) · #guarantees (4 cartes bordure accent hover glow, engagements non contractuels) · #faq (6-8 questions accordéon animé chevron tournant, un seul ouvert à la fois) · #cta-banner (grand bloc gradient + motif SVG + bouton pulse + 2 décorations flottantes) · #contact (2 colonnes : infos en cartes empilées avec icônes + iframe Google Maps embed arrondie avec voile, et formulaire champ design moderne focus ring accent, validé côté client avec action Formspree commentée ; horaires affichés UNIQUEMENT s'ils sont fournis dans la fiche) · #footer (3 colonnes + liens légaux + retour top) · #float-cta (bouton téléphone fixe avec halo pulsant) · modales Mentions légales + Confidentialité (ouverture, fermeture X, overlay blur, Escape).

TECHNIQUE OBLIGATOIRE : CSS variables --primary/--accent/--neutral (fournies) avec variantes assombries/éclaircies calculées color-mix · police display '${""}' selon style (jamais Poppins/Montserrat) + Inter body · <link rel="preconnect"> fonts.googleapis.com, fonts.gstatic.com, images.unsplash.com · polices display=swap poids limités 400/600/800 · data-aos + IntersectionObserver pour animations scroll avec délais staggered 80-300ms · compteurs animés eased · icônes Lucide via CDN unpkg + lucide.createIcons() après chaque modif DOM, tailles cohérentes · Schema.org JSON-LD complet (type fourni, geo, horaires SI fournis ; aggregateRating UNIQUEMENT si note et nombre d'avis réels fournis — jamais de valeur par défaut) · <title> < 60 car avec ville+secteur · meta description 140-160 car · 0 framework JS, vanilla uniquement.

RESPONSIF MOBILE AVANT TOUT : mobile-first strict : clamp() fluide sur TOUTES les tailles de texte (h1 clamp(2.6rem, 8vw, 5rem), h2 sections clamp(2rem, 5vw, 3.2rem)) · cibles tactiles ≥ 44px · burger fonctionnel en JS avec barres animées en croix et menu mobile plein écran fond primary · hero hauteur 100svh · grilles 1 colonne sous 768px, galerie 1 col < 640px / 2 col < 1024px / asymétrique desktop · images object-fit cover width 100% · bouton flottant masqué quand la section contact est visible · AUCUN scroll horizontal à 360px (overflow-x hidden, max-width 100% partout) · vérifie l'affichage à 360 / 768 / 1200 / 1440px avant de livrer.

PERFORMANCE DES SITES (délais et rendu) : toutes les <img> ont width/height explicites (ou aspect-ratio CSS) pour zéro CLS · loading="lazy" decoding="async" sur toute image sous le fold, héros loading="eager" fetchpriority="high" · chaque <img> onerror="this.style.display='none'" avec parent en fond gradient prêt à servir de repli · contenus lourds (galeries, maps iframe) content-visibility:auto contain-intrinsic-size · JS non bloquant defer en fin de body · AUCUNE lib CSS/JS ajoutée save Lucide · transition/animation transform et opacity uniquement (pas de layout thrash).

STYLE PROFESSIONNEL (rendu agence) : alternance fond neutre / blanc, rythme vertical régulier · grilles asymétriques (offsets, une carte large sur trois) plutôt que des rangées de cartes identiques · numéros de section en chiffre décoratif 6-8rem opacité 8% · ombres multicouches douces 0 20px 60px rgba(0,0,0,.12) · rayons cohérents 12/20/28px · dégradés linéaires 135deg uniquement · décoration : 2-3 formes blob SVG flottantes aria-hidden par page, motifs grille/pointillés opacité 8%, bordures halées en dégradé via pseudo-élément · chaque CTA mène au téléphone ou au formulaire avec un verbe d'action fort.

IMAGES (règle violable = rejet) : utilise UNIQUEMENT les URLs fournies dans la fiche — HERO_IMAGE_URL, ABOUT_IMAGE_URL et les 6 URLs séparées par | de GALLERY_IMAGE_URLS affectées à la galerie DANS L'ORDRE · ne modifie JAMAIS une URL, n'invente JAMAIS un autre ID Unsplash, aucun placeholder, aucune carte dégradée sans photo · chaque <img> porte un alt descriptif ville+prestation et garde aspect-ratio pour zéro CLS.

CONTENU : 100% en français · zéro placeholder [XXX] · zéro lorem ipsum · profondeur réelle : chaque description de service fait 2 phrases avec bénéfice concret et façon de travailler, about 2 paragraphes, FAQ sectorielle ancrée ville · le nom de la ville apparaît dans au moins 4 endroits (hero, about, contact, FAQ) · INTERDIT et motif de rejet : témoignages ou avis clients inventés (même « plausibles »), prénoms/noms de clients fictifs, statistiques inventées (années d'expérience, nombre de clients, « +500 interventions »), promesses contractuelles chiffrées (garantie X ans, délai contractuel), horaires inventés, dates d'avis — UNIQUEMENT les données réelles de la fiche CLIENT DATA · interdit : "at the heart of what we do", "we are passionate about", "one-stop shop", plus de 2 points d'exclamation.

SORTIE : commence par <!DOCTYPE html> et termine par </html>. Aucune explication, aucun markdown autour.`;

const GOLDEN_EN = `GOLDEN RULE: You are a senior full-stack developer with 12 years at award-winning studios (Awwwards). You deliver ONE complete HTML file, immediately live-ready, portfolio-grade agency quality. Every line must read like a human expert — never an AI template.

MANDATORY STRUCTURE (14 sections, in order): #topbar (scrolling marquee: phone, address, opening hours ONLY if provided, Google rating ONLY if provided) · #navbar (styled typographic logo + links + phone pill CTA + animated mobile burger, sticky with background on scroll) · #hero (FULL SCREEN with the real provided Unsplash image HERO_IMAGE_URL, gradient overlay max 55% + SVG grain + 2 floating gradient shapes aria-hidden, Google stars badge ONLY if real rating and reviews provided, punchy H1 max 8 words, 15-20 word subheadline, 2 CTAs one with shimmer sweep, animated scroll indicator) · #trust-bar (4 reassurance badges with Lucide icons in glass pills) · #services (6 cards minimum with DIFFERENT Lucide icons numbered 01-06, hover translateY(-8px) + colored shadow + animated gradient bar) · #about (split screen: ABOUT_IMAGE_URL + floating badge with real Google rating IF provided, otherwise industry icon + 2 substantial 60-80 word paragraphs + styled checklist) · #stats (JS IntersectionObserver animated counters with cubic easing on primary background, based ONLY on real sheet data: Google rating, review count; complete the grid with factual qualitative items — served city, direct contact — never an invented number) · #process (4 numbered steps as an animated vertical gradient timeline, industry-specific) · #gallery (photo gallery: asymmetric grid of the 6 real photos provided in GALLERY_IMAGE_URLS assigned in order, each card: img object-fit cover + hover zoom scale(1.06) + gradient veil + glass tag badge + corner icon, each photo always at its own original slot, never shuffled) · #reputation IF real Google rating and reviews provided (factual banner: real rating huge, public review count, link to Google listing — NO written testimonials, NO invented first names; if no real rating, omit the section) · #guarantees (4 accent-border cards with hover glow, non-contractual commitments) · #faq (6-8 questions, animated accordion with rotating chevron, one item open at a time) · #cta-banner (large gradient block + SVG pattern + pulse button + 2 floating decorations) · #contact (2 columns: info cards with icons + rounded Google Maps embed iframe with veil, and a modern form with accent focus ring, client-side validated, commented Formspree action; hours shown ONLY if provided in the sheet) · #footer (3 columns + legal links + back to top) · #float-cta (fixed phone button with pulsing halo) · Legal notice + Privacy modals (open, X close, blur overlay, Escape).

MANDATORY TECH: CSS variables --primary/--accent/--neutral (provided) with computed darker/lighter variants via color-mix · display font '${""}' per style (never Poppins/Montserrat) + Inter body · <link rel="preconnect"> fonts.googleapis.com, fonts.gstatic.com, images.unsplash.com · fonts display=swap limited weights 400/600/800 · data-aos + IntersectionObserver scroll animations with staggered 80-300ms delays · eased animated counters · Lucide via unpkg CDN + lucide.createIcons() after each DOM change, consistent sizes · complete Schema.org JSON-LD (provided type, geo, hours IF provided; aggregateRating ONLY if real rating and review count provided — never a default value) · <title> < 60 chars with city+industry · meta description 140-160 chars · 0 JS framework, vanilla only.

MOBILE FIRST, STRICT: fluid clamp() on ALL text sizes (h1 clamp(2.6rem, 8vw, 5rem), section h2 clamp(2rem, 5vw, 3.2rem)) · touch targets ≥ 44px · working burger in JS with bars animating into an X and full-screen mobile menu on primary background · hero height 100svh · grids 1 column under 768px, gallery 1 col < 640px / 2 col < 1024px / asymmetric desktop · images object-fit cover width 100% · floating button hidden when contact section visible · NO horizontal scroll at 360px (overflow-x hidden, max-width 100% everywhere) · mentally verify rendering at 360 / 768 / 1200 / 1440px before delivery.

PERFORMANCE (speed & rendering): every <img> has explicit width/height (or CSS aspect-ratio) for zero CLS · loading="lazy" decoding="async" on every below-fold image, hero loading="eager" fetchpriority="high" · every <img> onerror="this.style.display='none'" with its parent ready with a gradient background as fallback · heavy content (gallery, maps iframe) content-visibility:auto contain-intrinsic-size · JS non-blocking, deferred at end of body · NO extra CSS/JS library except Lucide · transition/animation on transform and opacity only (no layout thrash).

PROFESSIONAL STYLE (agency look): regular vertical rhythm, alternating neutral / white section backgrounds · asymmetric grids (offsets, one wide card in three) instead of rows of identical cards · huge decorative section numbers 6-8rem at 8% opacity · soft multi-layer shadows 0 20px 60px rgba(0,0,0,.12) · consistent radii 12/20/28px · linear gradients 135deg only · decoration: 2-3 floating SVG blob shapes aria-hidden per page, grid/dot patterns at 8% opacity, gradient-tinted borders via pseudo-elements · every CTA leads to phone or form with a strong action verb.

IMAGES (breaking this rule = rejection): use ONLY the URLs provided in the sheet — HERO_IMAGE_URL, ABOUT_IMAGE_URL and the 6 |-separated URLs from GALLERY_IMAGE_URLS assigned to the gallery IN ORDER · NEVER alter an URL, NEVER invent another Unsplash ID, no placeholders, no gradient cards without photos · every <img> carries descriptive alt with city+service and keeps aspect-ratio for zero CLS.

CONTENT: 100% in NATIVE US ENGLISH · zero [XXX] placeholders · zero lorem ipsum · real depth: every service description is 2 sentences with concrete benefit and way of working, about has 2 paragraphs, city-anchored industry FAQ · the city name appears in at least 4 places (hero, about, contact, FAQ) · FORBIDDEN and rejection triggers: invented testimonials or customer reviews (however "plausible"), fictional customer names, invented statistics (years of experience, customer counts, "+500 jobs done"), contractual numeric promises (X-year warranty, contractual deadlines), invented opening hours, review dates — ONLY the real CLIENT DATA sheet data · banned phrasings: "at the heart of what we do", "we are passionate about", "one-stop shop", more than 2 exclamation marks.

OUTPUT: starts with <!DOCTYPE html> and ends with </html>. No explanation, no markdown around.`;

function goldenPrompt(lang: "fr" | "en"): string {
  return lang === "en" ? GOLDEN_EN : GOLDEN_FR;
}

export type BuildResult = {
  html: string;
  engine: "gemini" | "llm" | "template";
};

export async function buildSite(clientData: Record<string, string>): Promise<BuildResult> {
  const niche = findNiche(clientData.BUSINESS_TYPE ?? "");
  const useLlm = await llmConfigured();
  // Langue imposée au site : dérivée de la fiche (LANG rempli par Mapper via
  // localeFor(pays)) — un lead US reçoit un site 100% anglais.
  const lang: "fr" | "en" = (clientData.LANG || "fr").startsWith("en") ? "en" : "fr";
  const kickoff = lang === "en" ? "Produce the complete HTML document now." : "Produis le document HTML complet maintenant.";
  const sheet = Object.entries(clientData)
    .filter(([k]) => !["NICHE_LABEL", "NICHE_ICON", "DISPLAY_FONT", "ABOUT_IMAGE_URL"].includes(k))
    .map(([k, v]) => `${k} = ${v}`)
    .join("\n");
  const user =
    `CLIENT DATA (${lang === "en" ? "sheet validated by Mapper" : "fiche validée par Mapper"}):\n${sheet}\n\n` +
    `SECTEUR / INDUSTRY: ${niche.label}. ${lang === "en" ? `Display font to use: ${clientData.DISPLAY_FONT}. Hero image: ${clientData.HERO_IMAGE_URL}. About image: ${clientData.ABOUT_IMAGE_URL}. Gallery images (6, in order): ${clientData.GALLERY_IMAGE_URLS}.` : `Police display à utiliser : ${clientData.DISPLAY_FONT}. Image hero : ${clientData.HERO_IMAGE_URL}. Image about : ${clientData.ABOUT_IMAGE_URL}. Images de galerie (6, dans l'ordre) : ${clientData.GALLERY_IMAGE_URLS}.`}\n` +
    (lang === "en"
      ? `Generate the complete single-file site now, applying ALL rules. Content must be 100% specific to the "${niche.label}" industry and locally anchored in ${clientData.CITY}, written in NATIVE US ENGLISH.`
      : `Génère maintenant le site complet, monofichier, en appliquant TOUTES les règles. Le contenu doit être 100% spécifique au secteur "${niche.label}" et ancré dans la ville de ${clientData.CITY}.`);

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
      timeoutMs: 120_000,
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
