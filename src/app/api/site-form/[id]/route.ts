import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateFormSubmission, insertSiteLead, type FormValues } from "@/lib/form-receive";
import { sendAgentReply } from "@/lib/emailer";
import { notifyTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

// Rate limit in-memory : 5 requêtes/min/IP (site vitrine → largement assez ;
// protège Brevo et la DB d'un spammeur, sans dépendance externe).
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  window.push(now);
  hits.set(ip, window);
  return window.length > 5;
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const prospectId = Number(id);
    if (!Number.isFinite(prospectId)) return NextResponse.json({ ok: false, errors: ["Unknown business"] }, { status: 404 });

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    if (rateLimited(ip)) {
      return NextResponse.json({ ok: false, errors: ["Too many requests — please call us instead."] }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    // Honeypot rempli → bot : réponse silencieuse positive, rien n'est traité.
    if (body && typeof body === "object" && String((body as Record<string, unknown>).website || "").length > 0) {
      return NextResponse.json({ ok: true });
    }

    const rows = await db.select().from(prospects).where(eq(prospects.id, prospectId)).limit(1);
    const p = rows[0];
    if (!p) return NextResponse.json({ ok: false, errors: ["Unknown business"] }, { status: 404 });

    // Services autorisés = titres du champ SERVICES (+ SERVICES_FULL si présent).
    const sheet = p.clientData ?? {};
    const allowed: string[] = [];
    for (const key of ["SERVICES", "SERVICES_FULL"]) {
      try {
        const list = JSON.parse(String(sheet[key] || "[]")) as { title?: string }[];
        if (Array.isArray(list)) for (const it of list) if (typeof it?.title === "string" && it.title) allowed.push(it.title);
      } catch { /* champ invalide → ignore */ }
    }

    const v = validateFormSubmission(body, allowed);
    if (!v.ok || !v.values) return NextResponse.json({ ok: false, errors: v.errors }, { status: 400 });
    const values: FormValues = v.values;

    await insertSiteLead(prospectId, values, ip);

    // Email au client (Brevo, réel) — silencieusement sauté si non configuré.
    const clientEmail = (sheet.EMAIL || "").trim();
    if (clientEmail && clientEmail.toLowerCase() !== "none") {
      const lang = (sheet.LANG || "fr").startsWith("en") ? "en" : "fr";
      const lines =
        lang === "en"
          ? [
              `New request from your website (${p.siteSlug ? `https://${p.siteSlug}.vercel.app` : p.deployedUrl || "your site"})`,
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
              `Nouvelle demande depuis votre site (${p.siteSlug ? `https://${p.siteSlug}.vercel.app` : p.deployedUrl || "votre site"})`,
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[site-form] erreur:", err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, errors: ["Something went wrong — please call us."] }, { status: 500 });
  }
}
