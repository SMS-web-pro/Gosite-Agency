// Étapes lourdes du pipeline (coder + deployer) — appelé PARALLÈLEMENT au tick
// par le cron externe. Le tick général est asphyxié par les étapes amont
// (validator/emailor/mapper pleines de leads frais : LLM + Serper par lead) et
// la fonction serverless meurt à 60 s avant que coder/deployer ne finissent.
// Ici : 1 build (budget-aware, fallback déterministe garanti v6) puis, s'il
// reste du temps, 1 déploiement Cloudflare. Réponse immédiate sinon 504.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { buildProspectSite, deployProspectSite } from "@/lib/pipeline";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorized(req: NextRequest): Promise<boolean> {
  // UN seul canal : "Authorization: Bearer $CRON_SECRET" (env Vercel ou DB).
  // Auth par query string supprimée (spec refonte 1.2).
  const candidates = new Set(
    [process.env.CRON_SECRET, await getSetting("CRON_SECRET")].filter((v): v is string => Boolean(v?.trim())),
  );
  if (candidates.size === 0) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  return Boolean(auth) && [...candidates].some((s) => auth === `Bearer ${s}`);
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const t0 = Date.now();
  let built = "";
  let deployed = "";
  let error = "";
  try {
    // Déployer D'ABORD (rapide, ~15-20 s) : un site_built passe en ligne, un
    // bundle obsolète est démôté au coder (instantané). Le build vient ensuite
    // si le budget le permet — chaque appel avance ainsi sur DEUX fronts.
    const sb = await db.select().from(prospects).where(eq(prospects.stage, "site_built")).orderBy(asc(prospects.createdAt)).limit(1);
    if (sb[0]) {
      await deployProspectSite(sb[0]);
      deployed = String(sb[0].id);
    }
    // Un build peut consommer ~30 s (budget Gemini dynamique) : ne le lancer
    // que s'il reste de la marge dans les 60 s.
    if (Date.now() - t0 < 25_000) {
      const mapped = await db.select().from(prospects).where(eq(prospects.stage, "mapped")).orderBy(asc(prospects.createdAt)).limit(1);
      if (mapped[0]) {
        await buildProspectSite(mapped[0]);
        built = String(mapped[0].id);
      }
    }
} catch (err) {
    error = err instanceof Error ? err.message.slice(0, 160) : "?";
  }
  return NextResponse.json({ ok: !error, built, deployed, error, ms: Date.now() - t0 });
}
