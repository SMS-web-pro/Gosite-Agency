import { NextResponse, type NextRequest } from "next/server";
import { runAutopilotTick } from "@/lib/autopilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Déclenché depuis le tableau de bord RIO (pas de secret : console interne)
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "tick") return NextResponse.json({ error: "action=tick attendue" }, { status: 400 });
  const summary = await runAutopilotTick({ force: true });
  return NextResponse.json({ ok: true, ...summary });
}
