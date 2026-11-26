// Couche 1 (spec refonte 2.2) — génération du SiteSpec par le LLM
// « directeur artistique ». Le LLM produit un JSON validé par Zod ; en cas
// d'échec, un retry lui est proposé avec la fiche, le JSON fautif et les
// erreurs de validation (un appel LLM est sans mémoire : sans ces rappels,
// il ne peut pas corriger ce qu'il n'a pas sous les yeux).

import { z } from "zod";
import { SiteSpecSchema, STYLE_GUIDE_IDS, type SiteSpec } from "./site-spec.schema";
import { STYLE_GUIDES, allowedHero, styleGuidesPrompt } from "./design/style-guides";
import { parseLooseJson } from "../lib/agent-brain";
import { geminiCompleteStep } from "../lib/gemini";

export type ClientSheet = Record<string, string>;

export type SpecLlmCall = (params: {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
  jsonMode: boolean;
}) => Promise<string | null>;

const defaultLlm: SpecLlmCall = (p) =>
  geminiCompleteStep({
    system: p.system,
    user: p.user,
    maxTokens: p.maxTokens,
    temperature: p.temperature,
    jsonMode: p.jsonMode,
  });

const SYSTEM_PROMPT = `Tu es un directeur artistique senior et copywriter expert.
Tu crées des spécifications de sites web pour des PME/TPE locales.

Tu reçois une FICHE CLIENT et tu produis un JSON "SiteSpec" structuré.

RÈGLES ABSOLUES — TU DOIS TOUTES LES RESPECTER SANS EXCEPTION :

LANGUE :
- TOUT le contenu (100%) doit être dans la langue indiquée par le champ LANG
- Aucun mot dans une autre langue. Pas "in City" mais "à City" en FR, "en City" en ES, etc.
- Les CTA, les FAQ, les titres de sections, les meta descriptions, les pages légales,
  les témoignages — TOUT est dans la langue cible
- Si LANG=ar, le contenu est en arabe. Si LANG=fr, en français. Etc.

BUSINESS MODEL :
- Tu DOIS choisir le businessModel correct et adapter TOUT le vocabulaire :
  - "contractor" → devis, intervention, réparation, déplacement, chantier
  - "membership" → abonnement, essai gratuit, cours, planning, inscription
  - "retail" → produits, livraison, catalogue, commande
  - "restaurant" → menu, réservation, plat, carte, ambiance, chef
  - "professional" → consultation, rendez-vous, expertise, cabinet, honoraires
  - "education" → formation, programme, inscription, certificat, cours
  - "wellness" → soin, rendez-vous, prestation, rituel, bien-être
  - "automotive" → véhicule, rendez-vous, entretien, diagnostic, devis
- JAMAIS de vocabulaire d'un autre business model (pas "devis" pour un gym,
  pas "abonnement" pour un plombier)

CONTENU :
- Chaque headline doit être UNIQUE et spécifique au business (pas générique)
- INTERDIT les accroches réutilisables du type "[Ville]'s finest …", "Leading …",
  "Your trusted …" : la headline doit citer un bénéfice CONCRET + un élément
  propre au client (nom, quartier, spécialité). Deux clients de la même niche
  ne doivent partager AUCUNE phrase (hero, FAQ, meta, services).
- Les FAQ doivent être des VRAIES questions qu'un client poserait pour CE business
- Les témoignages doivent utiliser des prénoms culturellement appropriés à la ville/pays
- Les services doivent correspondre à ce que fait RÉELLEMENT ce type de business
- homeSections DOIT contenir au minimum hero, services, contact (formulaire) et FAQ.
  Si des photos sont disponibles, ajoute aussi une galerie.
- servicePages doit couvrir les services affichés (une page par service, 3 à 6).
- N'invente JAMAIS de fait, chiffre, label ou certification absents de la fiche :
  pas de "100% naturel", "n°1", "10 ans d'expérience", "certifié" ou "leader"
  si la donnée ne figure pas explicitement dans la fiche. Les seules preuves
  autorisées sont la note, le nombre d'avis, les horaires, les services et les
  garanties génériques de la niche.
- Les valeurs de confiance doivent être naturelles et lisibles ("4,9/5",
  "127 avis", "5 jours/7"), jamais ambiguës comme "5j/7".
- Les pages légales doivent correspondre au pays du business (pas de références US pour le Maroc)
- Le ton doit correspondre à la niche (luxe pour spa, énergique pour gym, rassurant pour médecin)

DESIGN :
${styleGuidesPrompt()}
- L'ordre des sections doit suivre la logique de conversion pour CE business
  (ex: restaurant → hero, menu/services, galerie, avis, réservation/contact
   vs plombier → hero, trust, services, process, FAQ, contact)

SEO :
- metaTitle : "[Business Name] — [Service principal] à [Ville]" (max 60 chars)
- metaDescription : proposition de valeur claire, avec ville, max 160 chars
- Chaque page service a sa propre metaDescription unique et optimisée SEO

FORMAT :
- Tu retournes UNIQUEMENT du JSON valide, rien d'autre
- Pas de commentaires, pas de markdown, pas d'explication
- Le JSON doit être conforme au schéma SiteSpec fourni`;

// Le schéma complet est injecté dans le system prompt : le LLM n'invente pas
// la forme du JSON, il la lit (zod 4 expose le JSON Schema du schéma Zod).
const SCHEMA_JSON = JSON.stringify(z.toJSONSchema(SiteSpecSchema));

function buildSystem(): string {
  return `${SYSTEM_PROMPT}\n\nSCHÉMA JSON SITESPEC (forme EXACTE attendue, JSON Schema) :\n${SCHEMA_JSON}`;
}

function buildUserPrompt(sheet: ClientSheet, avoid: string[] = [], avoidStyles: string[] = []): string {
  const antiClone = avoid.length
    ? `\n\nCONTENU DÉJÀ PUBLIÉ — INTERDIT DE RÉUTILISER (même formulation) :\n${avoid
        .slice(0, 120)
        .map((s) => `- ${s}`)
        .join("\n")}\nÉcris des accroches, une metaTitle et des questions FAQ inédites pour CE client.`
    : "";
  const recentStyles = avoidStyles
    .filter((id) => (STYLE_GUIDE_IDS as readonly string[]).includes(id))
    .slice(0, 20);
  const styleHistory = recentStyles.length
    ? `\n\nSTYLE GUIDES RÉCEMMENT UTILISÉS — VARIER LA DIRECTION ARTISTIQUE :\n${recentStyles
        .map((id) => `- ${id}`)
        .join("\n")}\nChoisis un autre guide pertinent pour CE client, sauf si son métier l'impose.`
    : "";
  return `
FICHE CLIENT :
- Nom du business : ${sheet.BUSINESS_NAME}
- Type d'activité : ${sheet.BUSINESS_TYPE}
- Type schema.org : ${sheet.SCHEMA_TYPE}
- Tagline : ${sheet.TAGLINE || "aucune"}
- Description : ${sheet.DESCRIPTION || "aucune"}
- Ville : ${sheet.CITY}
- Pays : ${sheet.COUNTRY}
- Adresse : ${sheet.ADDRESS}, ${sheet.ZIP}
- Téléphone : ${sheet.PHONE}
- Email : ${sheet.EMAIL}
- Langue du site : ${sheet.LANG}
- Direction texte : ${sheet.LANG_DIR || "ltr"}
- Devise : ${sheet.CURRENCY}
- Horaires semaine : ${sheet.HOURS_WEEKDAY}
- Horaires samedi : ${sheet.HOURS_SAT}
- Horaires dimanche : ${sheet.HOURS_SUN}
- Note Google : ${sheet.GOOGLE_RATING || "inconnue"}/5 (${sheet.REVIEW_COUNT || "0"} avis)
- Services connus : ${sheet.SERVICES}
- Couleur primaire existante : ${sheet.PRIMARY_COLOR || "à proposer"}
- Couleur accent existante : ${sheet.ACCENT_COLOR || "à proposer"}
- Style demandé : ${sheet.STYLE || "moderne et professionnel"}

Génère le SiteSpec JSON complet pour ce client.${antiClone}${styleHistory}`.trim();
}

function parseSpecJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return parseLooseJson<unknown>(raw);
  }
}

function issuesSummary(issues: z.ZodError["issues"]): string {
  return issues
    .slice(0, 15)
    .map((i) => `- ${i.path.join(".")}: ${i.message}`)
    .join("\n");
}

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const cut = (v: unknown, max: number, fallback = ""): string =>
  typeof v === "string" ? v.slice(0, max) : fallback;

/** Répare les dérives fréquentes du LLM (meta trop longue, CTA invalide,
 *  libellés hors bornes) avant validation — un site bloqué pour 3 caractères
 *  de trop n'a aucun intérêt pour le client. Le fond reste intact. */
function repairSpecJson(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const s = { ...(raw as Record<string, unknown>) };
  s.metaTitle = cut(s.metaTitle, 60);
  s.metaDescription = cut(s.metaDescription, 160);
  s.ogDescription = cut(s.ogDescription, 200);

  const repairMeta = (v: unknown): Record<string, unknown> => {
    const p = asObject(v);
    return { ...p, metaTitle: cut(p.metaTitle, 60), metaDescription: cut(p.metaDescription, 160) };
  };
  s.aboutPage = repairMeta(s.aboutPage);

  const repairLegal = (v: unknown): Record<string, unknown> => {
    const p = repairMeta(v);
    return {
      ...p,
      title: cut(p.title, 60),
      sections: Array.isArray(p.sections)
        ? p.sections.map((sec) => {
            const x = asObject(sec);
            return { ...x, heading: cut(x.heading, 60), content: cut(x.content, 600) };
          })
        : p.sections,
    };
  };
  s.privacyPage = repairLegal(s.privacyPage);
  s.termsPage = repairLegal(s.termsPage);

  if (Array.isArray(s.homeSections)) {
    const limits: Record<string, number> = {
      title: 60, subtitle: 120, headline: 80, subheadline: 200, eyebrow: 48,
    };
    s.homeSections = s.homeSections.map((sec) => {
      const x = asObject(sec);
      const out: Record<string, unknown> = { ...x };
      for (const [key, max] of Object.entries(limits)) {
        if (key in out) out[key] = cut(out[key], max);
      }
      if (Array.isArray(out.chips)) out.chips = out.chips.slice(0, 6).map((c) => cut(c, 40));
      if ("primaryCta" in out) {
        const cta = asObject(out.primaryCta);
        out.primaryCta = {
          ...cta,
          label: cut(cta.label, 30),
          action: ["call", "form", "whatsapp", "booking"].includes(String(cta.action)) ? cta.action : "call",
        };
      }
      if ("secondaryCta" in out) {
        const cta = asObject(out.secondaryCta);
        out.secondaryCta = { ...cta, label: cut(cta.label, 30), action: cta.action === "link" ? "link" : "scroll" };
      }
      return out;
    });
  }
  return s;
}

const REQUIRED_SECTIONS = ["hero", "services", "contact"] as const;

function missingRequiredSections(spec: SiteSpec): string[] {
  const present = new Set(spec.homeSections.map((s) => s.type));
  return REQUIRED_SECTIONS.filter((t) => !present.has(t));
}

function specIssues(spec: SiteSpec): string[] {
  const issues: string[] = [];
  const missing = missingRequiredSections(spec);
  if (missing.length) {
    issues.push(`- homeSections: sections obligatoires manquantes (${missing.join(", ")}). Ajoute hero, services, contact et FAQ.`);
  }

  const hero = spec.homeSections.find((s) => s.type === "hero");
  if (hero && hero.type === "hero") {
    if (hero.style !== "immersive") {
      issues.push('- hero.style: la valeur "immersive" est obligatoire pour cette génération premium.');
    }
    if (!hero.secondaryCta) {
      issues.push("- secondaryCta: obligatoire dans la section hero (libellé + action scroll/link).");
    }
  }

  if (!spec.design) {
    issues.push("- design: obligatoire (styleGuide, hero, motion, paletteMode) ; aucun site legacy ne doit être généré.");
  } else {
    if (spec.design.paletteMode !== "guide") {
      issues.push('- design.paletteMode: "guide" est obligatoire à la génération ; "brand" est réservé aux éditions client explicites.');
    }
    if (!allowedHero(spec.design.styleGuide, spec.design.hero)) {
      const allowed = STYLE_GUIDES[spec.design.styleGuide].allowedHeroes.join(", ");
      issues.push(`- design.hero "${spec.design.hero}" non autorisé pour ${spec.design.styleGuide}. Valeurs autorisées : ${allowed}`);
    }
  }

  return issues;
}

export async function generateSiteSpec(
  sheet: ClientSheet,
  opts?: { llm?: SpecLlmCall; avoid?: string[]; avoidStyles?: string[] },
): Promise<SiteSpec> {
  const llm = opts?.llm ?? defaultLlm;
  const system = buildSystem();
  const user = buildUserPrompt(sheet, opts?.avoid, opts?.avoidStyles);

  const raw = await llm({ system, user, maxTokens: 12000, temperature: 0.7, jsonMode: true });
  if (!raw) throw new Error("[coder] SiteSpec : LLM indisponible (Gemini ou LLM_BASE_URL/LLM_API_KEY non configuré)");

  const result = SiteSpecSchema.safeParse(repairSpecJson(parseSpecJson(raw)));
  const issues = result.success ? specIssues(result.data) : [];
  if (result.success && issues.length === 0) return result.data;

  // === RETRY AUTOMATIQUE avec les erreurs de validation ===
  console.warn("[coder] SiteSpec validation failed, retrying with error context");
  const errorDetails = result.success ? issues.join("\n") : issuesSummary(result.error.issues);

  const fixPrompt = `${user}\n\n---\nLe JSON que tu as généré précédemment contient des erreurs de validation :\n\n${errorDetails}\n\nJSON précédent (invalide) :\n${raw}\n\nCorrige ces erreurs et renvoie le JSON SiteSpec complet et corrigé.\nRAPPEL : JSON uniquement, pas de markdown, pas d'explication.`;

  const retryRaw = await llm({ system, user: fixPrompt, maxTokens: 12000, temperature: 0.3, jsonMode: true });
  if (!retryRaw) throw new Error("[coder] SiteSpec : LLM indisponible au retry de validation");

  const retryResult = SiteSpecSchema.safeParse(repairSpecJson(parseSpecJson(retryRaw)));
  const retryIssues = retryResult.success ? specIssues(retryResult.data) : [];
  if (retryResult.success && retryIssues.length === 0) return retryResult.data;

  const retryError = retryResult.success
    ? retryIssues.join("; ")
    : retryResult.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ");
  throw new Error(`[coder] SiteSpec validation failed after retry: ${retryError}`);
}
