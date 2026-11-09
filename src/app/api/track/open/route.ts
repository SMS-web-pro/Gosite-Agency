import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { emails } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Pixel d'ouverture : 1 requête image = 1 enregistrement (1ʳᵉ ouverture datée). */
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t");
  if (t && /^[a-f0-9]{32}$/.test(t)) {
    try {
      await db
        .update(emails)
        .set({
          openedAt: sql`coalesce(${emails.openedAt}, now())`,
          opens: sql`${emails.opens} + 1`,
        })
        .where(eq(emails.token, t));
    } catch {
      // jamais bloquer l'image
    }
  }
  return new NextResponse(GIF, {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" },
  });
}
