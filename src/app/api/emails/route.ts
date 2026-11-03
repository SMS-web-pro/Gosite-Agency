import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { emails, prospects } from "@/db/schema";
import { and, desc, eq, type SQL } from "drizzle-orm";

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
    })
    .from(emails)
    .leftJoin(prospects, eq(emails.prospectId, prospects.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(emails.createdAt))
    .limit(50);
  return NextResponse.json({ emails: rows });
}
