import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { prospectLightColumns } from "@/db/light";
import { desc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stage = req.nextUrl.searchParams.get("stage");
  const base = db.select(prospectLightColumns).from(prospects);
  const rows = stage
    ? await base.where(eq(prospects.stage, stage)).orderBy(desc(prospects.createdAt)).limit(200)
    : await base.orderBy(desc(prospects.createdAt)).limit(200);
  return NextResponse.json({ prospects: rows });
}
