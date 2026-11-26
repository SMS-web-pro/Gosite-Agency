// Phase 10 (spec 3.1) — boucle d'édition Support : la demande du client est
// traduite par le LLM en un SiteSpec complet corrigé, re-validé par Zod.
// Le rendu et le déploiement restent à l'appelant (inbound-process) : ici on
// ne touche jamais au HTML à la main.

import { SiteSpecSchema, type SiteSpec } from "../site-engine/site-spec.schema";
import type { SpecLlmCall } from "../site-engine/generate-spec";
import { geminiCompleteStep } from "./gemini";
import { parseLooseJson } from "./agent-brain";

export type SiteEditResult = { updated: boolean; spec: SiteSpec; summary: string };

export type SiteEditOpts = { llm?: SpecLlmCall; timeoutMs?: number; deadlineMs?: number };

const SYSTEM = `Tu es l'éditeur de sites de GoSite Digital. Un client demande une modification de SON site déjà en ligne.
Tu reçois le SiteSpec JSON complet (source de vérité du rendu) et la demande du client.

RÈGLES ABSOLUES :
- Modifie UNIQUEMENT ce que le client demande explicitement (téléphone, email, adresse, horaires, texte, service, FAQ, palette…).
- Renvoie le SiteSpec COMPLET et VALIDE (mêmes clés, mêmes bornes), pas un fragment.
- Conserve la langue du site (lang) et le businessModel existants.
- Conserve design et design.paletteMode tels quels, sauf demande visuelle explicite.
  Ne supprime JAMAIS design ; une édition de texte ne change ni styleGuide, ni hero, ni motion.
- Si le client demande explicitement une couleur/palette, mets design.paletteMode:"brand"
  et applique la palette demandée ; sinon ne touche pas au design.
- N'invente AUCUNE donnée factuelle (chiffre, avis, garantie, prix) absente de la demande.
- Si la demande n'est pas une modification de site (question, remerciement, négociation), mets "updated": false et renvoie le spec inchangé.
- Si la demande exige une information manquante, mets "updated": false et explique dans "summary".

Réponds UNIQUEMENT en JSON :
{"updated": boolean, "summary": "une phrase décrivant le changement", "spec": <SiteSpec complet>}`;

export async function editSiteSpec(
  current: SiteSpec,
  request: string,
  opts?: SiteEditOpts
): Promise<SiteEditResult> {
  const req = (request ?? "").trim().slice(0, 500);
  if (!req) return { updated: false, spec: current, summary: "" };

  const llm: SpecLlmCall =
    opts?.llm ??
    ((p) =>
      geminiCompleteStep({
        system: p.system,
        user: p.user,
        maxTokens: p.maxTokens,
        temperature: p.temperature,
        jsonMode: p.jsonMode,
        timeoutMs: opts?.timeoutMs ?? 40_000,
        deadlineMs: opts?.deadlineMs ?? 48_000,
      }));

  const baseUser = `SITESPEC ACTUEL :\n${JSON.stringify(current)}\n\nDEMANDE DU CLIENT :\n${req}`;
  const raw = await llm({ system: SYSTEM, user: baseUser, maxTokens: 12_000, temperature: 0.2, jsonMode: true });
  if (!raw) throw new Error("[support] édition du site : LLM indisponible");

  const paletteChanged = (a: SiteSpec["palette"], b: SiteSpec["palette"]): boolean =>
    a.primary !== b.primary ||
    a.accent !== b.accent ||
    a.neutralBg !== b.neutralBg ||
    a.textDark !== b.textDark ||
    a.textLight !== b.textLight;

  const withDesign = (s: SiteSpec): SiteSpec => {
    const next = current.design && !s.design ? { ...s, design: current.design } : s;
    if (!current.design || !next.design || next.design.paletteMode === "brand") return next;
    if (!paletteChanged(current.palette, next.palette)) return next;
    return { ...next, design: { ...next.design, paletteMode: "brand" } };
  };

  const parse = (text: string): { parsed: Record<string, unknown> | null; spec: SiteSpec | null } => {
    const parsed = parseLooseJson<Record<string, unknown>>(text);
    const updated = parsed?.updated !== false;
    const candidate = parsed?.spec ?? (updated ? undefined : current);
    const validated = SiteSpecSchema.safeParse(candidate);
    return { parsed, spec: validated.success ? withDesign(validated.data) : null };
  };

  let { parsed, spec } = parse(raw);
  if (!spec) {
    const issues = (() => {
      const r = SiteSpecSchema.safeParse(parseLooseJson<Record<string, unknown>>(raw)?.spec);
      return r.success
        ? ""
        : r.error.issues
            .slice(0, 15)
            .map((i) => `- ${i.path.join(".")}: ${i.message}`)
            .join("\n");
    })();
    const retry = await llm({
      system: SYSTEM,
      user: `${baseUser}\n\n---\nJSON précédent invalide :\n${raw}\n\nErreurs de validation :\n${issues || "spec absent"}\n\nCorrige et renvoie le JSON complet.`,
      maxTokens: 12_000,
      temperature: 0.1,
      jsonMode: true,
    });
    if (!retry) throw new Error("[support] édition du site : LLM indisponible au retry");
    ({ parsed, spec } = parse(retry));
    if (!spec) throw new Error("[support] édition du site : SiteSpec invalide après retry");
  }

  return {
    updated: parsed?.updated !== false,
    spec,
    summary: typeof parsed?.summary === "string" ? parsed.summary.trim().slice(0, 300) : "",
  };
}
