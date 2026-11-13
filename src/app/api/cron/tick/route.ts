import { NextResponse, type NextRequest } from "next/server";
import { runAutopilotTick } from "@/lib/autopilot";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorized(req: NextRequest): Promise<boolean> {
  // Trois canaux d'authentification, le secret peut venir de DEUX sources :
  // 1) Vercel Cron : "Authorization: Bearer $CRON_SECRET" (var d'env Vercel).
  // 2) Moniteurs externes (cron-job.org, UptimeRobot) : "GET …?key=$CRON_SECRET".
  // 3) Le secret peut être régénéré dans Réglages (DB) : les deux valeurs sont
  //    acceptées — sinon la régénération coupe le moniteur externe en 401 et
  //    le pipeline automatique s'arrête sans warning.
  // Pas de raccourci x-vercel-cron : ce header est forgeable.
  const candidates = new Set(
    [process.env.CRON_SECRET, await getSetting("CRON_SECRET")].filter((v): v is string => Boolean(v?.trim())),
  );
  if (candidates.size === 0) return process.env.NODE_ENV !== "production"; // dev local seulement
  const auth = req.headers.get("authorization");
  if (auth && [...candidates].some((s) => auth === `Bearer ${s}`)) return true;
  const urlKey = req.nextUrl.searchParams.get("key");
  return Boolean(urlKey) && candidates.has(urlKey);
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
