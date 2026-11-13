import { type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  // Projection ciblée : le select complet chargeait le bundle (~2.7 Mo) pour rien.
  const rows = await db
    .select({ siteHtml: prospects.siteHtml })
    .from(prospects)
    .where(eq(prospects.id, Number(id)))
    .limit(1);
  const p = rows[0];
  if (!p?.siteHtml) {
    return new Response("<h1 style='font-family:sans-serif;padding:40px'>Site pas encore généré pour ce lead.</h1>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response(p.siteHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      // Le HTML vient du LLM : isolé dans une origine opaque (anti-XSS same-origin),
      // scripts autorisés car les sites générés en utilisent.
      "Content-Security-Policy": "sandbox allow-scripts",
    },
  });
}
