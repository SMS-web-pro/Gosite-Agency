import { NextResponse, type NextRequest } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram";
import { getSetting } from "@/lib/settings";
import { ensureSchema } from "@/db/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  await ensureSchema();
  // Secret obligatoire (configuré par setWebhook) — sans lui, n'importe qui
  // peut injecter de faux updates Telegram.
  const secret = await getSetting("TELEGRAM_WEBHOOK_SECRET");
  const header = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secret || header !== secret) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const update = (await req.json()) as { message?: { chat?: { id?: number }; text?: string } };
    // Chat figé : usage personnel — si un chat est déjà enregistré, ignorer
    // tout /start provenant d'un autre chat (anti-détournement du canal).
    const registered = await getSetting("TELEGRAM_CHAT_ID");
    const incoming = update.message?.chat?.id ? String(update.message.chat.id) : null;
    if (registered && incoming && incoming !== registered && update.message?.text?.trim().startsWith("/start")) {
      console.warn(`[telegram] /start refusé : chat inconnu ${incoming}`);
      return NextResponse.json({ ok: true, ignored: "unknown chat" });
    }
    await handleTelegramUpdate(update);
  } catch (err) {
    console.error("telegram webhook error", err);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST Telegram updates here" });
}
