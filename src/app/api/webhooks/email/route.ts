import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { inboundEmails } from "@/db/schema";
import { getSetting } from "@/lib/settings";
import { stripHtml, type InboundHeaders } from "@/lib/inbound";
import { processInboundRow } from "@/lib/inbound-process";
import { notifyTelegram } from "@/lib/telegram";
import { escapeHtml } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Webhook des emails entrants (Worker Cloudflare « gsd-inbound »).
// Configurez le Worker avec : <APP>/api/webhooks/email?secret=<EMAIL_WEBHOOK_SECRET>
export async function GET() {
  return NextResponse.json({ ok: true, setup: "POST depuis le Worker Cloudflare — voir docs/cloudflare-email-worker.md" });
}

const HEADER_KEYS: (keyof InboundHeaders)[] = [
  "autoSubmitted", "precedence", "autoReplySuppressed", "autorespond", "listId",
  "contentType", "xFailedRecipients", "inReplyTo", "references",
];

export async function POST(req: NextRequest) {
  // Secret dédié (distinct de CRON_SECRET) : ?secret= ou header x-webhook-secret.
  // Fail-closed : sans secret configuré, aucune entrée n'est acceptée (cet
  // endpoint déclenche de vraies réponses aux vrais clients).
  const secret = process.env.EMAIL_WEBHOOK_SECRET || (await getSetting("EMAIL_WEBHOOK_SECRET"));
  if (!secret) {
    return NextResponse.json({ error: "EMAIL_WEBHOOK_SECRET non configuré (Réglages → Réception)" }, { status: 401 });
  }
  const provided = req.nextUrl.searchParams.get("secret") || req.headers.get("x-webhook-secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const messageId = typeof payload.messageId === "string" ? payload.messageId.trim() : "";
  const fromEmail = typeof payload.fromEmail === "string" ? payload.fromEmail.trim() : "";
  if (!messageId || !fromEmail) {
    return NextResponse.json({ error: "messageId et fromEmail requis" }, { status: 400 });
  }

  const rawHeaders = (payload.headers ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof rawHeaders[k] === "string" ? (rawHeaders[k] as string) : undefined);
  const headers: Record<string, string | undefined> = {};
  for (const k of HEADER_KEYS) headers[k] = str(k);

  const text = typeof payload.text === "string" ? payload.text : "";
  const html = typeof payload.html === "string" ? payload.html : "";
  const bodyText = text.trim() || stripHtml(html);
  const inReplyTo = [headers.inReplyTo, headers.references].filter(Boolean).join(" ") || null;

  // Insertion AVANT tout traitement : dédoublonnage des retries Cloudflare
  // (index unique sur message_id) et trace durable même en cas d'échec.
  const inserted = await db
    .insert(inboundEmails)
    .values({
      messageId,
      fromEmail,
      fromName: typeof payload.fromName === "string" ? payload.fromName : null,
      subject: typeof payload.subject === "string" ? payload.subject : null,
      bodyText,
      inReplyTo,
      headers,
      status: "new",
    })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, dedup: true });
  }

  try {
    const result = await processInboundRow(inserted[0].id);
    return NextResponse.json({ ok: true, status: result.status });
  } catch (err) {
    // Jamais d'erreur HTTP après insertion : le Worker ne retenterait pas
    // (le tick réconciliera la row "new" au prochain passage).
    await notifyTelegram(`⚠️ <b>Réception</b> — erreur de traitement : ${escapeHtml(err instanceof Error ? err.message : "?")}`);
    return NextResponse.json({ ok: false });
  }
}
