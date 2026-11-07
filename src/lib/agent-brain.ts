// ══════════════════════════════════════════════════════════════
// CERVEAU PARTAGÉ — le LLM omniroute alimente LES 10 AGENTS.
// Chaque agent possède :
//   • une personnalité métier (prompt de base)
//   • des SKILLS injectables (livrées, ajoutées par RIO, ou auto-apprises)
//   • une mémoire d'apprentissages réinjectée à chaque réflexion
//   • la capacité de s'auto-améliorer en analysant son propre journal
// ══════════════════════════════════════════════════════════════

import { db } from "@/db";
import { agentSkills, agentLearnings, aiCalls, activities } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { getSetting } from "./settings";
import { logActivity } from "./activity";
import { llmErrorDetail } from "./llm-error";
import { fetchWithRetry } from "./llm-fetch";

export type AgentKey =
  | "prospector" | "validator" | "emailor" | "mapper" | "coder"
  | "deployer" | "saler" | "paymer" | "domainner" | "support" | "rio";

/* ─────────── Personnalités métier ─────────── */
export const AGENT_MINDS: Record<string, { role: string; mission: string }> = {
  prospector: {
    role: "expert en prospection B2B locale et en requêtes de recherche Google",
    mission: "Trouver les meilleures requêtes et repérer les entreprises locales à fort potentiel qui n'ont pas encore de site web.",
  },
  validator: {
    role: "analyste commercial spécialisé dans la qualification de prospects locaux",
    mission: "Évaluer le potentiel commercial réel d'une fiche Google My Business au-delà des simples seuils chiffrés.",
  },
  emailor: {
    role: "expert en délivrabilité email et en recherche de contacts professionnels",
    mission: "Trouver et valider l'adresse email réellement capable de recevoir l'offre commerciale.",
  },
  mapper: {
    role: "directeur de création et copywriter local senior",
    mission: "Transformer une fiche Google brute en fiche client riche : accroche, description, identité visuelle, ton juste.",
  },
  coder: {
    role: "développeur full-stack senior avec 12 ans d'expérience en sites vitrines haut de gamme",
    mission: "Livrer un site monofichier, live-ready, indiscernable du travail d'un studio humain.",
  },
  deployer: {
    role: "ingénieur DevOps spécialisé en déploiements web et nommage de sous-domaines",
    mission: "Publier chaque site proprement, avec une URL lisible et professionnelle.",
  },
  saler: {
    role: "commercial d'élite spécialisé en prospection froide à très fort taux de réponse",
    mission: "Écrire l'email qui donne envie au patron du commerce de cliquer et de répondre.",
  },
  paymer: {
    role: "responsable de l'encaissement et des relances commerciales",
    mission: "Transformer un prospect intéressé en client payant, avec des relances justes et non agressives.",
  },
  domainner: {
    role: "expert en nommage de domaines et configuration DNS",
    mission: "Proposer et lier le nom de domaine le plus crédible pour le commerce du client.",
  },
  support: {
    role: "responsable support client d'une agence web",
    mission: "Répondre avec précision et chaleur, et traduire les demandes clients en modifications concrètes.",
  },
};

/* ─────────── Skills livrées (semées une fois) ─────────── */
const CORE_SKILLS: Record<string, { title: string; instruction: string }[]> = {
  prospector: [
    { title: "Variantes de requêtes", instruction: "Génère toujours plusieurs formulations locales d'une même niche (synonymes métier, langue locale, quartiers de la ville) pour élargir la couverture sans gaspiller de crédits." },
    { title: "Cibler les sans-site", instruction: "Privilégie les requêtes qui font remonter les petits commerces indépendants, plus susceptibles de ne pas avoir de site web." },
  ],
  validator: [
    { title: "Lecture du potentiel", instruction: "Un commerce avec beaucoup d'avis récents et une note élevée mais aucun site est le profil idéal : il a déjà la preuve sociale, il lui manque juste la vitrine." },
    { title: "Méfiance aux chaînes", instruction: "Écarte les franchises et grandes chaînes : elles ont un service marketing central et ne décident pas localement." },
  ],
  emailor: [
    { title: "Patterns d'adresses", instruction: "Quand aucun email n'est public, déduis les formats les plus probables (contact@, info@, nom-du-commerce@gmail.com) mais ne les valide jamais sans vérification MX." },
  ],
  mapper: [
    { title: "Accroche locale", instruction: "L'accroche doit être spécifique au métier et à la ville, jamais générique. Max 8 mots, sans point d'exclamation." },
    { title: "Ton selon le secteur", instruction: "Luxe = sobriété et élégance ; artisan = franchise et robustesse ; restauration = chaleur et gourmandise." },
  ],
  coder: [
    { title: "Anti-signature IA", instruction: "Jamais de police Poppins/Montserrat, jamais de section « Pourquoi nous choisir », jamais trois icônes Qualité/Rapidité/Confiance. Varie les ombres et les décorations." },
  ],
  deployer: [
    { title: "Slug lisible", instruction: "Le sous-domaine doit rester court, sans accents, reconnaissable par le client (nom du commerce + ville si nécessaire)." },
  ],
  saler: [
    { title: "Objet qui ouvre", instruction: "L'objet doit mentionner le nom du commerce et un bénéfice concret, sans majuscules criardes ni mots déclencheurs de spam (gratuit, promo, urgent)." },
    { title: "Preuve avant promesse", instruction: "Commence par une observation vraie et vérifiable sur le commerce (sa note, ses avis, son absence de site) avant toute proposition." },
  ],
  paymer: [
    { title: "Relance non agressive", instruction: "Rappelle la valeur livrée et laisse une porte de sortie. Jamais plus de deux relances sans réponse." },
  ],
  domainner: [
    { title: "Domaine crédible", instruction: "Préfère nomducommerce-ville.com à des variantes exotiques. Évite les tirets multiples et les chiffres." },
  ],
  support: [
    { title: "Accuser puis agir", instruction: "Toujours reformuler la demande du client en une phrase avant d'annoncer l'action et le délai." },
  ],
};

let skillsSeeded = false;
export async function ensureCoreSkills() {
  if (skillsSeeded) return;
  for (const [agentKey, list] of Object.entries(CORE_SKILLS)) {
    for (const s of list) {
      const exists = await db
        .select({ id: agentSkills.id })
        .from(agentSkills)
        .where(and(eq(agentSkills.agentKey, agentKey), eq(agentSkills.title, s.title)))
        .limit(1);
      if (exists.length === 0) {
        await db.insert(agentSkills).values({ agentKey, title: s.title, instruction: s.instruction, source: "core" });
      }
    }
  }
  skillsSeeded = true;
}

/* ─────────── Accès LLM commun ─────────── */
export async function brainOnline(): Promise<boolean> {
  return Boolean((await getSetting("LLM_BASE_URL")) && (await getSetting("LLM_API_KEY")));
}

async function buildContext(agentKey: string): Promise<string> {
  const [skills, learnings] = await Promise.all([
    db.select().from(agentSkills).where(and(eq(agentSkills.agentKey, agentKey), eq(agentSkills.active, true))).limit(14),
    db.select().from(agentLearnings).where(eq(agentLearnings.agentKey, agentKey)).orderBy(desc(agentLearnings.createdAt)).limit(6),
  ]);
  let ctx = "";
  if (skills.length) {
    ctx += `\n\nTES COMPÉTENCES ACTIVES :\n${skills.map((s) => `• ${s.title} — ${s.instruction}`).join("\n")}`;
    // Compteur d'usage : non bloquant (une seule requête batch) — ne retarde
    // jamais le réflexion LLM, et un échec est sans conséquence.
    void db.update(agentSkills)
      .set({ useCount: sql`${agentSkills.useCount} + 1` })
      .where(and(eq(agentSkills.agentKey, agentKey), eq(agentSkills.active, true)))
      .catch(() => {});
  }
  if (learnings.length) {
    ctx += `\n\nCE QUE TU AS APPRIS DE TES MISSIONS PRÉCÉDENTES :\n${learnings.map((l) => `• ${l.insight}`).join("\n")}`;
  }
  return ctx;
}

async function trackCall(agentKey: string, task: string, ok: boolean, latencyMs: number, tokens: number) {
  try {
    await db.insert(aiCalls).values({ agentKey, task, ok, latencyMs, tokens });
  } catch { /* noop */ }
}

/**
 * Réflexion d'un agent. Retourne du texte brut, ou null si le cerveau est hors-ligne.
 */
export async function agentThink(params: {
  agent: string;
  task: string;
  instruction: string;
  input: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Force la langue de la réponse (défaut: français). */
  lang?: "fr" | "en";
}): Promise<string | null> {
  if (!(await brainOnline())) return null;
  await ensureCoreSkills();

  const mind = AGENT_MINDS[params.agent] ?? { role: "agent spécialisé", mission: "Accomplir sa tâche avec rigueur." };
  const context = await buildContext(params.agent);
  const writingLang = params.lang === "en" ? "EN ANGLAIS" : "en français";
  const system = `Tu es ${params.agent.toUpperCase()}, ${mind.role}, agent autonome de l'agence GoSite Digital.
MISSION : ${mind.mission}
Tu réponds toujours ${writingLang}, de façon concise et directement exploitable.${context}${
    params.json
      ? `

FORMAT DE SORTIE IMPÉRATIF :
- Ta réponse commence par { et se termine par }.
- Rien avant, rien après : pas de phrase d'introduction, pas de balises markdown, pas de \`\`\`.
- Toutes les valeurs textuelles sont rédigées ${writingLang.toUpperCase()} : AUCUN mot d'une autre langue (pas de mélange fr/en).
- JSON strict : guillemets doubles, pas de virgule finale, pas de commentaire.`
      : ""
  }`;

  const baseUrl = (await getSetting("LLM_BASE_URL")).replace(/\/+$/, "");
  const apiKey = await getSetting("LLM_API_KEY");
  const model = (await getSetting("LLM_MODEL")) || "gpt-4o-mini";
  const t0 = Date.now();

  try {
    const res = await fetchWithRetry(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: `${params.instruction}\n\nDONNÉES :\n${params.input}` },
          ],
          temperature: params.temperature ?? 0.5,
          // Modèle de raisonnement : le raisonnement consomme le budget AVANT
          // le contenu — 900 tokens donnait un content vide (agents muets).
          max_tokens: params.json ? Math.max(params.maxTokens ?? 2500, 2000) : (params.maxTokens ?? 2500),
          // NOTE : volontairement pas de `response_format` — certains routeurs
          // (dont omniroute) corrompent la sortie avec ce paramètre.
        }),
      },
      { timeoutMs: 90000, retries: 1, delayMs: 800 }
    );
    if (!res.ok) {
      await trackCall(params.agent, params.task, false, Date.now() - t0, 0);
      const detail = llmErrorDetail(res.status, await res.text().catch(() => ""));
      try { await logActivity({ agentKey: params.agent, action: "llm_echec", message: `Appel LLM échoué — ${detail}`, level: "warn" }); } catch { /* non bloquant */ }
      return null;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { total_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content ?? null;
    await trackCall(params.agent, params.task, Boolean(content), Date.now() - t0, json.usage?.total_tokens ?? 0);
    return content;
  } catch (err) {
    await trackCall(params.agent, params.task, false, Date.now() - t0, 0);
    const msg = err instanceof Error ? err.message : "erreur réseau";
    const code = err instanceof Error && err.cause && typeof err.cause === "object" && "code" in err.cause ? String((err.cause as { code?: string }).code) : "";
    try { await logActivity({ agentKey: params.agent, action: "llm_echec", message: `LLM injoignable — ${msg}${code ? ` (${code})` : ""}`, level: "warn" }); } catch { /* non bloquant */ }
    return null;
  }
}

/**
 * Extraction JSON tolérante — les routeurs LLM renvoient parfois du JSON
 * préfixé, entouré de prose, ou tronqué par la limite de tokens.
 */
export function parseLooseJson<T>(raw: string): T | null {
  let s = raw.trim();

  // 1) Retire les clôtures markdown
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/i);
  if (fence) s = fence[1].trim();

  // 2) Corrige le préfixe parasite `{"` suivi d'un vrai objet (bug omniroute)
  s = s.replace(/^\{\s*"\s*(?=\{)/, "");

  // 3) Se positionne sur la première accolade ouvrante
  const start = s.indexOf("{");
  if (start === -1) return null;
  s = s.slice(start);

  // 4) Scan équilibré (objets ET tableaux) : isole la valeur complète
  const stack: string[] = [];
  let inStr = false, escaped = false, endIdx = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === "\\") { escaped = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") {
      stack.pop();
      if (stack.length === 0) { endIdx = i; break; }
    }
  }

  const candidates: string[] = [];
  if (endIdx !== -1) candidates.push(s.slice(0, endIdx + 1));

  // 5) Réparation d'une sortie tronquée : ferme la chaîne puis toutes
  //    les structures ouvertes, dans le bon ordre (] ou } selon la pile).
  if (stack.length > 0) {
    let repaired = s;
    if (inStr) repaired += '"';
    repaired = repaired.replace(/,\s*$/, "");
    // Supprime une paire clé/valeur incomplète en fin de flux
    repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*$/, "");
    for (let i = stack.length - 1; i >= 0; i--) {
      repaired += stack[i] === "{" ? "}" : "]";
    }
    candidates.push(repaired);
  }
  candidates.push(s);

  for (const c of candidates) {
    try { return JSON.parse(c) as T; } catch { /* candidat suivant */ }
    try { return JSON.parse(c.replace(/,(\s*[}\]])/g, "$1")) as T; } catch { /* candidat suivant */ }
  }
  return null;
}

/** Réflexion avec sortie JSON typée + repli silencieux. */
export async function agentThinkJson<T>(params: {
  agent: string;
  task: string;
  instruction: string;
  input: string;
  maxTokens?: number;
  temperature?: number;
  /** Force la langue des valeurs texte de la sortie (défaut: français). */
  lang?: "fr" | "en";
}): Promise<T | null> {
  const raw = await agentThink({ ...params, json: true, lang: params.lang });
  if (!raw) return null;
  const parsed = parseLooseJson<T>(raw);
  if (!parsed) {
    await trackCall(params.agent, `${params.task}:parse_error`, false, 0, 0);
  }
  return parsed;
}

/* ─────────── Auto-apprentissage ─────────── */

export async function recordLearning(agentKey: string, insight: string, kind: "observation" | "fix" | "strategy" = "observation", confidence = 65) {
  const existing = await db
    .select({ id: agentLearnings.id })
    .from(agentLearnings)
    .where(and(eq(agentLearnings.agentKey, agentKey), eq(agentLearnings.insight, insight)))
    .limit(1);
  if (existing.length) return;
  await db.insert(agentLearnings).values({ agentKey, insight, kind, confidence });
}

/**
 * ÉVOLUTION — l'agent analyse son propre journal (succès et échecs),
 * en tire des leçons et se crée de nouvelles compétences.
 */
export async function evolveAgent(agentKey: string): Promise<{ ok: boolean; summary: string; skills: string[]; learnings: string[] }> {
  await ensureCoreSkills();
  if (!(await brainOnline())) {
    return { ok: false, summary: "Cerveau LLM hors-ligne — configurez omniroute dans Réglages pour permettre l'auto-amélioration.", skills: [], learnings: [] };
  }

  const recent = await db
    .select()
    .from(activities)
    .where(eq(activities.agentKey, agentKey))
    .orderBy(desc(activities.createdAt))
    .limit(40);

  if (recent.length < 3) {
    return { ok: false, summary: "Pas encore assez d'expérience pour évoluer (minimum 3 missions journalisées).", skills: [], learnings: [] };
  }

  const existingSkills = await db.select().from(agentSkills).where(eq(agentSkills.agentKey, agentKey));
  const successes = recent.filter((a) => a.level === "success").length;
  const failures = recent.filter((a) => a.level === "error" || a.level === "warn");

  const result = await agentThinkJson<{ learnings: string[]; new_skills: { title: string; instruction: string }[]; diagnosis: string }>({
    agent: agentKey,
    task: "auto_evolution",
    instruction: `Analyse ton propre journal d'activité et auto-améliore-toi.
1) Identifie les schémas récurrents : qu'est-ce qui fonctionne, qu'est-ce qui échoue et pourquoi.
2) Formule 1 à 3 apprentissages concrets et actionnables (pas de généralités).
3) Propose 1 à 2 NOUVELLES compétences qui n'existent pas déjà dans ta liste, formulées comme des consignes opérationnelles directement applicables à ta prochaine mission.
Réponds en JSON : {"diagnosis": string, "learnings": string[], "new_skills": [{"title": string, "instruction": string}]}`,
    input: `COMPÉTENCES EXISTANTES : ${existingSkills.map((s) => s.title).join(" | ") || "aucune"}
STATISTIQUES : ${successes} succès, ${failures.length} incidents sur ${recent.length} événements.
JOURNAL RÉCENT :
${recent.map((a) => `[${a.level}] ${a.action} — ${a.message}`).join("\n").slice(0, 3500)}`,
    maxTokens: 3000,
    temperature: 0.6,
  });

  if (!result) {
    return { ok: false, summary: "L'analyse n'a pas abouti (réponse LLM illisible).", skills: [], learnings: [] };
  }

  const addedSkills: string[] = [];
  for (const s of (result.new_skills ?? []).slice(0, 2)) {
    if (!s?.title || !s?.instruction) continue;
    const dup = existingSkills.some((e) => e.title.toLowerCase() === s.title.toLowerCase());
    if (dup) continue;
    await db.insert(agentSkills).values({ agentKey, title: s.title.slice(0, 80), instruction: s.instruction.slice(0, 600), source: "learned" });
    addedSkills.push(s.title);
  }
  const addedLearnings: string[] = [];
  for (const l of (result.learnings ?? []).slice(0, 3)) {
    if (typeof l !== "string" || l.length < 10) continue;
    await recordLearning(agentKey, l.slice(0, 500), "strategy", 70);
    addedLearnings.push(l);
  }

  const summary = `${addedSkills.length} nouvelle(s) compétence(s), ${addedLearnings.length} apprentissage(s). ${result.diagnosis ?? ""}`.trim();
  await logActivity({
    agentKey,
    action: "auto_evolution",
    message: `Auto-amélioration : ${summary}`.slice(0, 400),
    level: "success",
  });

  return { ok: true, summary, skills: addedSkills, learnings: addedLearnings };
}

/* ─────────── Statistiques IA par agent ─────────── */
export async function aiStatsFor(agentKey: string) {
  const rows = await db.select().from(aiCalls).where(eq(aiCalls.agentKey, agentKey)).orderBy(desc(aiCalls.createdAt)).limit(200);
  const ok = rows.filter((r) => r.ok).length;
  return {
    calls: rows.length,
    ok,
    avgLatency: rows.length ? Math.round(rows.reduce((a, r) => a + r.latencyMs, 0) / rows.length) : 0,
    tokens: rows.reduce((a, r) => a + r.tokens, 0),
  };
}
