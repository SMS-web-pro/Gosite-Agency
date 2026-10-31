import { NextResponse } from "next/server";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { asc } from "drizzle-orm";
import { ensureAgentsSeeded } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensureAgentsSeeded();
  const rows = await db.select().from(agents).orderBy(asc(agents.sortOrder));
  return NextResponse.json({ agents: rows });
}
