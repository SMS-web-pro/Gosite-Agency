import { NextResponse, type NextRequest } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegram";
import { getSetting } from "@/lib/settings";
import { ensureSchema } from "@/db/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  await ensureSchema();
  // Vérifie le secret enregistré avec setWebhook (anti-appels parasites)
  const secret = await getSetting("TELEGRAM_WEBHOOK_SECRET");
  if (secret) {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) return NextResponse.json({ ok: false }, { status: 403 });
  }
  try {
    const update = await req.json();
    await handleTelegramUpdate(update);
  } catch (err) {
    console.error("telegram webhook error", err);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST Telegram updates here" });
}
