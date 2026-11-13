import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, prospects, activities, serperKeys } from "@/db/schema";
import { prospectLightColumns } from "@/db/light";
import { desc, asc, sql } from "drizzle-orm";
import { ensureAgentsSeeded } from "@/lib/agents";
import { getAllSettings, allowSimulation, getSetting } from "@/lib/settings";
import { STAGES } from "@/lib/pipeline";
import { scoutSchedules } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAgentsSeeded();
  const [allAgents, allProspects, recentActivity, keys, settingsData, schedules] = await Promise.all([
    db.select().from(agents).orderBy(asc(agents.sortOrder)),
    db.select(prospectLightColumns).from(prospects).orderBy(desc(prospects.createdAt)).limit(100),
    db.select().from(activities).orderBy(desc(activities.createdAt)).limit(40),
    db.select().from(serperKeys).orderBy(asc(serperKeys.createdAt)),
    getAllSettings(),
    db.select().from(scoutSchedules).orderBy(asc(scoutSchedules.createdAt)),
  ]);

  // Agrégats + répartition par étape en DEUX requêtes (avant : 5 + chargement
  // de tous les leads avec leurs bundles, ~18 Mo).
  const [aggRows, stageRows] = await Promise.all([
    db.select({
      total: sql<number>`count(*)::int`,
      qualified: sql<number>`count(*) filter (where ${prospects.stage} not in ('discovered','rejected'))::int`,
      sitesBuilt: sql<number>`count(*) filter (where ${prospects.siteHtml} is not null or ${prospects.siteBundle} is not null)::int`,
      contacted: sql<number>`count(*) filter (where ${prospects.contactedAt} is not null)::int`,
      paid: sql<number>`count(*) filter (where ${prospects.paymentStatus} in ('paid','simulated'))::int`,
    }).from(prospects),
    db
      .select({ stage: prospects.stage, n: sql<number>`count(*)::int` })
      .from(prospects)
      .groupBy(prospects.stage),
  ]);
  const agg = aggRows[0];

  const stageCounts: Record<string, number> = {};
  for (const s of [...STAGES, "rejected"]) stageCounts[s] = 0;
  for (const r of stageRows) stageCounts[r.stage] = (stageCounts[r.stage] ?? 0) + r.n;

  const integrations = {
    serper: keys.some((k) => k.status === "active" && !k.apiKey.startsWith("AUTO-POOL")),
    telegram: Boolean(settingsData.TELEGRAM_BOT_TOKEN),
    llm: Boolean(settingsData.LLM_BASE_URL && settingsData.LLM_API_KEY),
    brevo: Boolean(settingsData.BREVO_API_KEY && settingsData.BREVO_SENDER_EMAIL),
    vercel: Boolean(settingsData.VERCEL_TOKEN),
    whop: Boolean(settingsData.WHOP_API_KEY),
  };

  return NextResponse.json({
    agents: allAgents,
    prospects: allProspects,
    activity: recentActivity,
    serperKeys: keys.map((k) => ({ ...k, apiKey: `${k.apiKey.slice(0, 6)}••••${k.apiKey.slice(-4)}` })),
    stageCounts,
    kpis: {
      totalLeads: agg?.total ?? 0,
      qualified: agg?.qualified ?? 0,
      sitesBuilt: agg?.sitesBuilt ?? 0,
      deployed: stageCounts["deployed"] + stageCounts["contacted"] + stageCounts["paid"] + stageCounts["domain_linked"],
      contacted: agg?.contacted ?? 0,
      paid: agg?.paid ?? 0,
      rejected: stageCounts["rejected"],
      creditsUsed: keys.reduce((a, k) => a + k.creditsUsed, 0),
      creditsTotal: keys.reduce((a, k) => a + k.creditLimit, 0) || 2500,
    },
    integrations,
    allowSimulation: await allowSimulation(),
    autopilot: (await getSetting("AUTOPILOT")) === "true",
    schedules,
  });
}
