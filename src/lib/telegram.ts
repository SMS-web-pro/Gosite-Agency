import { getSetting } from "./settings";
import { db } from "@/db";
import { prospects, agents, activities } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { logActivity } from "./activity";
import {
  buildHealthReport,
  planRepair,
  probeWebhook,
  type ProbeKind,
  type ProbeResult,
} from "./telegram-health";

export async function telegramConfigured(): Promise<boolean> {
  const token = await getSetting("TELEGRAM_BOT_TOKEN");
  const chatId = await getSetting("TELEGRAM_CHAT_ID");
  return Boolean(token && chatId);
}

export async function sendTelegram(text: string, chatId?: string): Promise<{ ok: boolean; error?: string }> {
  const token = await getSetting("TELEGRAM_BOT_TOKEN");
  const target = chatId ?? (await getSetting("TELEGRAM_CHAT_ID"));
  if (!token || !target) return { ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID non configurés" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: target,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, error: json.description ?? "Telegram error" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

// Silent notify — only if configured, never throws
export async function notifyTelegram(text: string): Promise<void> {
  try {
    if (!(await telegramConfigured())) return;
    await sendTelegram(text);
  } catch {
    /* noop */
  }
}

// ─────────────────────────────────────────────
// WEBHOOK AUTO-REGISTRATION & DIAGNOSTICS
// ─────────────────────────────────────────────
export type WebhookInfo = {
  url: string;
  hasCustomCertificate?: boolean;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  max_connections?: number;
};

export async function getTelegramWebhookInfo(): Promise<{ ok: boolean; info?: WebhookInfo; error?: string }> {
  const token = await getSetting("TELEGRAM_BOT_TOKEN");
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN manquant" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, { signal: AbortSignal.timeout(12000) });
    const json = await res.json();
    if (!json.ok) return { ok: false, error: json.description ?? "Token invalide ?" };
    return { ok: true, info: json.result as WebhookInfo };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network" };
  }
}

export async function registerTelegramWebhook(baseUrl: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const token = await getSetting("TELEGRAM_BOT_TOKEN");
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN manquant — ajoutez-le dans Réglages" };
  const { setSetting } = await import("./settings");
  // Secret de vérification des appels entrants
  let secret = await getSetting("TELEGRAM_WEBHOOK_SECRET");
  if (!secret) {
    secret = `gsd-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    await setSetting("TELEGRAM_WEBHOOK_SECRET", secret);
  }
  const base = baseUrl.replace(/\/+$/, "");
  const url = `${base}/api/telegram/webhook`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"], max_connections: 40 }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json();
    if (!json.ok) return { ok: false, error: json.description ?? `HTTP ${res.status}` };
    const { logActivity } = await import("./activity");
    await logActivity({
      agentKey: "telegram", action: "webhook_enregistre",
      message: `Webhook Telegram enregistré automatiquement → ${url}`, level: "success",
    });
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network" };
  }
}

// ─────────────────────────────────────────────
// SANTÉ DU CANAL ENTRANT — sonde + auto-réparation
//
// Une panne « plateforme » (compte Vercel bloqué → 402, protection d'accès →
// 401, alias mort → 404) n'est pas corrigeable en code : il faut la détecter,
// la distinguer d'une vieille erreur Telegram, et alerter. Telegram, lui, ne
// garde que sa DERNIÈRE erreur : un 402 vieux de 48 h reste affiché pour
// toujours tant qu'aucune livraison n'a réussi.
// ─────────────────────────────────────────────

export type TelegramHealth = {
  healthy: boolean;
  activeUrl: string;
  registeredUrl: string;
  expectedUrl: string;
  urlMatches: boolean;
  pendingUpdateCount: number;
  staleTelegramError: boolean;
  telegramError: string | null;
  telegramErrorDate: number | null;
  telegramErrorAgeHours: number | null;
  repaired: boolean;
  repairedUrl: string | null;
  kind: ProbeKind;
  detail: string;
  checkedAt: string;
  probes: ProbeResult[];
};

const WEBHOOK_PATH = "/api/telegram/webhook";

// Le dashboard interroge /api/diagnostics toutes les 30 s : sonder l'endpoint
// public à chaque fois déclencherait une invocation serveur de plus à chaque
// poll. Cache court (2 min) — la détection d'une panne reste quasi immédiate.
const PROBE_TTL_MS = 120_000;
const probeCache = new Map<string, { at: number; probe: ProbeResult }>();

// Une réparation qui échoue ne doit pas être retentée à chaque poll (Telegram
// refuse de ré-enregistrer à l'identique : « Webhook is already set »).
const REPAIR_THROTTLE_MS = 600_000;
let lastRepairAt = 0;

async function cachedProbe(url: string, secret: string, timeoutMs: number): Promise<ProbeResult> {
  const hit = probeCache.get(url);
  if (hit && Date.now() - hit.at < PROBE_TTL_MS) return hit.probe;
  const probe = await probeWebhook(url, secret, timeoutMs);
  probeCache.set(url, { at: Date.now(), probe });
  return probe;
}

function baseOfWebhook(url: string): string {
  return url.replace(/\/+$/, "").replace(/\/api\/telegram\/webhook$/, "");
}

/** Bases candidates autorisées : domaine agence + URL détectée (anti-détournement). */
async function candidateBases(detectedBase?: string): Promise<string[]> {
  const appBase = (await getSetting("APP_BASE_URL")).trim();
  const agencyDomain = (await getSetting("AGENCY_DOMAIN")).trim().toLowerCase();
  const raw = [appBase, agencyDomain ? `https://${agencyDomain}` : "", detectedBase ?? ""];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    if (!r) continue;
    let u: URL;
    try {
      u = new URL(r.startsWith("http") ? r : `https://${r}`);
    } catch {
      continue;
    }
    if (u.protocol !== "https:") continue;
    const base = `${u.origin}`.replace(/\/+$/, "");
    if (seen.has(base)) continue;
    seen.add(base);
    out.push(base);
  }
  return out;
}

export async function ensureTelegramWebhookHealth(
  opts: { detectedBase?: string; repair?: boolean; timeoutMs?: number } = {},
): Promise<TelegramHealth> {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const checkedAt = new Date().toISOString();
  const token = await getSetting("TELEGRAM_BOT_TOKEN");
  const empty = (detail: string, kind: ProbeKind = "network"): TelegramHealth => ({
    healthy: false,
    activeUrl: "",
    registeredUrl: "",
    expectedUrl: "",
    urlMatches: false,
    pendingUpdateCount: 0,
    staleTelegramError: false,
    telegramError: null,
    telegramErrorDate: null,
    telegramErrorAgeHours: null,
    repaired: false,
    repairedUrl: null,
    kind,
    detail,
    checkedAt,
    probes: [],
  });
  if (!token) return empty("Token absent — RIO ne peut pas vous répondre sur Telegram.");

  // Secret du webhook : s'il a disparu, on en regénère un (la réparation
  // ci-dessous le ré-enregistre côté Telegram).
  let secret = await getSetting("TELEGRAM_WEBHOOK_SECRET");
  if (!secret) {
    const { setSetting } = await import("./settings");
    secret = `gsd-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    await setSetting("TELEGRAM_WEBHOOK_SECRET", secret);
  }

  const info = await getTelegramWebhookInfo();
  const registeredUrl = info.ok ? info.info?.url ?? "" : "";
  const telegramError = info.ok ? info.info?.last_error_message ?? null : null;
  const telegramErrorDate = info.ok ? info.info?.last_error_date ?? null : null;
  const pendingUpdateCount = info.ok ? info.info?.pending_update_count ?? 0 : 0;

  const bases = await candidateBases(opts.detectedBase);
  const probes: ProbeResult[] = [];

  // 1) Sonde de l'URL ENREGISTRÉE : c'est celle que Telegram appelle.
  if (registeredUrl) probes.push(await cachedProbe(registeredUrl, secret, timeoutMs));
  // 2) Sonde des candidats canoniques (domaine d'abord), jusqu'à un survivor.
  for (const base of bases) {
    const url = `${base}${WEBHOOK_PATH}`;
    if (probes.some((p) => p.url === url)) continue;
    const p = await cachedProbe(url, secret, timeoutMs);
    probes.push(p);
    if (p.kind === "healthy") break;
  }

  // 3) Cible de réparation : le premier candidat canonique sain, sinon l'URL
  //    enregistrée si elle répond encore (ne pas casser un canal qui marche).
  const candidateUrls = bases.map((b) => `${b}${WEBHOOK_PATH}`);
  const plan = planRepair({ registeredUrl, candidateUrls, probes });

  // 4) Réparation : URL enregistrée != cible saine → on ré-enregistre.
  let repaired = false;
  let repairedUrl: string | null = null;
  const repairAllowed = Date.now() - lastRepairAt >= REPAIR_THROTTLE_MS;
  if (opts.repair !== false && repairAllowed && plan.needsRepair && plan.target) {
    lastRepairAt = Date.now();
    const res = await registerTelegramWebhook(baseOfWebhook(plan.target));
    if (res.ok) {
      repaired = true;
      repairedUrl = res.url ?? plan.target;
      const after = await probeWebhook(repairedUrl, secret, timeoutMs);
      probeCache.set(repairedUrl, { at: Date.now(), probe: after });
      const idx = probes.findIndex((p) => p.url === registeredUrl);
      if (idx >= 0) probes[idx] = after;
      else probes.push(after);
    }
  }

  const report = buildHealthReport({
    registeredUrl: repaired ? repairedUrl ?? registeredUrl : registeredUrl,
    telegramError,
    telegramErrorDate,
    probes,
    repaired,
    repairedUrl,
  });

  const expectedUrl = plan.canonicalHealthy ?? (candidateUrls[0] ?? "");
  return {
    ...report,
    expectedUrl,
    urlMatches: report.activeUrl ? report.activeUrl === expectedUrl : false,
    pendingUpdateCount,
    checkedAt,
    probes,
  };
}


// ─────────────────────────────────────────────
// RIO sur Telegram — chat IA + commandes rapides
// ─────────────────────────────────────────────
const COMMAND_HELP = `🤖 <b>GoSite Digital — RIO à vos ordres</b>

💬 <b>Parlez-moi normalement</b> — je comprends le langage naturel :
« où en est le pipeline ? » · « prospecte des barbershops à Casablanca »
« supprime les leads rejetés » · « montre-moi le lead 12 »
« pourquoi les emails échouent ? » · « objectif : 10 clients payants ce mois »

⚡ <b>Commandes rapides</b>
/status — compteurs du pipeline
/agents — état des 10 agents
/leads [étape] — derniers leads (ex. /leads validated)
/lead [id] — fiche détaillée d'un lead
/find [texte] — rechercher un lead par nom ou ville
/scout [niche] [ville] — lancer une prospection
/validate — qualifier les leads en attente
/run [id] — pipeline complet d'un lead
/site [id] — lien du site généré
/delete [id] — supprimer un lead
/purge — supprimer tous les leads rejetés
/note [id] [texte] — ajouter une note interne
/schedule [niche] [ville] [heures] — mission récurrente
/schedules — lister les missions récurrentes
/objectif [cible] [metrique] — ex. /objectif 10 paid
/objectifs — suivi des objectifs
/tick — forcer un cycle auto-pilote
/autopilot on|off — activer/couper le 24/7
/skills [agent] — compétences du cerveau d'un agent
/teach [agent] [titre] | [instruction] — enseigner une compétence
/evolve [agent|all] — auto-amélioration par l'IA
/brain — état du cerveau IA de toute l'équipe
/diag — diagnostic des intégrations
/errors — dernières erreurs
/pause [agent] · /resume [agent]
/reset — effacer la mémoire de conversation
/help — cette aide`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function handleTelegramUpdate(update: {
  message?: { chat?: { id?: number }; text?: string; from?: { first_name?: string } };
}): Promise<void> {
  const msg = update.message;
  const text = msg?.text?.trim();
  const chatId = msg?.chat?.id ? String(msg.chat.id) : null;
  if (!text || !chatId) return;

  const isCommand = text.startsWith("/");
  const [cmd, ...args] = text.split(/\s+/);
  const command = cmd.toLowerCase().replace(/@\w+$/, "");

  await logActivity({
    agentKey: "telegram",
    action: isCommand ? "commande_recue" : "message_recu",
    message: `Telegram ← ${text.slice(0, 120)} (chat ${chatId})`,
    level: "info",
  });

  // ── /start : mémorise le chat ID ──
  if (command === "/start") {
    const { setSetting } = await import("./settings");
    await setSetting("TELEGRAM_CHAT_ID", chatId);
    await sendTelegram(
      `👋 Salut, c'est <b>RIO</b>, le CEO de GoSite Digital.\nTon canal est enregistré (<code>${chatId}</code>) — je te préviendrai à chaque étape clé.\n\nParle-moi normalement, je comprends tout.\n\n${COMMAND_HELP}`,
      chatId,
    );
    return;
  }
  if (command === "/help") return void (await sendTelegram(COMMAND_HELP, chatId));

  // ── Langage naturel → cerveau de RIO ──
  if (!isCommand) {
    await sendChatAction(chatId);
    const { askRio } = await import("./rio");
    try {
      const turn = await askRio(text, "telegram");
      const { markdownToTelegram } = await import("./format");
      const tools = turn.toolCalls.length
        ? `\n\n<i>⚙️ ${turn.toolCalls.map((t) => t.name).join(", ")}</i>`
        : "";
      await sendTelegram(`${markdownToTelegram(turn.reply)}${tools}`, chatId);
    } catch (err) {
      await sendTelegram(`⚠️ Je n'ai pas pu traiter ça : ${err instanceof Error ? err.message : "erreur"}`, chatId);
    }
    return;
  }

  const { executeTool } = await import("./rio-tools");
  const reply = (s: string) => sendTelegram(s, chatId);

  switch (command) {
    case "/status": {
      const r = await executeTool("get_dashboard", {});
      const d = r.data as { parEtape: Record<string, number>; total: number; sitesGeneres: number; enLigne: number; offresEnvoyees: number; payes: number };
      const line = (k: string, label: string, icon: string) => `${icon} ${label} : <b>${d.parEtape[k] ?? 0}</b>`;
      return void (await reply(
        `📊 <b>Pipeline GoSite Digital</b>\n\n` +
          [
            line("discovered", "Découverts", "🔍"),
            line("validated", "Qualifiés", "✅"),
            line("email_verified", "Emails vérifiés", "📧"),
            line("mapped", "Fiches prêtes", "📋"),
            line("site_built", "Sites générés", "💻"),
            line("deployed", "Déployés", "🚀"),
            line("contacted", "Contactés", "📨"),
            line("paid", "Payés", "💳"),
            line("rejected", "Rejetés", "⛔"),
          ].join("\n") +
          `\n\nTotal : <b>${d.total}</b> leads · ${d.enLigne} sites en ligne · ${d.payes} payés`,
      ));
    }

    case "/agents": {
      const r = await executeTool("get_dashboard", {});
      const { db: database } = await import("@/db");
      const { agents: agentsTable } = await import("@/db/schema");
      const all = await database.select().from(agentsTable).orderBy(agentsTable.sortOrder);
      const lines = all.map((a) => {
        const st = a.status === "ready" ? "🟢" : a.status === "running" ? "🔵" : a.status === "paused" ? "🟡" : "🔴";
        return `${st} <b>${a.name}</b> — ${a.stats?.runs ?? 0} runs${a.lastError ? ` · ⚠ ${esc(a.lastError.slice(0, 40))}` : ""}`;
      });
      void r;
      return void (await reply(`🧠 <b>L'équipe</b>\n\n${lines.join("\n")}`));
    }

    case "/leads": {
      const r = await executeTool("list_leads", { stage: args[0] ?? "", limit: 10 });
      const items = (r.data as { id: number; nom: string; ville: string; note: string; avis: number; etape: string }[]) ?? [];
      if (!items.length) return void (await reply("Aucun lead. Lance : <code>/scout barbershop Casablanca</code>"));
      return void (await reply(
        `📋 <b>Leads</b>\n\n` +
          items.map((l) => `#${l.id} <b>${esc(l.nom)}</b>\n   ${esc(l.ville ?? "?")} · ⭐${l.note ?? "?"} (${l.avis ?? 0}) · <i>${l.etape}</i>`).join("\n") +
          `\n\n<code>/lead [id]</code> pour le détail · <code>/run [id]</code> pour le pipeline`,
      ));
    }

    case "/lead": {
      const id = Number(args[0]);
      if (!id) return void (await reply("Usage : <code>/lead 12</code>"));
      const r = await executeTool("get_lead", { id });
      if (!r.ok) return void (await reply(r.summary));
      const d = r.data as Record<string, unknown>;
      return void (await reply(
        `📇 <b>${esc(String(d.nom))}</b>\n\n` +
          `📍 ${esc(String(d.adresse ?? "—"))}, ${esc(String(d.ville ?? ""))}\n` +
          `☎️ ${esc(String(d.telephone ?? "—"))}\n` +
          `📧 ${esc(String(d.email ?? "aucun"))} (${d.emailStatut})\n` +
          `⭐ ${d.note}/5 · ${d.avis} avis · ${d.aDejaUnSite ? "a déjà un site" : "sans site"}\n` +
          `🧭 Étape : <b>${d.etape}</b>${d.motifRejet ? `\n⛔ ${esc(String(d.motifRejet))}` : ""}\n` +
          `💻 Site : ${d.siteGenere ? "généré" : "non généré"}${d.urlDeployee ? `\n🌐 ${d.urlDeployee}` : ""}\n` +
          `💳 Paiement : ${d.statutPaiement}` +
          (Array.isArray(d.notesInternes) && d.notesInternes.length ? `\n\n📝 ${(d.notesInternes as string[]).map(esc).join("\n📝 ")}` : ""),
      ));
    }

    case "/find": {
      const q = args.join(" ");
      if (!q) return void (await reply("Usage : <code>/find barber</code>"));
      const r = await executeTool("list_leads", { search: q, limit: 10 });
      const items = (r.data as { id: number; nom: string; ville: string; etape: string }[]) ?? [];
      return void (await reply(items.length
        ? `🔎 <b>Résultats pour "${esc(q)}"</b>\n\n${items.map((l) => `#${l.id} ${esc(l.nom)} — ${esc(l.ville ?? "")} · ${l.etape}`).join("\n")}`
        : `Aucun résultat pour "${esc(q)}".`));
    }

    case "/scout": {
      const niche = args[0];
      const city = args.slice(1).join(" ");
      if (!niche || !city) return void (await reply("Usage : <code>/scout barbershop Casablanca</code>"));
      await reply(`🔍 Prospector en mission — "${esc(niche)}" à ${esc(city)}…`);
      const r = await executeTool("scout", { niche, city });
      return void (await reply(`${r.ok ? "✅" : "⚠️"} ${esc(r.summary)}`));
    }

    case "/validate": {
      const r = await executeTool("validate_all", {});
      return void (await reply(`✅ ${esc(r.summary)}`));
    }

    case "/run": {
      const id = Number(args[0]);
      if (!id) return void (await reply("Usage : <code>/run 12</code>"));
      await reply(`⚙️ Pipeline complet lancé pour le lead #${id}…`);
      const r = await executeTool("advance_lead", { id, action: "full" });
      return void (await reply(`${r.ok ? "🏁" : "⚠️"} ${esc(r.summary)}`));
    }

    case "/site": {
      const id = Number(args[0]);
      if (!id) return void (await reply("Usage : <code>/site 12</code>"));
      const r = await executeTool("get_lead", { id });
      if (!r.ok) return void (await reply(r.summary));
      const d = r.data as Record<string, unknown>;
      const { getSetting: gs } = await import("./settings");
      const base = await gs("APP_BASE_URL");
      const preview = base ? `${base.replace(/\/+$/, "")}/api/prospects/${id}/preview` : `/api/prospects/${id}/preview`;
      return void (await reply(d.siteGenere
        ? `💻 <b>${esc(String(d.nom))}</b>\n🌐 En ligne : ${d.urlDeployee ?? "pas encore déployé"}\n👁 Prévisualisation : ${preview}`
        : `Le site de ${esc(String(d.nom))} n'est pas encore généré. <code>/run ${id}</code> pour lancer la chaîne.`));
    }

    case "/delete": {
      const id = Number(args[0]);
      if (!id) return void (await reply("Usage : <code>/delete 12</code>"));
      const r = await executeTool("delete_leads", { ids: [id] });
      return void (await reply(`🗑 ${esc(r.summary)}`));
    }

    case "/purge": {
      const r = await executeTool("delete_leads", { purge_rejected: true });
      return void (await reply(`🧹 ${esc(r.summary)}`));
    }

    case "/note": {
      const id = Number(args[0]);
      const note = args.slice(1).join(" ");
      if (!id || !note) return void (await reply("Usage : <code>/note 12 Rappeler lundi matin</code>"));
      const r = await executeTool("add_note", { id, note });
      return void (await reply(`📝 ${esc(r.summary)}`));
    }

    case "/schedule": {
      const niche = args[0];
      const city = args[1];
      const hours = Number(args[2] ?? 6);
      if (!niche || !city) return void (await reply("Usage : <code>/schedule restaurant Marrakech 6</code>"));
      const r = await executeTool("manage_schedule", { action: "create", niche, city, interval_hours: hours });
      return void (await reply(`🗓 ${esc(r.summary)}`));
    }

    case "/schedules": {
      const r = await executeTool("manage_schedule", { action: "list" });
      const items = (r.data as { id: number; niche: string; ville: string; toutesLes: string; active: boolean }[]) ?? [];
      return void (await reply(items.length
        ? `🗓 <b>Missions récurrentes</b>\n\n${items.map((s) => `#${s.id} ${esc(s.niche)} · ${esc(s.ville)} — ${s.toutesLes} ${s.active ? "🟢" : "⏸"}`).join("\n")}`
        : "Aucune mission récurrente. <code>/schedule restaurant Marrakech 6</code>"));
    }

    case "/objectif": {
      const target = Number(args[0]);
      const metric = args[1] ?? "paid";
      if (!target) return void (await reply("Usage : <code>/objectif 10 paid</code> (metriques: leads, qualified, deployed, contacted, paid)"));
      const r = await executeTool("manage_objectives", { action: "create", title: `${target} ${metric}`, metric, target });
      return void (await reply(`🎯 ${esc(r.summary)}`));
    }

    case "/objectifs": {
      const r = await executeTool("manage_objectives", { action: "list" });
      const items = (r.data as { id: number; titre: string; cible: string }[]) ?? [];
      return void (await reply(items.length
        ? `🎯 <b>Objectifs</b>\n\n${items.map((o) => `#${o.id} ${esc(o.titre)} — ${esc(o.cible)}`).join("\n")}`
        : "Aucun objectif actif. <code>/objectif 10 paid</code>"));
    }

    case "/tick": {
      await reply("🤖 Cycle auto-pilote en cours…");
      const r = await executeTool("run_autopilot", {});
      return void (await reply(`✅ ${esc(r.summary)}`));
    }

    case "/autopilot": {
      const on = (args[0] ?? "").toLowerCase();
      if (on !== "on" && on !== "off") return void (await reply("Usage : <code>/autopilot on</code> ou <code>/autopilot off</code>"));
      const r = await executeTool("set_autopilot", { enabled: on === "on" });
      return void (await reply(`${on === "on" ? "🟢" : "⏸"} ${esc(r.summary)}`));
    }

    case "/diag": {
      const r = await executeTool("get_diagnostics", {});
      const d = r.data as Record<string, string>;
      return void (await reply(
        `🩺 <b>Diagnostic</b>\n\n` +
          Object.entries(d).map(([k, v]) => `${v.startsWith("LIVE") || v.includes("ACTIF") || v.includes("DÉSACTIVÉ") ? "🟢" : v === "NON CONFIGURÉ" ? "🔴" : "🟡"} <b>${k}</b> : ${esc(v)}`).join("\n"),
      ));
    }

    case "/errors": {
      const r = await executeTool("get_activity", { limit: 10, level: "error" });
      const items = (r.data as { agent: string; message: string }[]) ?? [];
      return void (await reply(items.length
        ? `🔴 <b>Dernières erreurs</b>\n\n${items.map((a) => `• [${a.agent}] ${esc(a.message.slice(0, 120))}`).join("\n")}`
        : "✅ Aucune erreur récente."));
    }

    case "/reset": {
      const { db: database } = await import("@/db");
      const { rioMessages } = await import("@/db/schema");
      await database.delete(rioMessages);
      return void (await reply("🧠 Mémoire de conversation effacée. On repart à zéro."));
    }

    case "/skills": {
      const agent = (args[0] ?? "").toLowerCase();
      if (!agent) return void (await reply("Usage : <code>/skills saler</code>"));
      const r = await executeTool("manage_skills", { action: "list", agent });
      const d = r.data as { competences: { id: number; titre: string; source: string; active: boolean }[]; apprentissages: string[] } | undefined;
      if (!d) return void (await reply(r.summary));
      const icon = (src: string) => (src === "learned" ? "🧬" : src === "user" ? "🎓" : "⚙️");
      return void (await reply(
        `🧠 <b>Cerveau de ${esc(agent)}</b>\n\n` +
          (d.competences.length
            ? d.competences.map((c) => `${icon(c.source)} ${c.active ? "" : "<s>"}<b>${esc(c.titre)}</b>${c.active ? "" : "</s>"} <code>#${c.id}</code>`).join("\n")
            : "Aucune compétence.") +
          (d.apprentissages.length ? `\n\n📚 <b>Appris sur le terrain</b>\n${d.apprentissages.map((l) => `• ${esc(l.slice(0, 150))}`).join("\n")}` : ""),
      ));
    }

    case "/teach": {
      const agent = (args[0] ?? "").toLowerCase();
      const rest = args.slice(1).join(" ");
      const [title, instruction] = rest.split("|").map((x) => x.trim());
      if (!agent || !title || !instruction) {
        return void (await reply("Usage : <code>/teach saler Objet court | Garde un objet sous 45 caractères avec le nom du commerce</code>"));
      }
      const r = await executeTool("manage_skills", { action: "teach", agent, title, instruction });
      return void (await reply(`${r.ok ? "🎓" : "⚠️"} ${esc(r.summary)}`));
    }

    case "/evolve": {
      const agent = (args[0] ?? "all").toLowerCase();
      await reply(`🧬 Auto-amélioration de <b>${esc(agent)}</b> en cours…`);
      const r = await executeTool("evolve_agent", { agent });
      return void (await reply(`${r.ok ? "✅" : "⚠️"} ${esc(r.summary)}`));
    }

    case "/brain": {
      const { db: database } = await import("@/db");
      const { agentSkills, agentLearnings, aiCalls } = await import("@/db/schema");
      const { brainOnline } = await import("./agent-brain");
      const online = await brainOnline();
      const skills = await database.select().from(agentSkills);
      const learnings = await database.select().from(agentLearnings);
      const calls = await database.select().from(aiCalls);
      const roster = ["prospector", "validator", "emailor", "mapper", "coder", "deployer", "saler", "paymer", "domainner", "support"];
      const lines = roster.map((a) => {
        const sk = skills.filter((s) => s.agentKey === a && s.active).length;
        const le = learnings.filter((l) => l.agentKey === a).length;
        const ca = calls.filter((c) => c.agentKey === a).length;
        return `${online ? "🟢" : "🔴"} <b>${a}</b> — ${sk} skills · ${le} leçons · ${ca} appels IA`;
      });
      return void (await reply(
        `🧠 <b>Cerveau partagé — LLM omniroute</b>\n${online ? "Connecté : les 10 agents raisonnent avec l'IA." : "Hors-ligne : les agents tournent en mode réflexes."}\n\n${lines.join("\n")}`,
      ));
    }

    case "/pause":
    case "/resume": {
      const key = (args[0] ?? "").toLowerCase();
      if (!key) return void (await reply(`Usage : <code>${command} prospector</code>`));
      const r = await executeTool("control_agent", { agent: key, action: command === "/pause" ? "pause" : "resume" });
      return void (await reply(`${command === "/pause" ? "⏸" : "▶️"} ${esc(r.summary)}`));
    }

    default: {
      // Commande inconnue → on laisse RIO interpréter
      await sendChatAction(chatId);
      const { askRio } = await import("./rio");
      const { markdownToTelegram } = await import("./format");
      const turn = await askRio(text.replace(/^\//, ""), "telegram");
      return void (await reply(markdownToTelegram(turn.reply)));
    }
  }
}

// Indicateur "en train d'écrire…" pendant que RIO réfléchit
async function sendChatAction(chatId: string) {
  try {
    const token = await getSetting("TELEGRAM_BOT_TOKEN");
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* noop */ }
}
