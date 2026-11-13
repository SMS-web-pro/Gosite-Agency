import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateFormSubmission, insertSiteLead, type FormValues } from "@/lib/form-receive";
import { resolveServices } from "@/lib/site-config";
import { sendAgentReply } from "@/lib/emailer";
import { notifyTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// CORS : le formulaire est posté depuis les sites clients (origines distinctes,
// ex. https://{slug}.vercel.app ou {slug}.gosite.digital) → préflight OPTIONS
// obligatoire + ACAO sur chaque réponse, sinon le fetch échoue côté navigateur.
function corsHeaders(req: NextRequest): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

// Rate limit in-memory : 5 requêtes/min/IP (site vitrine → largement assez ;
// protège Brevo et la DB d'un spammeur, sans dépendance externe). La Map est
// purgée périodiquement des IP inactives (endpoint public exposé à Internet).
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 200) for (const [k, v] of hits) if (v.every((t) => now - t >= 60_000)) hits.delete(k);
  const window = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  window.push(now);
  hits.set(ip, window);
  return window.length > 5;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const prospectId = Number(id);
    if (!Number.isFinite(prospectId)) return NextResponse.json({ ok: false, errors: ["Unknown business"] }, { status: 404, headers: corsHeaders(req) });

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json({ ok: false, errors: ["Too many requests — please call us instead."] }, { status: 429, headers: corsHeaders(req) });
    }

    const body = await req.json().catch(() => null);
    // Honeypot rempli → bot : réponse silencieuse positive, rien n'est traité.
    if (body && typeof body === "object" && String((body as Record<string, unknown>).website || "").length > 0) {
      return NextResponse.json({ ok: true }, { headers: corsHeaders(req) });
    }

    // Projection ciblée : le select complet chargeait le bundle (~2.7 Mo)
    // pour une simple soumission de formulaire.
    const rows = await db
      .select({
        id: prospects.id,
        businessName: prospects.businessName,
        siteSlug: prospects.siteSlug,
        deployedUrl: prospects.deployedUrl,
        clientData: prospects.clientData,
      })
      .from(prospects)
      .where(eq(prospects.id, prospectId))
      .limit(1);
    const p = rows[0];
    if (!p) return NextResponse.json({ ok: false, errors: ["Unknown business"] }, { status: 404, headers: corsHeaders(req) });

    // Services autorisés = mêmes titres que ceux affichés sur le site
    // (resolveServices : SERVICES + SERVICES_FULL + repli sectoriel).
    const sheet = p.clientData ?? {};
    const allowed = resolveServices(sheet).map((s) => s.title).filter(Boolean);

    const v = validateFormSubmission(body, allowed);
    if (!v.ok || !v.values) return NextResponse.json({ ok: false, errors: v.errors }, { status: 400, headers: corsHeaders(req) });
    const values: FormValues = v.values;

    await insertSiteLead(prospectId, values, ip);

    // Email au client (Brevo, réel) — silencieusement sauté si non configuré.
    const clientEmail = (sheet.EMAIL || "").trim();
    if (clientEmail && clientEmail.toLowerCase() !== "none") {
      const lang = (sheet.LANG || "fr").startsWith("en") ? "en" : "fr";
      const siteUrl = p.deployedUrl || (p.siteSlug ? `https://${p.siteSlug}.vercel.app` : "votre site");
      const lines =
        lang === "en"
          ? [
              `New request from your website (${siteUrl})`,
              "",
              `Name: ${values.name}`,
              `Phone: ${values.phone}`,
              values.email ? `Email: ${values.email}` : "",
              `ZIP: ${values.zip}`,
              `Service: ${values.service}`,
              "",
              "Message:",
              values.message,
            ]
              .filter(Boolean)
              .join("\n")
          : [
              `Nouvelle demande depuis votre site (${siteUrl})`,
              "",
              `Nom : ${values.name}`,
              `Téléphone : ${values.phone}`,
              values.email ? `Email : ${values.email}` : "",
              `Code postal : ${values.zip}`,
              `Service : ${values.service}`,
              "",
              "Message :",
              values.message,
            ]
              .filter(Boolean)
              .join("\n");
      await sendAgentReply({
        to: clientEmail,
        subject: lang === "en" ? `Website request — ${values.name}` : `Demande site web — ${values.name}`,
        bodyText: lines,
        lang,
      }).catch(() => {});
    }

    await notifyTelegram(`📥 <b>Site lead</b> — ${p.businessName}\n${values.name} · ${values.phone}\n${values.service}`).catch(() => {});

    return NextResponse.json({ ok: true }, { headers: corsHeaders(req) });
  } catch (err) {
    console.error("[site-form] erreur:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, errors: ["Something went wrong — please call us."] }, { status: 500, headers: corsHeaders(req) });
  }
}
