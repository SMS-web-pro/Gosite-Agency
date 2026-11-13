import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { prospectLightColumns } from "@/db/light";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const rows = await db
    .select({ ...prospectLightColumns, clientData: prospects.clientData })
    .from(prospects)
    .where(eq(prospects.id, Number(id)))
    .limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });
  return NextResponse.json({ prospect: rows[0] });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const rows = await db.select().from(prospects).where(eq(prospects.id, Number(id))).limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });
  await db.delete(prospects).where(eq(prospects.id, Number(id)));
  await logActivity({ agentKey: "rio", action: "lead_supprime", message: `RIO a supprimé le lead ${rows[0].businessName}.`, level: "warn" });
  return NextResponse.json({ ok: true });
}
