// Coder (VibeCoder) — génère le site client, moteur 1 : Gemini (Flash)
// (rotation multi-comptes gratuits), moteur 2 : LLM omniroute, moteur 3 :
// le gabarit interne haute qualité.

import { chatCompletion, extractHtml, llmConfigured } from "./llm";
import { geminiCompleteStep, geminiKeysConfigured } from "./gemini";
import { generateSiteHtml } from "./site-template";
import { findNiche } from "./niches";

const GOLDEN_FR = `RÈGLE D'OR : Tu es un développeur full-stack senior avec 12 ans d'expérience. Tu livres UN fichier HTML complet, immédiatement live-ready. Chaque ligne doit être celle d'un expert humain — jamais d'un template IA.

STRUCTURE OBLIGATOIRE (14 sections, dans l'ordre) : #topbar (marquee défilant : téléphone, adresse, horaires SI fournis uniquement, note Google SI fournie uniquement) · #navbar (logo + liens + CTA téléphone + burger mobile) · #hero (PLEIN ÉCRAN avec image Unsplash réelle fournie, overlay dégradé max 55%, motif SVG subtil, badge étoiles Google UNIQUEMENT si note et avis réels fournis, H1 percutant max 8 mots, 2 CTA dont un avec animation pulse, indicateur scroll) · #trust-bar (4 badges réassurance avec icônes Lucide) · #services (6 cartes minimum avec icônes Lucide DIFFÉRENTES, hover translateY + barre gradient) · #about (split screen : image + badge flottant avec la note Google réelle SI fournie, sinon icône du secteur + checklist) · #stats (compteurs animés JS IntersectionObserver sur fond primary, basés UNIQUEMENT sur les données réelles de la fiche : note Google, nombre d'avis ; complète la grille avec des éléments qualitatifs factuels — ville desservie, contact direct — jamais un chiffre inventé) · #process (4 étapes numérotées, sectoriel) · #gallery (6 placeholders dégradés avec icône + titre + tag) · #reputation SI note Google et avis réels fournis (bandeau factuel : note réelle, nombre d'avis publics, lien vers la fiche Google — AUCUN témoignage rédigé, AUCUN prénom inventé ; si pas de note réelle, omettre la section) · #guarantees (4 cartes bordure accent, engagements non contractuels) · #faq (6-8 questions accordéon animé) · #cta-banner (gradient + bouton pulse) · #contact (2 colonnes : infos + iframe Google Maps embed, et formulaire validé côté client avec action Formspree commentée ; horaires affichés UNIQUEMENT s'ils sont fournis dans la fiche) · #footer (3 colonnes + liens légaux) · #float-cta (bouton téléphone fixe) · modales Mentions légales + Confidentialité (ouverture, fermeture X, overlay, Escape).

TECHNIQUE OBLIGATOIRE : CSS variables --primary/--accent/--neutral (fournies) avec variantes assombries/éclaircies calculées · police display '${""}' selon style (jamais Poppins/Montserrat) + Inter body · data-aos + IntersectionObserver pour animations scroll · compteurs animés eased · Lucide via CDN unpkg + lucide.createIcons() après chaque modif DOM · Schema.org JSON-LD complet (type fourni, geo, horaires SI fournis ; aggregateRating UNIQUEMENT si note et nombre d'avis réels fournis — jamais de valeur par défaut) · <title> < 60 car avec ville+secteur · meta description 140-160 car · responsive 375/768/1200 · 0 framework JS, vanilla uniquement.

CONTENU : 100% en français · zéro placeholder [XXX] · zéro lorem ipsum · FAQ sectorielle · INTERDIT et motif de rejet : témoignages ou avis clients inventés (même « plausibles »), prénoms/noms de clients fictifs, statistiques inventées (années d'expérience, nombre de clients, « +500 interventions »), promesses contractuelles chiffrées (garantie X ans, délai contractuel), horaires inventés, dates d'avis — UNIQUEMENT les données réelles de la fiche CLIENT DATA · interdit : "at the heart of what we do", "we are passionate about", "one-stop shop", plus de 2 points d'exclamation.

SORTIE : commence par <!DOCTYPE html> et termine par </html>. Aucune explication, aucun markdown autour.`;

const GOLDEN_EN = `GOLDEN RULE: You are a senior full-stack developer with 12 years of experience. You deliver ONE complete HTML file, immediately live-ready. Every line must read like a human expert — never an AI template.

MANDATORY STRUCTURE (14 sections, in order): #topbar (scrolling marquee: phone, address, opening hours ONLY if provided, Google rating ONLY if provided) · #navbar (logo + links + phone CTA + mobile burger) · #hero (FULL SCREEN with provided real Unsplash image, gradient overlay max 55%, subtle SVG pattern, Google stars badge ONLY if real rating and reviews provided, punchy H1 max 8 words, 2 CTAs one with pulse animation, scroll indicator) · #trust-bar (4 reassurance badges with Lucide icons) · #services (6 cards minimum with DIFFERENT Lucide icons, hover translateY + gradient bar) · #about (split screen: image + floating badge with real Google rating IF provided, otherwise industry icon + checklist) · #stats (JS IntersectionObserver animated counters on primary background, based ONLY on real sheet data: Google rating, review count; complete the grid with factual qualitative items — served city, direct contact — never an invented number) · #process (4 numbered steps, industry-specific) · #gallery (6 gradient placeholders with icon + title + tag) · #reputation IF real Google rating and reviews provided (factual banner: real rating, public review count, link to Google listing — NO written testimonials, NO invented first names; if no real rating, omit the section) · #guarantees (4 accent-border cards, non-contractual commitments) · #faq (6-8 animated accordion questions) · #cta-banner (gradient + pulse button) · #contact (2 columns: info + Google Maps embed iframe, and client-side validated form with commented Formspree action; hours shown ONLY if provided in the sheet) · #footer (3 columns + legal links) · #float-cta (fixed phone button) · Legal notice + Privacy modals (open, X close, overlay, Escape).

MANDATORY TECH: CSS variables --primary/--accent/--neutral (provided) with computed darker/lighter variants · display font '${""}' per style (never Poppins/Montserrat) + Inter body · data-aos + IntersectionObserver scroll animations · eased animated counters · Lucide via unpkg CDN + lucide.createIcons() after each DOM change · complete Schema.org JSON-LD (provided type, geo, hours IF provided; aggregateRating ONLY if real rating and review count provided — never a default value) · <title> < 60 chars with city+industry · meta description 140-160 chars · responsive 375/768/1200 · 0 JS framework, vanilla only.

CONTENT: 100% in NATIVE US ENGLISH · zero [XXX] placeholders · zero lorem ipsum · industry-specific FAQ · FORBIDDEN and rejection triggers: invented testimonials or customer reviews (however "plausible"), fictional customer names, invented statistics (years of experience, customer counts, "+500 jobs done"), contractual numeric promises (X-year warranty, contractual deadlines), invented opening hours, review dates — ONLY the real CLIENT DATA sheet data · banned phrasings: "at the heart of what we do", "we are passionate about", "one-stop shop", more than 2 exclamation marks.

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

  if (await geminiKeysConfigured()) {
    const sheet = Object.entries(clientData)
      .filter(([k]) => !["NICHE_LABEL", "NICHE_ICON", "DISPLAY_FONT", "ABOUT_IMAGE_URL"].includes(k))
      .map(([k, v]) => `${k} = ${v}`)
      .join("\n");
    const user =
      `CLIENT DATA (${lang === "en" ? "sheet validated by Mapper" : "fiche validée par Mapper"}):\n${sheet}\n\n` +
      `SECTEUR / INDUSTRY: ${niche.label}. ${lang === "en" ? `Display font to use: ${clientData.DISPLAY_FONT}. Hero image: ${clientData.HERO_IMAGE_URL}. About image: ${clientData.ABOUT_IMAGE_URL}.` : `Police display à utiliser : ${clientData.DISPLAY_FONT}. Image hero : ${clientData.HERO_IMAGE_URL}. Image about : ${clientData.ABOUT_IMAGE_URL}.`}\n` +
      (lang === "en"
        ? `Generate the complete single-file site now, applying ALL rules. Content must be 100% specific to the "${niche.label}" industry and locally anchored in ${clientData.CITY}, written in NATIVE US ENGLISH.`
        : `Génère maintenant le site complet, monofichier, en appliquant TOUTES les règles. Le contenu doit être 100% spécifique au secteur "${niche.label}" et ancré dans la ville de ${clientData.CITY}.`);

    const raw = await geminiCompleteStep({
      system: goldenPrompt(lang),
      user: `${user}\n\n${kickoff}`,
      maxTokens: 16384,
      temperature: 0.6,
    });
    if (raw) {
      const html = extractHtml(raw);
      if (html && html.length > 8000) return { html, engine: "gemini" };
    }
  }

  if (useLlm) {
    const sheet = Object.entries(clientData)
      .filter(([k]) => !["NICHE_LABEL", "NICHE_ICON", "DISPLAY_FONT", "ABOUT_IMAGE_URL"].includes(k))
      .map(([k, v]) => `${k} = ${v}`)
      .join("\n");
    const user =
      `CLIENT DATA (${lang === "en" ? "sheet validated by Mapper" : "fiche validée par Mapper"}):\n${sheet}\n\n` +
      `SECTEUR / INDUSTRY: ${niche.label}. ${lang === "en" ? `Display font to use: ${clientData.DISPLAY_FONT}. Hero image: ${clientData.HERO_IMAGE_URL}. About image: ${clientData.ABOUT_IMAGE_URL}.` : `Police display à utiliser : ${clientData.DISPLAY_FONT}. Image hero : ${clientData.HERO_IMAGE_URL}. Image about : ${clientData.ABOUT_IMAGE_URL}.`}\n` +
      (lang === "en"
        ? `Generate the complete single-file site now, applying ALL rules. Content must be 100% specific to the "${niche.label}" industry and locally anchored in ${clientData.CITY}, written in NATIVE US ENGLISH.`
        : `Génère maintenant le site complet, monofichier, en appliquant TOUTES les règles. Le contenu doit être 100% spécifique au secteur "${niche.label}" et ancré dans la ville de ${clientData.CITY}.`);

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
      (await chatCompletion({ system: goldenPrompt(lang), user, maxTokens: 16000, temperature: 0.6 }));

    if (raw) {
      const html = extractHtml(raw);
      if (html && html.length > 8000) return { html, engine: "llm" };
    }
  }

  // Fallback : gabarit interne fidèle au cahier des charges
  return { html: generateSiteHtml(clientData), engine: "template" };
}
