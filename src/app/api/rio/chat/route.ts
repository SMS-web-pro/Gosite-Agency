import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { rioMessages } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { askRio } from "@/lib/rio";
import { ensureAgentsSeeded } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  await ensureAgentsSeeded();
  const rows = await db
    .select()
    .from(rioMessages)
    .where(eq(rioMessages.channel, "web"))
    .orderBy(desc(rioMessages.createdAt))
    .limit(60);
  return NextResponse.json({ messages: rows.reverse() });
}

export async function POST(req: NextRequest) {
  await ensureAgentsSeeded();
  const body = (await req.json().catch(() => ({}))) as { message?: string };
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "message requis" }, { status: 400 });
  try {
    const turn = await askRio(message, "web");
    return NextResponse.json({ ok: true, ...turn });
  } catch (err) {
    return NextResponse.json({ ok: false, reply: `Erreur interne : ${err instanceof Error ? err.message : "?"}`, toolCalls: [], engine: "rules" });
  }
}

export async function DELETE() {
  await db.delete(rioMessages).where(eq(rioMessages.channel, "web"));
  return NextResponse.json({ ok: true });
}
