import { NextResponse, type NextRequest } from "next/server";
import { runAutopilotTick } from "@/lib/autopilot";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function authorized(req: NextRequest): Promise<boolean> {
  // Vercel Cron envoie "Authorization: Bearer $CRON_SECRET" si la variable existe,
  // et toujours l'en-tête x-vercel-cron pour ses appels planifiés.
  if (req.headers.get("x-vercel-cron")) return true;
  const secret = (await getSetting("CRON_SECRET")) || process.env.CRON_SECRET || "";
  if (!secret) return process.env.NODE_ENV !== "production"; // dev local seulement
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
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
