import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agentSkills, agentLearnings } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { ensureCoreSkills, aiStatsFor } from "@/lib/agent-brain";
import { logActivity } from "@/lib/activity";
import { ensureAgentsSeeded } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { key } = await ctx.params;
  await ensureAgentsSeeded();
  await ensureCoreSkills();
  const [skills, learnings, ai] = await Promise.all([
    db.select().from(agentSkills).where(eq(agentSkills.agentKey, key)).orderBy(desc(agentSkills.createdAt)),
    db.select().from(agentLearnings).where(eq(agentLearnings.agentKey, key)).orderBy(desc(agentLearnings.createdAt)).limit(12),
    aiStatsFor(key),
  ]);
  return NextResponse.json({ skills, learnings, ai });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { key } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { title?: string; instruction?: string; id?: number; active?: boolean };

  // Toggle d'une compétence existante
  if (typeof body.id === "number" && typeof body.active === "boolean") {
    await db.update(agentSkills).set({ active: body.active }).where(and(eq(agentSkills.id, body.id), eq(agentSkills.agentKey, key)));
    return NextResponse.json({ ok: true });
  }

  const title = (body.title ?? "").trim();
  const instruction = (body.instruction ?? "").trim();
  if (!title || !instruction) return NextResponse.json({ error: "titre et instruction requis" }, { status: 400 });

  const rows = await db.insert(agentSkills).values({
    agentKey: key, title: title.slice(0, 80), instruction: instruction.slice(0, 800), source: "user",
  }).returning();
  await logActivity({
    agentKey: key, action: "skill_ajoutee",
    message: `Nouvelle compétence enseignée par RIO : « ${title} »`, level: "success",
  });
  return NextResponse.json({ ok: true, skill: rows[0] });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { key } = await ctx.params;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await db.delete(agentSkills).where(and(eq(agentSkills.id, id), eq(agentSkills.agentKey, key)));
  return NextResponse.json({ ok: true });
}
