import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  validateProspect, verifyProspectEmail, mapProspect, buildProspectSite,
  deployProspectSite, contactProspect, createPaymentLink, linkProspectDomain,
  runFullPipeline,
} from "@/lib/pipeline";
import { logActivity } from "@/lib/activity";
import { notifyTelegram } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; domain?: string };
  const rows = await db.select().from(prospects).where(eq(prospects.id, Number(id))).limit(1);
  const p = rows[0];
  if (!p) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });

  try {
    switch (body.action) {
      case "validate": {
        const r = await validateProspect(p);
        return NextResponse.json({ ok: r.ok, reason: r.reason });
      }
      case "verify": {
        const r = await verifyProspectEmail(p);
        return NextResponse.json({ ok: r.ok, check: r.check });
      }
      case "map": {
        const sheet = await mapProspect(p);
        return NextResponse.json({ ok: true, sheet });
      }
      case "build": {
        const r = await buildProspectSite(p);
        return NextResponse.json({ ok: true, engine: r.engine, slug: r.slug });
      }
      case "deploy": {
        const r = await deployProspectSite(p);
        return NextResponse.json({ ok: true, url: r.url, mode: r.mode });
      }
      case "contact": {
        const r = await contactProspect(p);
        return NextResponse.json({ ok: true, simulated: r.simulated, messageId: r.messageId });
      }
      case "payment": {
        const r = await createPaymentLink(p);
        return NextResponse.json({ ok: true, url: r.url, simulated: r.simulated });
      }
      case "domain": {
        const r = await linkProspectDomain(p, body.domain);
        return NextResponse.json({ ok: true, url: r.url, mode: r.mode });
      }
      case "mark_paid": {
        await db.update(prospects).set({ paymentStatus: "paid", stage: p.stage === "contacted" || p.stage === "deployed" ? "paid" : p.stage, updatedAt: new Date() }).where(eq(prospects.id, p.id));
        await logActivity({ agentKey: "paymer", action: "paiement_recu", message: `Paiement confirmé pour ${p.businessName} — RIO notifié.`, level: "success", prospectId: p.id });
        await notifyTelegram(`💰 <b>PAIEMENT REÇU</b> — <b>${p.businessName}</b> a payé. Paymer a validé la transaction, Domainner peut lier le domaine.`);
        return NextResponse.json({ ok: true });
      }
      case "full":
      default: {
        const r = await runFullPipeline(p, { telegram: true });
        return NextResponse.json(r);
      }
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Erreur" }, { status: 200 });
  }
}
