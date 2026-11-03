import { NextResponse } from "next/server";
import { db } from "@/db";
import { emails, prospects } from "@/db/schema";
import { isNotNull, inArray } from "drizzle-orm";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Rétro-complétion : récupère le contenu des emails déjà envoyés (avant
// l'existence de l'archive) via l'API Brevo, par message_id. Idempotent :
// les message_id déjà archivés sont sautés ; par lot de 25 par appel.
export async function POST() {
  const empty = { fetched: 0, archived: 0, skipped: 0, missing: 0 };
  const key = (await getSetting("BREVO_API_KEY")) || process.env.BREVO_API_KEY;
  if (!key) return NextResponse.json({ error: "BREVO_API_KEY non configurée (Réglages → Brevo)", ...empty });

  const cands = await db
    .select({ id: prospects.id, email: prospects.email, messageId: prospects.salesEmailId })
    .from(prospects)
    .where(isNotNull(prospects.salesEmailId))
    .limit(100);
  const withMsg = cands.filter((c): c is { id: number; email: string | null; messageId: string } => Boolean(c.messageId));
  if (!withMsg.length) return NextResponse.json({ fetched: 0, archived: 0, skipped: 0, missing: 0 });

  const known = new Set(
    (await db.select({ m: emails.messageId }).from(emails).where(inArray(emails.messageId, withMsg.map((c) => c.messageId)))).map((r) => r.m),
  );
  const todo = withMsg.filter((c) => !known.has(c.messageId)).slice(0, 25);

  const counts = { fetched: 0, archived: 0, skipped: 0, missing: 0 };
  const startedAt = Date.now();
  for (const c of todo) {
    // Budget temps serverless : on s'arrête avant le plafond de la fonction, le
    // reste sera traité au prochain appel (l'opération est idempotente).
    if (Date.now() - startedAt > 45_000) break;
    counts.fetched++;
    try {
      const res = await fetch(`https://api.brevo.com/v3/smtp/emails/${encodeURIComponent(c.messageId)}`, {
        headers: { "api-key": key },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) { counts.missing++; continue; }
      const j = (await res.json()) as { subject?: string | null; htmlContent?: string | string[] | null };
      const subject = typeof j.subject === "string" ? j.subject : null;
      const html = Array.isArray(j.htmlContent) ? j.htmlContent.join("") : (typeof j.htmlContent === "string" ? j.htmlContent : "");
      if (!html) { counts.skipped++; continue; }
      await db.insert(emails).values({
        prospectId: c.id, toEmail: c.email ?? "", subject, bodyHtml: html,
        status: "backfilled", messageId: c.messageId,
      }).onConflictDoNothing();
      counts.archived++;
    } catch {
      counts.missing++;
    }
  }
  return NextResponse.json(counts);
}
