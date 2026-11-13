import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { objectives, prospects } from "@/db/schema";
import { and, asc, count, eq, isNotNull, ne } from "drizzle-orm";
import { ensureAgentsSeeded } from "@/lib/agents";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAgentsSeeded();
  // Compteurs en SQL : le select complet des prospects pesait ~18 Mo (bundles).
  const [rows, [leadsRow], [qualRow], [depRow], [conRow], [payRow]] = await Promise.all([
    db.select().from(objectives).orderBy(asc(objectives.createdAt)),
    db.select({ n: count() }).from(prospects),
    db.select({ n: count() }).from(prospects).where(and(ne(prospects.stage, "discovered"), ne(prospects.stage, "rejected"))),
    db.select({ n: count() }).from(prospects).where(isNotNull(prospects.deployedUrl)),
    db.select({ n: count() }).from(prospects).where(isNotNull(prospects.contactedAt)),
    db.select({ n: count() }).from(prospects).where(eq(prospects.paymentStatus, "paid")),
  ]);
  const metrics: Record<string, number> = {
    leads: leadsRow?.n ?? 0,
    qualified: qualRow?.n ?? 0,
    deployed: depRow?.n ?? 0,
    contacted: conRow?.n ?? 0,
    paid: payRow?.n ?? 0,
  };
  return NextResponse.json({
    objectives: rows.map((o) => ({ ...o, progress: metrics[o.metric] ?? 0 })),
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
