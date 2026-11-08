// Auto-pilote 24/7 — exécute des cycles complets sans intervention de RIO :
// 1) missions de prospection planifiées (scout_schedules)
// 2) avancement automatique du pipeline, étape par étape, en respectant les
//    interrupteurs auto_pilot / pause de chaque agent.

import { db } from "@/db";
import { agents, activities, inboundEmails, prospects, scoutSchedules, settings, type Agent } from "@/db/schema";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ensureAgentsSeeded } from "./agents";
import { getSetting } from "./settings";
import { logActivity } from "./activity";
import { notifyTelegram } from "./telegram";
import {
  runScoutMission, validateProspect, verifyProspectEmail, mapProspect,
  buildProspectSite, deployProspectSite, contactProspect,
} from "./pipeline";

export type TickSummary = {
  at: string;
  autopilot: boolean;
  missionsRun: number;
  advanced: Record<string, number>;
  errors: string[];
  evolved?: { agent: string; summary: string; skills: string[] };
  skipped?: string;
  deadlineReached?: boolean;
};

const TICK_LOCK_KEY = "TICK_LOCK";
const TICK_LOCK_STALE_MS = 10 * 60_000; // un tick planté libère le verrou après 10 min
// Avec un ping externe toutes les 10 min, chaque cycle doit rester borné bien
// sous le maxDuration de la fonction (300 s) : on s'arrête à 240 s, le tick
// suivant reprendra le lot là où il était (avancement sauvegardé lead par lead).
const TICK_DEADLINE_MS = 240_000;

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
  const summary: TickSummary = {
    at: new Date().toISOString(),
    autopilot: (await getSetting("AUTOPILOT")) === "true",
    missionsRun: 0,
    advanced: {},
    errors: [],
  };
  if (!summary.autopilot && !opts.force) return summary;

  const lease = await acquireTickLease();
  if (!lease) {
    return { ...summary, skipped: "tick déjà en cours (verrou actif)" };
  }
  try {
    return await runTickBody(summary);
  } finally {
    await releaseTickLease(lease);
  }
}

async function runTickBody(summary: TickSummary): Promise<TickSummary> {
  const cache = new Map<string, Agent>();
  const bump = (k: string) => { summary.advanced[k] = (summary.advanced[k] ?? 0) + 1; };
  const deadline = Date.now() + TICK_DEADLINE_MS;

  // Auto-réparation : un lead resté en "contacting" (crash en pleine tentative
  // d'envoi) retourne en "deployed" après 15 min d'inactivité.
  await db.update(prospects)
    .set({ stage: "deployed", updatedAt: new Date() })
    .where(and(eq(prospects.stage, "contacting"), lt(prospects.updatedAt, new Date(Date.now() - 15 * 60_000))));

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

  for (const step of steps) {
    if (Date.now() > deadline) { summary.deadlineReached = true; break; }
    if (!(await agentUsable(step.agent, cache))) continue;
    const batch = await take(step.stage, step.limit);
    for (const p of batch) {
      if (Date.now() > deadline) { summary.deadlineReached = true; break; }
      try {
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
  if (moved > 0 || summary.missionsRun > 0) {
    await notifyTelegram(
      `🤖 <b>Auto-pilote — cycle terminé</b>\n` +
        `Missions : ${summary.missionsRun} · Leads avancés : ${moved}` +
        (summary.evolved ? `\n🧬 ${summary.evolved.agent} a évolué : ${summary.evolved.summary.slice(0, 160)}` : "") +
        (summary.errors.length ? `\n⚠️ ${summary.errors.length} erreur(s), voir le journal.` : ""),
    );
  }
  return summary;
}
