// Couche 1 (spec refonte 2.2) — génération du SiteSpec par le LLM
// « directeur artistique ». Le LLM produit un JSON validé par Zod ; en cas
// d'échec, un retry lui est proposé avec la fiche, le JSON fautif et les
// erreurs de validation (un appel LLM est sans mémoire : sans ces rappels,
// il ne peut pas corriger ce qu'il n'a pas sous les yeux).

import { z } from "zod";
import { SiteSpecSchema, type SiteSpec } from "./site-spec.schema";
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
- Les pages légales doivent correspondre au pays du business (pas de références US pour le Maroc)
- Le ton doit correspondre à la niche (luxe pour spa, énergique pour gym, rassurant pour médecin)

DESIGN :
- Choisis le style de hero le plus adapté à la niche :
  - "split" → services visuels (restaurant, gym, spa)
  - "centered" → professionnels, corporate
  - "fullwidth-bg" → immobilier, hôtellerie, événementiel
  - "minimal" → cabinets, avocats, tech
- Choisis la typographie la plus adaptée :
  - luxe/spa → "playfair+source"
  - sport/gym → "rubik+karla"
  - artisanal/boulangerie → "lora+nunito"
  - tech/startup → "inter+cabinet"
  - corporate → "montserrat+opensans"
  - friendly/accessible → "poppins+inter"
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

function buildUserPrompt(sheet: ClientSheet, avoid: string[] = []): string {
  const antiClone = avoid.length
    ? `\n\nCONTENU DÉJÀ PUBLIÉ — INTERDIT DE RÉUTILISER (même formulation) :\n${avoid
        .slice(0, 120)
        .map((s) => `- ${s}`)
        .join("\n")}\nÉcris des accroches, une metaTitle et des questions FAQ inédites pour CE client.`
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

Génère le SiteSpec JSON complet pour ce client.${antiClone}`.trim();
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

export async function generateSiteSpec(sheet: ClientSheet, opts?: { llm?: SpecLlmCall; avoid?: string[] }): Promise<SiteSpec> {
  const llm = opts?.llm ?? defaultLlm;
  const system = buildSystem();
  const user = buildUserPrompt(sheet, opts?.avoid);

  const raw = await llm({ system, user, maxTokens: 12000, temperature: 0.7, jsonMode: true });
  if (!raw) throw new Error("[coder] SiteSpec : LLM indisponible (Gemini non configuré ou en échec)");

  const result = SiteSpecSchema.safeParse(parseSpecJson(raw));
  if (result.success) return result.data;

  // === RETRY AUTOMATIQUE avec les erreurs Zod ===
  console.warn("[coder] SiteSpec validation failed, retrying with error context");
  const errorDetails = issuesSummary(result.error.issues);

  const fixPrompt = `${user}\n\n---\nLe JSON que tu as généré précédemment contient des erreurs de validation :\n\n${errorDetails}\n\nJSON précédent (invalide) :\n${raw}\n\nCorrige ces erreurs et renvoie le JSON SiteSpec complet et corrigé.\nRAPPEL : JSON uniquement, pas de markdown, pas d'explication.`;

  const retryRaw = await llm({ system, user: fixPrompt, maxTokens: 12000, temperature: 0.3, jsonMode: true });
  if (!retryRaw) throw new Error("[coder] SiteSpec : LLM indisponible au retry de validation");

  const retryResult = SiteSpecSchema.safeParse(parseSpecJson(retryRaw));
  if (retryResult.success) return retryResult.data;

  throw new Error(
    `[coder] SiteSpec validation failed after retry: ${retryResult.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`,
  );
}
