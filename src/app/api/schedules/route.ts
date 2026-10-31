import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { scoutSchedules } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity";
import { ensureAgentsSeeded } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAgentsSeeded();
  const rows = await db.select().from(scoutSchedules).orderBy(asc(scoutSchedules.createdAt));
  return NextResponse.json({ schedules: rows });
}

export async function POST(req: NextRequest) {
  await ensureAgentsSeeded();
  const body = (await req.json().catch(() => ({}))) as {
    niche?: string; city?: string; intervalHours?: number; maxResults?: number; id?: number; active?: boolean;
  };
  // Toggle active
  if (typeof body.id === "number" && typeof body.active === "boolean") {
    await db.update(scoutSchedules).set({ active: body.active }).where(eq(scoutSchedules.id, body.id));
    return NextResponse.json({ ok: true });
  }
  const niche = (body.niche ?? "").trim();
  const city = (body.city ?? "").trim();
  if (!niche || !city) return NextResponse.json({ error: "niche et city requis" }, { status: 400 });
  const rows = await db.insert(scoutSchedules).values({
    niche, city,
    intervalHours: Math.min(Math.max(body.intervalHours ?? 6, 1), 168),
    maxResults: Math.min(Math.max(body.maxResults ?? 12, 5), 25),
  }).returning();
  await logActivity({
    agentKey: "rio", action: "planification",
    message: `RIO a planifié une mission récurrente : "${niche} / ${city}" toutes les ${rows[0].intervalHours}h.`, level: "success",
  });
  return NextResponse.json({ ok: true, schedule: rows[0] });
}

export async function DELETE(req: NextRequest) {
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await db.delete(scoutSchedules).where(eq(scoutSchedules.id, id));
  await logActivity({ agentKey: "rio", action: "planification_supprimee", message: `Planification #${id} supprimée.`, level: "warn" });
  return NextResponse.json({ ok: true });
}
