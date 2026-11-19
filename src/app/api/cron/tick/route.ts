import { after, NextResponse, type NextRequest } from "next/server";
import { runAutopilotTick } from "@/lib/autopilot";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorized(req: NextRequest): Promise<boolean> {
  // UN seul canal : "Authorization: Bearer $CRON_SECRET". Les query strings
  // apparaissent dans les logs serveur, analytics, referers et historiques —
  // l'auth par ?key=… a été supprimée (spec refonte 1.2). Le secret peut venir
  // de DEUX sources (var d'env Vercel ou Réglages/DB) : les deux sont
  // acceptées — sinon la régénération coupe le moniteur externe en 401.
  // Pas de raccourci x-vercel-cron : ce header est forgeable.
  const candidates = new Set(
    [process.env.CRON_SECRET, await getSetting("CRON_SECRET")].filter((v): v is string => Boolean(v?.trim())),
  );
  if (candidates.size === 0) return process.env.NODE_ENV !== "production"; // dev local seulement
  const auth = req.headers.get("authorization");
  return Boolean(auth) && [...candidates].some((s) => auth === `Bearer ${s}`);
}

// Le pipeline dure jusqu'à 45 s + un déploiement Cloudflare peut dépasser la
// minute : exécuté en réponse, la fonction mourait en FUNCTION_INVOCATION_TIMEOUT
// (504) et le tick semblait en panne. `after()` renvoie la réponse tout de
// suite et laisse le pipeline tourner dans la durée de vie restante de la
// fonction (60 s max sur Hobby) — les déploiements débordants repartent au
// tick suivant (le lead reste site_built, sans incrément de failCount).
// Spec 1.5 : le tick ne doit jamais mourir silencieusement dans after().
// runAutopilotTick gère déjà ses erreurs internes ; ce garde-fou couvre les
// échecs survenus AVANT (DB down, verrou, seed agents) et les trace en DB.
async function runTickSafely(): Promise<void> {
  try {
    await runAutopilotTick();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      const { logActivity } = await import("@/lib/activity");
      await logActivity({
        agentKey: "autopilot",
        action: "tick_erreur",
        message: `Tick non démarré : ${msg}`.slice(0, 300),
        level: "error",
      });
    } catch {
      console.error("[cron/tick] tick failed:", msg);
    }
  }
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  after(runTickSafely);
  return NextResponse.json({ ok: true, queued: true });
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  after(runTickSafely);
  return NextResponse.json({ ok: true, queued: true });
}
