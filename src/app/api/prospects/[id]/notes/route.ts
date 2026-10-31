import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { leadNotes } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const rows = await db.select().from(leadNotes).where(eq(leadNotes.prospectId, Number(id))).orderBy(desc(leadNotes.createdAt));
  return NextResponse.json({ notes: rows });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { body?: string; author?: string };
  const text = (body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "note vide" }, { status: 400 });
  const rows = await db.insert(leadNotes).values({
    prospectId: Number(id), author: body.author?.trim() || "RIO", body: text,
  }).returning();
  await logActivity({ agentKey: "rio", action: "note_ajoutee", message: `Note interne ajoutée au lead #${id}.`, level: "info", prospectId: Number(id) });
  return NextResponse.json({ ok: true, note: rows[0] });
}
