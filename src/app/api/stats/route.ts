import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents, prospects, activities, serperKeys } from "@/db/schema";
import { desc, asc, eq } from "drizzle-orm";
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
    db.select().from(prospects).orderBy(desc(prospects.createdAt)),
    db.select().from(activities).orderBy(desc(activities.createdAt)).limit(40),
    db.select().from(serperKeys).orderBy(asc(serperKeys.createdAt)),
    getAllSettings(),
    db.select().from(scoutSchedules).orderBy(asc(scoutSchedules.createdAt)),
  ]);

  const stageCounts: Record<string, number> = {};
  for (const s of [...STAGES, "rejected"]) stageCounts[s] = 0;
  for (const p of allProspects) stageCounts[p.stage] = (stageCounts[p.stage] ?? 0) + 1;

  const paidCount = allProspects.filter((p) => p.paymentStatus === "paid" || p.paymentStatus === "simulated").length;
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
    prospects: allProspects.slice(0, 100),
    activity: recentActivity,
    serperKeys: keys,
    stageCounts,
    kpis: {
      totalLeads: allProspects.length,
      qualified: allProspects.filter((p) => p.stage !== "discovered" && p.stage !== "rejected").length,
      sitesBuilt: allProspects.filter((p) => p.siteHtml).length,
      deployed: stageCounts["deployed"] + stageCounts["contacted"] + stageCounts["paid"] + stageCounts["domain_linked"],
      contacted: allProspects.filter((p) => p.contactedAt).length,
      paid: paidCount,
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
