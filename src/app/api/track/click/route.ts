import { NextResponse, type NextRequest } from "next/server";
import { classifyClick } from "@/lib/track";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Redirection de clic : enregistre la destination (site vs paiement) puis
 *  302 vers l'URL réelle. Token inconnu → on redirige quand même (UX > stats). */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  const u = req.nextUrl.searchParams.get("u");
  let target = u ?? "";
  try {
    if (target && new URL(target).protocol.startsWith("http")) {
      const kind = classifyClick(target);
      if (t && /^[a-f0-9]{32}$/.test(t)) {
        await db
          .update(emails)
          .set({
            clicks: sql`${emails.clicks} + 1`,
            clickSite: kind === "site" ? sql`${emails.clickSite} + 1` : emails.clickSite,
            clickPayment: kind === "payment" ? sql`${emails.clickPayment} + 1` : emails.clickPayment,
            lastClickAt: sql`now()`,
            lastClickUrl: target.slice(0, 300),
          })
          .where(eq(emails.token, t));
      }
      return NextResponse.redirect(target, 302);
    }
  } catch {
    // URL invalide → tombée en dessous : retour toujour propre
  }
  return NextResponse.redirect(new URL("/", req.url), 302);
}
