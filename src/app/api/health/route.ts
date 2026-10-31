import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true, service: "gosite-digital", db: "up", ts: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false, service: "gosite-digital", db: "down" }, { status: 503 });
  }
}
