import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { emails, prospects } from "@/db/schema";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const prospectId = req.nextUrl.searchParams.get("prospectId");
  const conds: SQL[] = [];
  if (status) conds.push(eq(emails.status, status));
  if (prospectId) conds.push(eq(emails.prospectId, Number(prospectId)));
  const rows = await db
    .select({
      id: emails.id,
      prospectId: emails.prospectId,
      toEmail: emails.toEmail,
      subject: emails.subject,
      status: emails.status,
      error: emails.error,
      messageId: emails.messageId,
      createdAt: emails.createdAt,
      businessName: prospects.businessName,
      openedAt: emails.openedAt,
      opens: emails.opens,
      clicks: emails.clicks,
      clickSite: emails.clickSite,
      clickPayment: emails.clickPayment,
      lastClickAt: emails.lastClickAt,
      lastClickUrl: emails.lastClickUrl,
      token: emails.token,
    })
    .from(emails)
    .leftJoin(prospects, eq(emails.prospectId, prospects.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(emails.createdAt))
    .limit(50);

  // Chiffres réels sur TOUT l'historique (au-delà des 50 dernières lignes).
  const [agg] = (await db
    .select({
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${emails.status} = 'sent')::int`,
      backfilled: sql<number>`count(*) filter (where ${emails.status} = 'backfilled')::int`,
      simulated: sql<number>`count(*) filter (where ${emails.status} = 'simulated')::int`,
      failed: sql<number>`count(*) filter (where ${emails.status} = 'failed')::int`,
      agentReply: sql<number>`count(*) filter (where ${emails.status} = 'agent_reply')::int`,
      openedUnique: sql<number>`count(*) filter (where ${emails.openedAt} is not null)::int`,
      opensTotal: sql<number>`coalesce(sum(${emails.opens}), 0)::int`,
      clicksTotal: sql<number>`coalesce(sum(${emails.clicks}), 0)::int`,
      clickSiteTotal: sql<number>`coalesce(sum(${emails.clickSite}), 0)::int`,
      clickPaymentTotal: sql<number>`coalesce(sum(${emails.clickPayment}), 0)::int`,
    })
    .from(emails)) as unknown as [{ total: number; sent: number; backfilled: number; simulated: number; failed: number; agentReply: number; openedUnique: number; opensTotal: number; clicksTotal: number; clickSiteTotal: number; clickPaymentTotal: number }];

  return NextResponse.json({ emails: rows, stats: agg ?? { total: 0 } });
}

/** Suppression de TOUTES les archives d'emails (ordre explicite de l'opérateur). */
export async function DELETE() {
  const j = await db.delete(emails).returning();
  return NextResponse.json({ ok: true, deleted: j.length });
}
