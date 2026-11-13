import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity";
import { notifyTelegram } from "@/lib/telegram";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Webhook Whop "payment_succeeded" — marque le lead comme payé et notifie RIO.
// Configurez l'URL dans Whop : <APP>/api/webhooks/whop?secret=<CRON_SECRET>
export async function POST(req: NextRequest) {
  // Secret partagé dans l'URL du webhook (Whop ne signe pas ses payloads ici).
  const secret = process.env.CRON_SECRET || (await getSetting("CRON_SECRET"));
  if (secret && req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const meta = (payload.metadata ?? (payload.data as Record<string, unknown>)?.metadata ?? {}) as Record<string, unknown>;
  const id = Number(meta.prospect_id ?? NaN);
  if (!id) return NextResponse.json({ ok: true, ignored: "no prospect_id in metadata" });

  const rows = await db
    .select({ id: prospects.id, businessName: prospects.businessName, stage: prospects.stage })
    .from(prospects)
    .where(eq(prospects.id, id))
    .limit(1);
  const p = rows[0];
  if (!p) return NextResponse.json({ error: "lead introuvable" }, { status: 404 });

  await db.update(prospects).set({
    paymentStatus: "paid",
    stage: p.stage === "contacted" || p.stage === "deployed" ? "paid" : p.stage,
    updatedAt: new Date(),
  }).where(eq(prospects.id, id));

  await logActivity({
    agentKey: "paymer", action: "paiement_recu",
    message: `Webhook Whop : paiement confirmé pour ${p.businessName}.`,
    level: "success", prospectId: id,
  });
  await notifyTelegram(
    `💰 <b>PAIEMENT WHOP CONFIRMÉ</b>\n<b>${p.businessName}</b> vient de payer. Domainner peut maintenant lier son domaine.`,
  );
  return NextResponse.json({ ok: true, markedPaid: id });
}
