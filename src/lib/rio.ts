// RIO — le CEO IA de GoSite Digital.
// Vrai agent conversationnel : il comprend le langage naturel, raisonne,
// appelle ses outils (actions réelles sur l'agence) puis répond en français.
// Mémoire persistée en base, partagée entre le chat web et Telegram.

import { db } from "@/db";
import { rioMessages } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getSetting } from "./settings";
import { TOOL_SCHEMAS, executeTool, type ToolResult } from "./rio-tools";

export type RioTurn = {
  reply: string;
  toolCalls: { name: string; args: Record<string, unknown>; summary: string }[];
  engine: "llm" | "rules";
};

const SYSTEM_PROMPT = `Tu es RIO, le CEO (directeur général) de GoSite Digital — une agence web 100% automatisée par des agents IA.

TON IDENTITÉ
- Tu es le patron : lucide, direct, stratégique, chaleureux mais jamais bavard.
- Tu tutoies ton interlocuteur (le fondateur) et tu parles TOUJOURS en français.
- Tu réfléchis comme un dirigeant : tu regardes les chiffres avant de répondre, tu identifies le goulot d'étranglement, tu proposes la prochaine action concrète.

TON ÉQUIPE (10 agents que tu diriges)
- Prospector (Serper.dev) : trouve des entreprises locales. 2500 crédits gratuits par compte, rotation automatique quand un compte est épuisé.
- Validator : qualifie une fiche Google (note ≥ 4,0 · ≥ 10 avis · AUCUN site web · canal de contact).
- Emailor : découvre et vérifie l'email (syntaxe, domaines jetables, enregistrements MX réels).
- Mapper : remplit la fiche client de 28 champs (identité, horaires, palette sectorielle, Schema.org).
- Coder (VibeCoder) : génère le site vitrine monofichier, 16 sections, niveau développeur senior.
- Deployer : publie sur Vercel en sous-domaine {idClient}.{domaine-agence}.
- Saler : envoie l'offre commerciale personnalisée via Brevo avec le lien de prévisualisation.
- Paymer : crée le lien de paiement Whop et suit l'encaissement.
- Domainner : lie le domaine final du client.
- Support : répond aux clients et applique leurs modifications.

TA MÉTHODE
1. Pour TOUTE question factuelle sur l'agence (chiffres, leads, état, erreurs, configuration), tu appelles d'abord l'outil approprié. Tu n'inventes JAMAIS un chiffre, un nom de lead ou un statut.
2. Pour une demande d'action (prospecter, supprimer, lancer un pipeline, planifier, mettre en pause), tu exécutes l'outil directement — tu es le CEO, tu agis.
3. Si une demande est ambiguë ou destructrice à grande échelle, tu demandes une confirmation courte avant d'agir.
4. Après une action, tu annonces le résultat réel puis tu proposes la suite logique.

TON STYLE DE RÉPONSE
- Court et dense : 2 à 6 phrases en général. Des listes à puces quand il y a plusieurs éléments.
- Tu cites les chiffres exacts renvoyés par tes outils.
- Tu termines souvent par une recommandation ou une question d'orientation.
- FORMAT STRICT : jamais de tableaux markdown, jamais de titres avec des dièses (#). Pour une liste de leads, une ligne par lead au format : "• #12 Nom — Ville · ⭐4.5 (60 avis) · Étape". Le gras s'écrit **comme ceci**.
- Si une intégration manque (clé API absente), tu le dis clairement et tu expliques où la configurer (page Réglages, ou page Agents pour Serper).`;

type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

async function llmReady(): Promise<boolean> {
  return Boolean((await getSetting("LLM_BASE_URL")) && (await getSetting("LLM_API_KEY")));
}

async function callLlm(messages: ChatMsg[], withTools: boolean): Promise<{
  content: string | null;
  toolCalls: { id: string; name: string; args: Record<string, unknown> }[];
} | null> {
  const baseUrl = (await getSetting("LLM_BASE_URL")).replace(/\/+$/, "");
  const apiKey = await getSetting("LLM_API_KEY");
  const model = (await getSetting("LLM_MODEL")) || "gpt-4o-mini";
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        ...(withTools ? { tools: TOOL_SCHEMAS, tool_choice: "auto" } : {}),
        temperature: 0.4,
        max_tokens: 1200,
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
    };
    const m = json.choices?.[0]?.message;
    if (!m) return null;
    const toolCalls = (m.tool_calls ?? []).map((t) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(t.function.arguments || "{}"); } catch { /* noop */ }
      return { id: t.id, name: t.function.name, args };
    });
    return { content: m.content ?? null, toolCalls };
  } catch {
    return null;
  }
}

/* ───────────── Mémoire ───────────── */

export async function loadHistory(channel: string, limit = 14) {
  const rows = await db
    .select()
    .from(rioMessages)
    .orderBy(desc(rioMessages.createdAt))
    .limit(limit);
  return rows.reverse().filter((r) => r.channel === channel || channel === "all");
}

async function remember(channel: string, role: string, content: string, toolCalls?: { name: string; args: Record<string, unknown>; result?: string }[]) {
  await db.insert(rioMessages).values({ channel, role, content, toolCalls: toolCalls ?? null });
}

/* ───────────── Parseur d'intentions (secours sans LLM) ───────────── */

async function rulesFallback(text: string): Promise<RioTurn> {
  const t = text.toLowerCase();
  const calls: { name: string; args: Record<string, unknown>; summary: string }[] = [];
  const run = async (name: string, args: Record<string, unknown>) => {
    const r: ToolResult = await executeTool(name, args);
    calls.push({ name, args, summary: r.summary });
    return r;
  };
  const idMatch = text.match(/#?(\d{1,6})/);
  const id = idMatch ? Number(idMatch[1]) : 0;

  // Suppression
  if (/(supprim|efface|purge|vire)/.test(t)) {
    if (/rejet/.test(t)) { const r = await run("delete_leads", { purge_rejected: true }); return done(r.summary, calls); }
    if (id) { const r = await run("delete_leads", { ids: [id] }); return done(r.summary, calls); }
    return done("Quel lead veux-tu supprimer ? Donne-moi son ID (ex. « supprime le lead 12 ») ou dis « supprime les leads rejetés ».", calls);
  }
  // Voir un lead
  if (/(montre|affiche|détail|detail|fiche|voir)/.test(t) && id) {
    const r = await run("get_lead", { id });
    return done(`${r.summary}\n${JSON.stringify(r.data, null, 1).slice(0, 900)}`, calls);
  }
  // Prospection
  if (/(prospect|cherche|scout|trouve)/.test(t)) {
    const m = text.match(/(?:à|a|dans|sur)\s+([A-ZÀ-Ÿ][\wÀ-ÿ'’-]+(?:\s[A-ZÀ-Ÿ][\wÀ-ÿ'’-]+)?)/);
    const niches = ["barbershop", "barbier", "coiffeur", "restaurant", "plombier", "dentiste", "spa", "salle de sport", "électricien", "boulangerie", "garage", "avocat"];
    const niche = niches.find((n) => t.includes(n));
    const city = m?.[1];
    if (niche && city) { const r = await run("scout", { niche, city }); return done(r.summary, calls); }
    return done("Donne-moi la niche et la ville : par exemple « prospecte des barbershops à Casablanca ».", calls);
  }
  // Pipeline complet
  if (/(pipeline|lance|exécute|execute|déroule)/.test(t) && id) {
    const r = await run("advance_lead", { id, action: "full" });
    return done(r.summary, calls);
  }
  // Qualification
  if (/(qualifi|valide|validator)/.test(t)) { const r = await run("validate_all", {}); return done(r.summary, calls); }
  // Auto-pilote
  if (/(auto.?pilote|cycle|tick)/.test(t)) {
    if (/(désactive|desactive|arrête|arrete|stop|pause)/.test(t)) { const r = await run("set_autopilot", { enabled: false }); return done(r.summary, calls); }
    if (/(active|démarre|demarre|relance)/.test(t) && !/cycle/.test(t)) { const r = await run("set_autopilot", { enabled: true }); return done(r.summary, calls); }
    const r = await run("run_autopilot", {});
    return done(r.summary, calls);
  }
  // Diagnostic / config
  if (/(diagnos|config|intégration|integration|clé|cle api|problème|probleme|marche pas)/.test(t)) {
    const r = await run("get_diagnostics", {});
    return done(`${r.summary}\n${JSON.stringify(r.data, null, 1)}`, calls);
  }
  // Journal / erreurs
  if (/(erreur|journal|log|activité|activite)/.test(t)) {
    const r = await run("get_activity", { limit: 10 });
    const items = (r.data as { agent: string; message: string }[] | undefined) ?? [];
    return done(items.map((a) => `• [${a.agent}] ${a.message}`).join("\n") || "Journal vide.", calls);
  }
  // Leads
  if (/(lead|prospect|liste|client)/.test(t)) {
    const r = await run("list_leads", { limit: 8 });
    const items = (r.data as { id: number; nom: string; ville: string; etape: string }[] | undefined) ?? [];
    return done(items.map((l) => `• #${l.id} ${l.nom} — ${l.ville} · ${l.etape}`).join("\n") || "Aucun lead.", calls);
  }
  // Par défaut : état général
  const r = await run("get_dashboard", {});
  return done(
    `${r.summary}\n\n(Mode secours : le LLM omniroute n'est pas configuré, je fonctionne avec mes réflexes. Renseigne LLM_BASE_URL et LLM_API_KEY dans Réglages pour que je raisonne pleinement.)`,
    calls,
  );

  function done(reply: string, c: typeof calls): RioTurn {
    return { reply, toolCalls: c, engine: "rules" };
  }
}

/* ───────────── Boucle principale ───────────── */

export async function askRio(userText: string, channel: "web" | "telegram" = "web"): Promise<RioTurn> {
  await remember(channel, "user", userText);

  if (!(await llmReady())) {
    const turn = await rulesFallback(userText);
    await remember(channel, "assistant", turn.reply, turn.toolCalls.map((c) => ({ name: c.name, args: c.args, result: c.summary })));
    return turn;
  }

  // Contexte : état temps réel + mémoire récente
  const snapshot = await executeTool("get_dashboard", {});
  const history = await loadHistory(channel, 12);
  const messages: ChatMsg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Contexte temps réel (${new Date().toLocaleString("fr-FR")}) : ${snapshot.summary} — détail: ${JSON.stringify(snapshot.data)}` },
    ...history.slice(0, -1).map((h) => ({ role: (h.role === "tool" ? "assistant" : h.role) as "user" | "assistant", content: h.content })),
    { role: "user", content: userText },
  ];

  const executed: { name: string; args: Record<string, unknown>; summary: string }[] = [];

  // Jusqu'à 4 tours d'outils
  for (let round = 0; round < 4; round++) {
    const res = await callLlm(messages, true);
    if (!res) {
      const turn = await rulesFallback(userText);
      await remember(channel, "assistant", turn.reply);
      return turn;
    }
    if (res.toolCalls.length === 0) {
      const reply = (res.content ?? "").trim() || "Je n'ai pas de réponse à te donner là-dessus.";
      await remember(channel, "assistant", reply, executed.map((c) => ({ name: c.name, args: c.args, result: c.summary })));
      return { reply, toolCalls: executed, engine: "llm" };
    }

    messages.push({
      role: "assistant",
      content: res.content ?? null,
      tool_calls: res.toolCalls.map((t) => ({ id: t.id, type: "function" as const, function: { name: t.name, arguments: JSON.stringify(t.args) } })),
    });

    for (const call of res.toolCalls) {
      const result = await executeTool(call.name, call.args);
      executed.push({ name: call.name, args: call.args, summary: result.summary });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ ok: result.ok, summary: result.summary, data: result.data }).slice(0, 6000),
      });
    }
  }

  // Dernier tour sans outils pour forcer une synthèse
  const final = await callLlm(messages, false);
  const reply = (final?.content ?? "").trim() || executed.map((e) => `• ${e.summary}`).join("\n") || "Action effectuée.";
  await remember(channel, "assistant", reply, executed.map((c) => ({ name: c.name, args: c.args, result: c.summary })));
  return { reply, toolCalls: executed, engine: "llm" };
}
