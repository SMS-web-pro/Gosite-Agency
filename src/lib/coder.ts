// Coder (VibeCoder) — génère le site client via LLM omniroute,
// avec le gabarit interne haute qualité en secours.

import { chatCompletion, extractHtml, llmConfigured } from "./llm";
import { generateSiteHtml } from "./site-template";
import { findNiche } from "./niches";

const GOLDEN_PROMPT = `RÈGLE D'OR : Tu es un développeur full-stack senior avec 12 ans d'expérience. Tu livres UN fichier HTML complet, immédiatement live-ready. Chaque ligne doit être celle d'un expert humain — jamais d'un template IA.

STRUCTURE OBLIGATOIRE (16 sections, dans l'ordre) : #topbar (marquee défilant : téléphone, adresse, horaires, note Google) · #navbar (logo + liens + CTA téléphone + burger mobile) · #hero (PLEIN ÉCRAN avec image Unsplash réelle fournie, overlay dégradé max 55%, motif SVG subtil, badge étoiles Google, H1 percutant max 8 mots, 2 CTA dont un avec animation pulse, indicateur scroll) · #trust-bar (4 badges réassurance avec icônes Lucide) · #services (6 cartes minimum avec icônes Lucide DIFFÉRENTES, hover translateY + barre gradient) · #about (split screen : image + badge flottant années + checklist) · #stats (4 compteurs animés JS IntersectionObserver sur fond primary) · #process (4 étapes numérotées, sectoriel) · #gallery (6 placeholders dégradés avec icône + titre + tag) · #testimonials (6 avis 30-55 mots, noms culturellement adaptés à la ville, carousel avec dots + autoplay 5s) · #guarantees (4 cartes bordure accent) · #faq (6-8 questions accordéon animé) · #cta-banner (gradient + bouton pulse) · #contact (2 colonnes : infos + iframe Google Maps embed, et formulaire validé côté client avec action Formspree commentée) · #footer (3 colonnes + liens légaux) · #float-cta (bouton téléphone fixe) · modales Mentions légales + Confidentialité (ouverture, fermeture X, overlay, Escape).

TECHNIQUE OBLIGATOIRE : CSS variables --primary/--accent/--neutral (fournies) avec variantes assombries/éclaircies calculées · police display '${""}' selon style (jamais Poppins/Montserrat) + Inter body · data-aos + IntersectionObserver pour animations scroll · compteurs animés eased · Lucide via CDN unpkg + lucide.createIcons() après chaque modif DOM · Schema.org JSON-LD complet (type fourni, geo, horaires, aggregateRating) · <title> < 60 car avec ville+secteur · meta description 140-160 car · responsive 375/768/1200 · 0 framework JS, vanilla uniquement.

CONTENU : 100% en français · zéro placeholder [XXX] · zéro lorem ipsum · témoignages avec noms locaux et service précis cité · FAQ sectorielle · interdit : "at the heart of what we do", "we are passionate about", "one-stop shop", plus de 2 points d'exclamation · statistiques logiques (10 ans = max 2000 clients).

SORTIE : commence par <!DOCTYPE html> et termine par </html>. Aucune explication, aucun markdown autour.`;

export type BuildResult = {
  html: string;
  engine: "llm" | "template";
};

export async function buildSite(clientData: Record<string, string>): Promise<BuildResult> {
  const niche = findNiche(clientData.BUSINESS_TYPE ?? "");
  const useLlm = await llmConfigured();

  if (useLlm) {
    const sheet = Object.entries(clientData)
      .filter(([k]) => !["NICHE_LABEL", "NICHE_ICON", "DISPLAY_FONT", "ABOUT_IMAGE_URL"].includes(k))
      .map(([k, v]) => `${k} = ${v}`)
      .join("\n");
    const user = `CLIENT DATA (fiche validée par Mapper) :\n${sheet}\n\nSECTEUR : ${niche.label}. Police display à utiliser : ${clientData.DISPLAY_FONT}. Image hero : ${clientData.HERO_IMAGE_URL}. Image about : ${clientData.ABOUT_IMAGE_URL}.\nGénère maintenant le site complet, monofichier, en appliquant TOUTES les règles. Le contenu doit être 100% spécifique au secteur "${niche.label}" et ancré dans la ville de ${clientData.CITY}.`;

    // Le cerveau partagé injecte les skills et apprentissages de Coder
    const { agentThink } = await import("./agent-brain");
    const raw =
      (await agentThink({
        agent: "coder",
        task: "generation_site",
        instruction: `${GOLDEN_PROMPT}\n\n${user}`,
        input: "Produis le document HTML complet maintenant.",
        maxTokens: 16000,
        temperature: 0.6,
      })) ??
      (await chatCompletion({ system: GOLDEN_PROMPT, user, maxTokens: 16000, temperature: 0.6 }));

    if (raw) {
      const html = extractHtml(raw);
      if (html && html.length > 8000) return { html, engine: "llm" };
    }
  }

  // Fallback : gabarit interne fidèle au cahier des charges
  return { html: generateSiteHtml(clientData), engine: "template" };
}
