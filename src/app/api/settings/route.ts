import { NextResponse, type NextRequest } from "next/server";
import { SETTING_KEYS, getAllSettings, setSetting, type SettingKey } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { ensureSchema } from "@/db/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET_HINT = (v: string) => (v.length <= 6 ? "••••••" : `${v.slice(0, 4)}••••••${v.slice(-4)}`);

export async function GET() {
  await ensureSchema();
  const all = await getAllSettings();
  // Ne jamais exposer les secrets internes
  delete all.TELEGRAM_WEBHOOK_SECRET;
  // Mask secrets in listing
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(all)) {
    const isSecret = /TOKEN|KEY/.test(k);
    masked[k] = v && isSecret ? SECRET_HINT(v) : v;
  }
  return NextResponse.json({ settings: masked });
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  const updated: string[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (!(key in SETTING_KEYS)) continue;
    if (key === "TELEGRAM_WEBHOOK_SECRET") continue; // interne uniquement
    if (typeof value !== "string" || value.includes("••••")) continue;
    await setSetting(key as SettingKey, value.trim());
    updated.push(key);
  }
  if (updated.includes("TELEGRAM_BOT_TOKEN") || updated.includes("APP_BASE_URL")) {
    // Auto-enregistrement du webhook dès que le token change
    try {
      const proto = req.headers.get("x-forwarded-proto") ?? "https";
      const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
      const { registerTelegramWebhook } = await import("@/lib/telegram");
      const base = (await getAllSettings()).APP_BASE_URL || `${proto}://${host}`;
      await registerTelegramWebhook(base);
    } catch { /* non bloquant */ }
  }
  if (updated.length > 0) {
    await logActivity({ agentKey: "rio", action: "reglages", message: `RIO a mis à jour : ${updated.join(", ")}.`, level: "info" });
  }
  return NextResponse.json({ ok: true, updated });
}
