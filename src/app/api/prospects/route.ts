import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stage = req.nextUrl.searchParams.get("stage");
  const rows = stage
    ? await db.select().from(prospects).where(eq(prospects.stage, stage)).orderBy(desc(prospects.createdAt)).limit(200)
    : await db.select().from(prospects).orderBy(desc(prospects.createdAt)).limit(200);
  // Strip heavy HTML payload from list responses
  const light = rows.map(({ siteHtml: _h, ...rest }) => ({ ...rest, hasSite: Boolean(_h) }));
  return NextResponse.json({ prospects: light });
}
