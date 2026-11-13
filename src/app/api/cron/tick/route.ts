import { NextResponse, type NextRequest } from "next/server";
import { runAutopilotTick } from "@/lib/autopilot";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorized(req: NextRequest): Promise<boolean> {
  // Deux canaux d'authentification, même secret :
  // 1) Vercel Cron : "Authorization: Bearer $CRON_SECRET" (configuré côté Vercel).
  // 2) Moniteurs externes (cron-job.org, UptimeRobot, etc.) qui ne peuvent pas
  //    envoyer de header : "GET /api/cron/tick?key=$CRON_SECRET".
  // Pas de raccourci x-vercel-cron : ce header est forgeable.
  const secret = process.env.CRON_SECRET || (await getSetting("CRON_SECRET")) || "";
  if (!secret) return process.env.NODE_ENV !== "production"; // dev local seulement
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  const urlKey = req.nextUrl.searchParams.get("key");
  return Boolean(urlKey) && urlKey === secret;
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
