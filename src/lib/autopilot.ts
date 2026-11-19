// Auto-pilote 24/7 — exécute des cycles complets sans intervention de RIO :
// 1) missions de prospection planifiées (scout_schedules)
// 2) avancement automatique du pipeline, étape par étape, en respectant les
//    interrupteurs auto_pilot / pause de chaque agent.

import { db } from "@/db";
import { agents, activities, inboundEmails, prospects, scoutSchedules, settings, type Agent } from "@/db/schema";
import { and, asc, desc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ensureAgentsSeeded } from "./agents";
import { getSetting } from "./settings";
import { logActivity } from "./activity";
import { notifyTelegram } from "./telegram";
import {
  runScoutMission, validateProspect, verifyProspectEmail, mapProspect,
  buildProspectSite, deployProspectSite, contactProspect, rebuildDeployedSiteV7,
  refreshDeployedSiteV7,
} from "./pipeline";

export type TickSummary = {
  at: string;
  autopilot: boolean;
  missionsRun: number;
  advanced: Record<string, number>;
  errors: string[];
  processed: number;
  evolved?: { agent: string; summary: string; skills: string[] };
  skipped?: string;
  deadlineReached?: boolean;
  capped?: boolean;
  migrated?: boolean;
};

const TICK_LOCK_KEY = "TICK_LOCK";
// Un tick dure au plus 60 s (kill Vercel Hobby). 90 s de grace suffit : si le
// process est tué avant release, le verrou bloque les doublons ~1,5 min au lieu
// de 10 min — sinon un tick tué sur un step LLM lent gelait le pipeline 10 min.
const TICK_LOCK_STALE_MS = 90_000;
// Budget du tick : Vercel Hobby = 60 s max par fonction. On s'arrête à 45 s
// pour garder la marge (réponse + libération du lease) avant le kill.
const TICK_DEADLINE_MS = 45_000;
// Spec 1.5 (option B) : un tick ne traite jamais tout le pipeline. Maximum
// 5 prospects avancés par tick (toutes étapes confondues) : le tourniquet
// d'étapes et le budget de 45 s gardent le reste pour les ticks suivants.
const TICK_MAX_PROSPECTS = 5;

// Verrou de tick : un seul cycle à la fois (cron + RIO + manuel ne doivent
// jamais traiter le même batch en parallèle). Claim atomique avec expiration
// automatique — pas de pg_advisory_lock car le pool ne garantit pas la même
// connexion entre deux requêtes.
async function acquireTickLease(): Promise<string | null> {
  const token = randomUUID();
  const stale = new Date(Date.now() - TICK_LOCK_STALE_MS);
  const rows = await db.insert(settings)
    .values({ key: TICK_LOCK_KEY, value: token, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: token, updatedAt: new Date() },
      where: lt(settings.updatedAt, stale),
    })
    .returning();
  return rows[0]?.value === token ? token : null;
}

async function releaseTickLease(token: string): Promise<void> {
  try {
    await db.delete(settings).where(and(eq(settings.key, TICK_LOCK_KEY), eq(settings.value, token)));
  } catch {
    // Rien : le verrou expire de toute façon après TICK_LOCK_STALE_MS.
  }
}

async function agentUsable(key: string, cache: Map<string, Agent>): Promise<boolean> {
  let a = cache.get(key);
  if (!a) {
    const rows = await db.select().from(agents).where(eq(agents.key, key)).limit(1);
    if (!rows[0]) return true;
    a = rows[0];
    cache.set(key, a);
  }
  return (a?.autoPilot ?? true) && a.status !== "paused";
}

export async function runAutopilotTick(opts: { force?: boolean } = {}): Promise<TickSummary> {
  await ensureAgentsSeeded();
  // Empreinte de santé : l'heure du dernier appel au tick, quel qu'en soit
  // l'émetteur (moniteur externe, cron Vercel, RIO, bouton manuel). Sans elle,
  // un ping silencieux sur un pipeline idle est indétectable côté serveur.
  try {
    await db.insert(settings)
      .values({ key: "TICK_LAST_PING", value: new Date().toISOString(), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      });
  } catch { /* non bloquant */ }
  const summary: TickSummary = {
    at: new Date().toISOString(),
    autopilot: (await getSetting("AUTOPILOT")) === "true",
    missionsRun: 0,
    advanced: {},
    errors: [],
    processed: 0,
  };
  if (!summary.autopilot && !opts.force) return summary;

  const lease = await acquireTickLease();
  if (!lease) {
    return { ...summary, skipped: "tick déjà en cours (verrou actif)" };
  }
  try {
    const result = await runTickBody(summary);
    await logTickSummary(result);
    return result;
  } catch (err) {
    // Spec 1.5 : plus jamais d'erreur silencieuse dans after() — le tick
    // échoué est tracé en DB (activities) et signalé, puis le lease est
    // libéré par le finally : le tick suivant repart proprement.
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`tick: ${msg}`);
    await logTickSummary(summary).catch(() => undefined);
    await logActivity({
      agentKey: "autopilot", action: "tick_erreur",
      message: `Tick interrompu : ${msg}`.slice(0, 300), level: "error",
    }).catch(() => undefined);
    await notifyTelegram(`⚠️ <b>Auto-pilote</b> — tick interrompu : ${msg.slice(0, 200)}`).catch(() => undefined);
    return summary;
  } finally {
    await releaseTickLease(lease);
  }
}

/** Trace le résultat de chaque tick utile dans activities (spec 1.5). */
async function logTickSummary(summary: TickSummary): Promise<void> {
  const moved = Object.values(summary.advanced).reduce((a, b) => a + b, 0);
  if (moved === 0 && summary.missionsRun === 0 && summary.errors.length === 0 && !summary.migrated) return;
  const detail = Object.entries(summary.advanced).map(([stage, n]) => `${stage}:${n}`).join(" ") || "aucune étape";
  await logActivity({
    agentKey: "autopilot", action: "tick_termine",
    message: `Tick : ${summary.processed} lead(s) traité(s) · ${detail} · missions ${summary.missionsRun}` +
      `${summary.migrated ? " · migration v7" : ""}${summary.capped ? " · plafond 5 atteint" : ""}${summary.deadlineReached ? " · deadline 45s" : ""}` +
      `${summary.errors.length ? ` · ${summary.errors.length} erreur(s)` : ""}`.slice(0, 300),
    level: summary.errors.length ? "warn" : "success",
  });
}

async function runTickBody(summary: TickSummary): Promise<TickSummary> {
  const cache = new Map<string, Agent>();
  const bump = (k: string) => { summary.advanced[k] = (summary.advanced[k] ?? 0) + 1; };
  const deadline = Date.now() + TICK_DEADLINE_MS;

  // ── 0) Garde-fou Telegram : le canal ENTRANT peut mourir sans que rien ne
  //      se voie (compte d'hébergement bloqué → 402, protection → 401, alias
  //      mort → 404). On sonde l'endpoint une fois par heure ; si elle ne
  //      répond pas, on ré-enregistre le webhook et on alerte — l'envoi
  //      SORTANT marche même quand l'entrant est mort, c'est donc le seul
  //      canal disponible pour prévenir l'opérateur. En TÊTE de tick : c'est
  //      la panne la plus grave, elle passe avant le pipeline.
  try {
    const last = await getSetting("TELEGRAM_HEALTH_CHECK");
    if (!last || Date.now() - new Date(last).getTime() >= 3600_000) {
      await db
        .insert(settings)
        .values({ key: "TELEGRAM_HEALTH_CHECK", value: new Date().toISOString(), updatedAt: new Date() })
        .onConflictDoUpdate({ target: settings.key, set: { value: new Date().toISOString(), updatedAt: new Date() } });
      const { ensureTelegramWebhookHealth } = await import("./telegram");
      const health = await ensureTelegramWebhookHealth({ repair: true, timeoutMs: 5000 });
      if (!health.healthy) {
        summary.errors.push(`telegram_webhook: ${health.kind}`);
        await logActivity({
          agentKey: "telegram", action: "webhook_muet",
          message: `Canal Telegram entrant muet — ${health.detail}`,
          level: "error",
        });
        await notifyTelegram(
          `🛑 <b>Canal Telegram entrant muet</b>\n${health.detail}\n` +
            `Je continue à t'écrire (l'envoi sortant fonctionne) mais je n'entends plus tes messages.`,
        );
      } else if (health.repaired) {
        await logActivity({
          agentKey: "telegram", action: "webhook_repare",
          message: `Webhook Telegram réparé automatiquement → ${health.repairedUrl}.`,
          level: "warn",
        });
        await notifyTelegram(
          `🔧 <b>Webhook Telegram réparé</b>\nRé-enregistré sur <code>${health.repairedUrl}</code> — je recommence à recevoir tes messages.`,
        );
      }
    }
  } catch (err) {
    summary.errors.push(`telegram_health: ${err instanceof Error ? err.message : "?"}`);
  }

  // Auto-réparation : un lead resté en "contacting" (crash en pleine tentative
  // d'envoi) retourne en "deployed" après 15 min d'inactivité.
  await db.update(prospects)
    .set({ stage: "deployed", updatedAt: new Date() })
    .where(and(eq(prospects.stage, "contacting"), lt(prospects.updatedAt, new Date(Date.now() - 15 * 60_000))));

  // ── 0b) Migration des sites v6 encore en ligne (spec 2.7) ──
  // Les leads déjà "contacted" ne repassent JAMAIS par le pipeline : sans ce
  // rattrapage, leur ancien site (renderFallbackIndex) reste en prod à vie.
  // Un seul par tick, stage/URL/emails inchangés — seul le bundle est remplacé.
  if (Date.now() < deadline - 25_000) {
    try {
      const legacy = await db
        .select()
        .from(prospects)
        .where(and(isNotNull(prospects.deployedUrl), isNull(prospects.siteSpec)))
        .orderBy(asc(prospects.updatedAt))
        .limit(1);
      if (legacy[0]) {
        const r = await rebuildDeployedSiteV7(legacy[0]);
        summary.migrated = r.ok;
        if (!r.ok) summary.errors.push(`migration_v7#${legacy[0].id}: ${r.error}`);
      } else {
        // Aucun v6 : on rafraîchit un site v7 dont le bundle contient encore un
        // hotlink ou n'a pas d'image hero/about locale (bundles d'avant correctif).
        const stale = await db
          .select()
          .from(prospects)
          .where(and(
            isNotNull(prospects.deployedUrl),
            isNotNull(prospects.siteSpec),
            sql`(${prospects.siteHtml} like ${"%images.unsplash.com%"}
              or ${prospects.siteHtml} like ${"%assets.gosite.digital%"}
              or ${prospects.siteBundle}::text not like ${"%images/hero.%"}
              or ${prospects.siteBundle}::text not like ${"%images/about.%"}
              or ${prospects.siteBundle}::text not like ${"%images/work-1.%"} )`,
          ))
          .orderBy(asc(prospects.updatedAt))
          .limit(1);
        if (stale[0]) {
          const r = await refreshDeployedSiteV7(stale[0]);
          summary.migrated = r.ok;
          if (!r.ok) summary.errors.push(`refresh_v7#${stale[0].id}: ${r.error}`);
        }
      }
    } catch (err) {
      summary.errors.push(`migration_v7: ${err instanceof Error ? err.message : "?"}`);
    }
  }

  // ── 1) Missions planifiées ──
  if (await agentUsable("prospector", cache)) {
    const schedules = await db.select().from(scoutSchedules).where(eq(scoutSchedules.active, true)).orderBy(asc(scoutSchedules.lastRunAt));
    for (const s of schedules.slice(0, 2)) {
      if (Date.now() > deadline) { summary.deadlineReached = true; break; }
      const due = !s.lastRunAt || Date.now() - new Date(s.lastRunAt).getTime() >= s.intervalHours * 3600_000;
      if (!due) continue;
      try {
        // Les missions planifiées tournent en essaim : couverture maximale de la ville
        const r = await runScoutMission(s.niche, s.city, Math.max(s.maxResults, 30), { telegram: true, strategy: "swarm" });
        summary.missionsRun++;
        await db.update(scoutSchedules).set({ lastRunAt: new Date() }).where(eq(scoutSchedules.id, s.id));
        await logActivity({
          agentKey: "autopilot", action: "mission_planifiee",
          message: `Mission planifiée "${s.niche} / ${s.city}" exécutée : ${r.inserted} leads.`, level: "success",
        });
      } catch (err) {
        summary.errors.push(`schedule#${s.id}: ${err instanceof Error ? err.message : "?"}`);
      }
    }
  }

  // ── 2) Pipeline batch par étape ──
  const take = async (stage: string, limit: number) =>
    db.select().from(prospects).where(eq(prospects.stage, stage)).orderBy(asc(prospects.createdAt)).limit(limit);

  const steps: { stage: string; agent: string; limit: number; fn: (p: typeof prospects.$inferSelect) => Promise<unknown> }[] = [
    // Note : Validator et Emailor « rejettent » légitimement — ce ne sont pas des erreurs.
    { stage: "discovered", agent: "validator", limit: 15, fn: validateProspect },
    { stage: "validated", agent: "emailor", limit: 15, fn: verifyProspectEmail },
    { stage: "email_verified", agent: "mapper", limit: 15, fn: mapProspect },
    { stage: "mapped", agent: "coder", limit: 2, fn: buildProspectSite },
    { stage: "site_built", agent: "deployer", limit: 4, fn: deployProspectSite },
    { stage: "deployed", agent: "saler", limit: 6, fn: contactProspect },
  ];

  // Tourniquet : l'étape de départ change à chaque tick (compteur persisté —
  // minute%6 est piégé : des ticks espacés de 5 min tombent toujours sur les
  // mêmes multiples de 6 et le tourniquet ne tourne jamais). Sinon le deadline
  // de 45 s se consomme toujours sur les étapes amont (validator/emailor,
  // pleines à chaque mission) et les étapes aval (coder/deployer/saler)
  // meurent de faim. Le verrou de tick garantit l'absence de course.
  const seqRows = await db.select().from(settings).where(eq(settings.key, "TICK_SEQ")).limit(1);
  const seq = (Number(seqRows[0]?.value ?? "0") + 1) % 1_000_000;
  // Upsert obligatoire : la ligne n'existe pas au premier tick (update pur
  // ne crée rien → seq restait à 0 et le tourniquet tournait sur un seul cran).
  await db.insert(settings)
    .values({ key: "TICK_SEQ", value: String(seq), updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(seq), updatedAt: new Date() } });
  const offset = seq % steps.length;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[(i + offset) % steps.length];
    if (Date.now() > deadline) { summary.deadlineReached = true; break; }
    if (!(await agentUsable(step.agent, cache))) continue;
    // Budget PAR ÉTAPE : sans lui, les étapes amont pleines (validator/emailor/
    // mapper : 15 leads × appel LLM) mangeaient tout le tick et coder/deployer
    // mouraient de faim quoi que fasse le tourniquet. 7 s par étape, l'aval
    // garde le reste ; une étape interrompue reprend au tick suivant (batch
    // limité, pas de perte).
    const stepEnd = step.agent === "deployer" ? deadline : Math.min(deadline, Date.now() + 7_000);
    if (summary.processed >= TICK_MAX_PROSPECTS) { summary.capped = true; break; }
    const batch = await take(step.stage, Math.min(step.limit, TICK_MAX_PROSPECTS - summary.processed));
    for (const p of batch) {
      if (summary.processed >= TICK_MAX_PROSPECTS) { summary.capped = true; break; }
      if (Date.now() > stepEnd) { if (Date.now() > deadline) summary.deadlineReached = true; break; }
      // Un déploiement Cloudflare peut consommer la minute entière à lui seul :
      // lancé trop tard, il déborde de la durée de vie de la fonction (60 s)
      // et tue le tick en FUNCTION_INVOCATION_TIMEOUT. Le lead reste site_built
      // et repartira au tick suivant, à jeun.
      if (step.agent === "deployer" && Date.now() > deadline - 25_000) { summary.deadlineReached = true; break; }
      try {
        summary.processed++;
        await step.fn(p);
        // Succès : remet le compteur d'échecs à zéro (uniquement si utile).
        if (p.failCount > 0) {
          await db.update(prospects).set({ failCount: 0, updatedAt: new Date() }).where(eq(prospects.id, p.id));
        }
        bump(step.stage);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "?";
        summary.errors.push(`#${p.id} ${step.agent}: ${msg}`);
        // Évite de retenter en boucle un lead qui ne peut pas avancer (ex: déploiement sans token)
        if (msg.includes("non configuré") || msg.includes("requis")) {
          await logActivity({
            agentKey: "autopilot", action: "blocage_config",
            message: `Cycle interrompu pour ${p.businessName} : ${msg}`, level: "warn", prospectId: p.id,
          });
          break; // La config manque → inutile d'essayer les autres leads de cette étape
        }
        // Anti poison-loop : un lead qui échoue N fois à la même étape (souvent
        // une sortie LLM récurrente ou des données pourries) est abandonné
        // après 3 tentatives au lieu d'être re-payé à chaque tick.
        const fails = (p.failCount ?? 0) + 1;
        if (fails >= 3) {
          await db.update(prospects).set({
            stage: "rejected", rejectReason: `Abandonné après ${fails} échecs à l'étape ${step.agent} : ${msg}`.slice(0, 300),
            failCount: fails, updatedAt: new Date(),
          }).where(eq(prospects.id, p.id));
          await logActivity({
            agentKey: "autopilot", action: "lead_abandonne",
            message: `${p.businessName} abandonné après ${fails} échecs (${step.agent}) : ${msg}`, level: "error", prospectId: p.id,
          });
        } else {
          await db.update(prospects).set({ failCount: fails, updatedAt: new Date() }).where(eq(prospects.id, p.id));
          await logActivity({
            agentKey: "autopilot", action: "etape_echec",
            message: `${p.businessName} — échec ${fails}/3 à l'étape ${step.agent} : ${msg}`, level: "warn", prospectId: p.id,
          });
        }
      }
    }
  }

  // ── 3) Rétention : purge légère des journaux (coût nul sous les seuils) ──
  try {
    const { purgeOldData } = await import("./maintenance");
    const purged = await purgeOldData();
    if (purged.activities + purged.aiCalls + purged.rioMessages + purged.orphanEmails > 0) {
      await logActivity({
        agentKey: "autopilot", action: "purge_donnees",
        message: `Rétention : ${purged.activities} activités, ${purged.aiCalls} appels IA, ${purged.rioMessages} messages RIO, ${purged.orphanEmails} emails orphelins supprimés.`,
        level: "info",
      });
    }
  } catch (err) {
    summary.errors.push(`purge: ${err instanceof Error ? err.message : "?"}`);
  }

  // ── 3b) Réconciliation : entrants restés "new" (échec webhook : LLM lent,
  //      timeout Brevo…) — retraités ici, 5 max par tick, abandon en "human".
  try {
    const stale = await db
      .select({ id: inboundEmails.id })
      .from(inboundEmails)
      .where(and(eq(inboundEmails.status, "new"), lt(inboundEmails.createdAt, new Date(Date.now() - 15 * 60_000))))
      .limit(5);
    let reconciled = 0;
    for (const s of stale) {
      try {
        const { processInboundRow } = await import("./inbound-process");
        const r = await processInboundRow(s.id);
        if (r.status === "replied") reconciled++;
      } catch {
        // compteur d'attempts déjà incrémenté dans processInboundRow
      }
    }
    if (reconciled > 0) {
      await logActivity({
        agentKey: "autopilot", action: "inbound_reconcilie",
        message: `${reconciled} réponse(s) client rattrapée(s) au tick.`,
        level: "success",
      });
    }
  } catch (err) {
    summary.errors.push(`reconciliation: ${err instanceof Error ? err.message : "?"}`);
  }

  // ── 3c) Garde-fou Vercel : le fair use verrouille le compte 30 jours sans
  //      préavis (déjà arrivé — fastOriginTransfer). Le softBlock est lisible
  //      sur le plan Hobby via /v2/teams ; alerte Telegram dans l'heure, sites
  //      clients restent sur Cloudflare Pages. Un check/h max.
  try {
    const last = await getSetting("TICK_SOFTBLOCK_CHECK");
    if (!last || Date.now() - new Date(last).getTime() >= 3600_000) {
      await db
        .insert(settings)
        .values({ key: "TICK_SOFTBLOCK_CHECK", value: new Date().toISOString(), updatedAt: new Date() })
        .onConflictDoUpdate({ target: settings.key, set: { value: new Date().toISOString(), updatedAt: new Date() } });
      const token = await getSetting("VERCEL_TOKEN");
      if (token) {
        const teamId = await getSetting("VERCEL_TEAM_ID");
        const res = await fetch(`https://api.vercel.com/v2/teams${teamId ? `?teamId=${teamId}` : ""}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) {
          const j = (await res.json()) as { team?: { softBlock?: { blockedAt?: string; reason?: string } } };
          if (j.team?.softBlock) {
            const reason = j.team.softBlock.reason ?? "fair use";
            summary.errors.push(`vercel_softblock: ${reason}`);
            await logActivity({
              agentKey: "autopilot", action: "vercel_softblock",
              message: `Compte Vercel verrouillé (${reason}) — deploys clients déjà sur Cloudflare Pages.`,
              level: "warn",
            });
            await notifyTelegram(
              `🚨 <b>Vercel a verrouillé le compte</b> (fair use)\n` +
                `Motif : ${reason} · Bloqué à : ${j.team.softBlock.blockedAt ?? "?"}\n` +
                `Les sites clients restent déployés sur Cloudflare Pages.`,
            );
          }
        }
      }
    }
  } catch (err) {
    summary.errors.push(`softblock_check: ${err instanceof Error ? err.message : "?"}`);
  }

  // ── 4) Auto-amélioration : au maximum une évolution par agent toutes les
  //      6 heures (sinon un ping toutes les 10 min paierait un appel LLM
  //      d'analyse de journal à chaque cycle pour le même résultat).
  if (Date.now() <= deadline) {
    try {
      const { brainOnline, evolveAgent } = await import("./agent-brain");
      if (await brainOnline()) {
        const roster = ["prospector", "validator", "emailor", "mapper", "coder", "deployer", "saler", "paymer", "domainner", "support"];
        const pick = roster[new Date().getHours() % roster.length];
        const lastEvo = await db
          .select({ createdAt: activities.createdAt })
          .from(activities)
          .where(and(eq(activities.agentKey, pick), eq(activities.action, "auto_evolution")))
          .orderBy(desc(activities.createdAt))
          .limit(1);        const cooled = !lastEvo[0] || Date.now() - new Date(lastEvo[0].createdAt).getTime() >= 6 * 3600_000;
        if (cooled) {
          const evo = await evolveAgent(pick);
          if (evo.ok) summary.evolved = { agent: pick, summary: evo.summary, skills: evo.skills };
        }
      }
    } catch (err) {
      summary.errors.push(`evolution: ${err instanceof Error ? err.message : "?"}`);
    }
  }

  const moved = Object.values(summary.advanced).reduce((a, b) => a + b, 0);
  if (moved > 0 || summary.missionsRun > 0 || summary.migrated) {
    await notifyTelegram(
      `🤖 <b>Auto-pilote — cycle terminé</b>\n` +
        `Missions : ${summary.missionsRun} · Leads avancés : ${moved}` +
        (summary.evolved ? `\n🧬 ${summary.evolved.agent} a évolué : ${summary.evolved.summary.slice(0, 160)}` : "") +
        (summary.errors.length ? `\n⚠️ ${summary.errors.length} erreur(s), voir le journal.` : ""),
    );
  }
  return summary;
}
