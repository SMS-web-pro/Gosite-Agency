import { type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { slug } = await ctx.params;
  const rows = await db
    .select({ siteHtml: prospects.siteHtml })
    .from(prospects)
    .where(eq(prospects.siteSlug, slug))
    .limit(1);
  const p = rows[0];
  if (!p?.siteHtml) {
    return new Response("<h1 style='font-family:sans-serif;padding:40px'>Site introuvable ou pas encore généré.</h1>", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new Response(p.siteHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "sandbox allow-scripts",
    },
  });
}
