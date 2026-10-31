import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ key: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { key } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const rows = await db.select().from(agents).where(eq(agents.key, key)).limit(1);
  const agent = rows[0];
  if (!agent) return NextResponse.json({ error: "Agent inconnu" }, { status: 404 });

  if (body.action === "pause" || body.action === "resume") {
    const status = body.action === "pause" ? "paused" : "ready";
    await db.update(agents).set({ status, updatedAt: new Date() }).where(eq(agents.key, key));
    await logActivity({
      agentKey: "rio", action: body.action === "pause" ? "agent_pause" : "agent_reprise",
      message: `RIO a ${body.action === "pause" ? "mis en pause" : "réactivé"} ${agent.name}.`,
      level: "info",
    });
    return NextResponse.json({ ok: true, status });
  }
  if (body.action === "autopilot") {
    const next = !agent.autoPilot;
    await db.update(agents).set({ autoPilot: next, updatedAt: new Date() }).where(eq(agents.key, key));
    return NextResponse.json({ ok: true, autoPilot: next });
  }
  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
