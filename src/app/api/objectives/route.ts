import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { objectives, prospects } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { ensureAgentsSeeded } from "@/lib/agents";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function progressFor(metric: string, all: (typeof prospects.$inferSelect)[]): number {
  switch (metric) {
    case "leads": return all.length;
    case "qualified": return all.filter((p) => p.stage !== "discovered" && p.stage !== "rejected").length;
    case "deployed": return all.filter((p) => p.deployedUrl).length;
    case "contacted": return all.filter((p) => p.contactedAt).length;
    default: return all.filter((p) => p.paymentStatus === "paid").length;
  }
}

export async function GET() {
  await ensureAgentsSeeded();
  const [rows, all] = await Promise.all([
    db.select().from(objectives).orderBy(asc(objectives.createdAt)),
    db.select().from(prospects),
  ]);
  return NextResponse.json({
    objectives: rows.map((o) => ({ ...o, progress: progressFor(o.metric, all) })),
  });
}

export async function POST(req: NextRequest) {
  await ensureAgentsSeeded();
  const body = (await req.json().catch(() => ({}))) as { title?: string; metric?: string; target?: number; id?: number; status?: string };
  if (body.id && body.status) {
    await db.update(objectives).set({ status: body.status }).where(eq(objectives.id, body.id));
    return NextResponse.json({ ok: true });
  }
  const title = (body.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "titre requis" }, { status: 400 });
  const rows = await db.insert(objectives).values({
    title,
    metric: body.metric ?? "paid",
    target: Math.max(1, body.target ?? 10),
  }).returning();
  await logActivity({ agentKey: "rio", action: "objectif_cree", message: `Objectif fixé : ${title} (${rows[0].target} ${rows[0].metric}).`, level: "success" });
  return NextResponse.json({ ok: true, objective: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await db.delete(objectives).where(eq(objectives.id, id));
  return NextResponse.json({ ok: true });
}
