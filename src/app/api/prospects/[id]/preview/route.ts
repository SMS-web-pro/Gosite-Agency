import { type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const rows = await db.select().from(prospects).where(eq(prospects.id, Number(id))).limit(1);
  const p = rows[0];
  if (!p?.siteHtml) {
    return new Response("<h1 style='font-family:sans-serif;padding:40px'>Site pas encore généré pour ce lead.</h1>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response(p.siteHtml, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
