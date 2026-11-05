import { NextResponse, type NextRequest } from "next/server";
import { runAutopilotTick } from "@/lib/autopilot";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function authorized(req: NextRequest): Promise<boolean> {
  // Vercel Cron envoie "Authorization: Bearer $CRON_SECRET" (variable configurée).
  // Pas de raccourci x-vercel-cron ni de ?secret= : ce header est forgeable.
  const secret = process.env.CRON_SECRET || (await getSetting("CRON_SECRET")) || "";
  if (!secret) return process.env.NODE_ENV !== "production"; // dev local seulement
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runAutopilotTick();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runAutopilotTick();
  return NextResponse.json({ ok: true, ...summary });
}
