// Auto-pilote 24/7 — exécute des cycles complets sans intervention de RIO :
// 1) missions de prospection planifiées (scout_schedules)
// 2) avancement automatique du pipeline, étape par étape, en respectant les
//    interrupteurs auto_pilot / pause de chaque agent.

import { db } from "@/db";
import { agents, prospects, scoutSchedules, type Agent } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
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
};

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

  const cache = new Map<string, Agent>();
  const bump = (k: string) => { summary.advanced[k] = (summary.advanced[k] ?? 0) + 1; };

  // ── 1) Missions planifiées ──
  if (await agentUsable("prospector", cache)) {
    const schedules = await db.select().from(scoutSchedules).where(eq(scoutSchedules.active, true)).orderBy(asc(scoutSchedules.lastRunAt));
    for (const s of schedules.slice(0, 2)) {
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
    if (!(await agentUsable(step.agent, cache))) continue;
    const batch = await take(step.stage, step.limit);
    for (const p of batch) {
      try {
        await step.fn(p);
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
      }
    }
  }

  // ── 3) Auto-amélioration : un agent évolue à chaque cycle (rotation) ──
  try {
    const { brainOnline, evolveAgent } = await import("./agent-brain");
    if (await brainOnline()) {
      const roster = ["prospector", "validator", "emailor", "mapper", "coder", "deployer", "saler", "paymer", "domainner", "support"];
      const pick = roster[new Date().getHours() % roster.length];
      const evo = await evolveAgent(pick);
      if (evo.ok) summary.evolved = { agent: pick, summary: evo.summary, skills: evo.skills };
    }
  } catch (err) {
    summary.errors.push(`evolution: ${err instanceof Error ? err.message : "?"}`);
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
