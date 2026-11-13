import { NextResponse, type NextRequest } from "next/server";
import { runScoutMission, runBulkValidation } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    niche?: string; city?: string; max?: number; strategy?: "precise" | "swarm"; autoValidate?: boolean; telegram?: boolean;
  };
  const niche = (body.niche ?? "").trim();
  const city = (body.city ?? "").trim();
  if (!niche || !city) return NextResponse.json({ error: "niche et city sont requis" }, { status: 400 });

  const strategy: "precise" | "swarm" = body.strategy === "precise" ? "precise" : "swarm";
  const max = strategy === "swarm" ? Math.min(body.max ?? 40, 60) : Math.min(body.max ?? 12, 25);

  try {
    const result = await runScoutMission(niche, city, max, { telegram: body.telegram ?? true, strategy });
    let validation = null;
    if (body.autoValidate) validation = await runBulkValidation();
    return NextResponse.json({ ok: true, ...result, validation });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Erreur";
    return NextResponse.json({ ok: false, error: raw.replace(/^BLOCKED:/, "") }, { status: 200 });
  }
}
