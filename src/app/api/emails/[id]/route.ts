import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { emails, prospects } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const rows = await db
    .select({
      email: emails,
      businessName: prospects.businessName,
    })
    .from(emails)
    .leftJoin(prospects, eq(emails.prospectId, prospects.id))
    .where(eq(emails.id, Number(id)))
    .limit(1);
  if (!rows[0]) return NextResponse.json({ error: "Email introuvable" }, { status: 404 });
  return NextResponse.json({ email: { ...rows[0].email, businessName: rows[0].businessName } });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const j = await db.delete(emails).where(eq(emails.id, Number(id))).returning();
  if (j.length === 0) return NextResponse.json({ error: "Email introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true, deleted: j.length });
}
