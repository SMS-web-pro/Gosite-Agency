import { NextResponse, type NextRequest } from "next/server";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (body.text ?? "").trim() || "✅ GoSite Digital — test de connexion réussi. Le bot est opérationnel.";
  if (!(await telegramConfigured())) {
    return NextResponse.json({ ok: false, error: "Configurez TELEGRAM_BOT_TOKEN et TELEGRAM_CHAT_ID d'abord" }, { status: 400 });
  }
  const res = await sendTelegram(text);
  if (res.ok) {
    await logActivity({ agentKey: "telegram", action: "message_envoye", message: `Message Telegram envoyé à RIO : "${text.slice(0, 80)}"`, level: "success" });
  }
  return NextResponse.json(res);
}

export async function GET() {
  return NextResponse.json({ configured: await telegramConfigured() });
}
