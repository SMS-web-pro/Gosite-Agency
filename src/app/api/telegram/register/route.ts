import { NextResponse, type NextRequest } from "next/server";
import { getTelegramWebhookInfo, registerTelegramWebhook } from "@/lib/telegram";
import { getSetting, setSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrlFromReq(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}`;
}

// Diagnostics du webhook (sans exposer le token)
export async function GET(req: NextRequest) {
  const info = await getTelegramWebhookInfo();
  const appBase = (await getSetting("APP_BASE_URL")) || baseUrlFromReq(req);
  const expected = `${appBase.replace(/\/+$/, "")}/api/telegram/webhook`;
  return NextResponse.json({
    ...info,
    expectedUrl: expected,
    urlMatches: info.ok ? info.info?.url === expected : false,
  });
}

// Enregistrement / réparation du webhook
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { appBaseUrl?: string };
  if (body.appBaseUrl) {
    // Anti-détournement : seul le domaine de l'agence est accepté.
    const allowed = new Set<string>();
    for (const candidate of [await getSetting("APP_BASE_URL"), await getSetting("AGENCY_DOMAIN"), baseUrlFromReq(req)]) {
      if (!candidate) continue;
      try {
        allowed.add(new URL(candidate).host);
      } catch {
        // URL invalide → ignorée
      }
    }
    let host: string | null = null;
    try {
      host = new URL(body.appBaseUrl).host;
    } catch {
      host = null;
    }
    if (!host || !allowed.has(host) || !body.appBaseUrl.startsWith("https://")) {
      return NextResponse.json({ error: "appBaseUrl refusé : doit être le domaine de l'agence en https" }, { status: 400 });
    }
    await setSetting("APP_BASE_URL", body.appBaseUrl);
  }
  const appBase = (await getSetting("APP_BASE_URL")) || baseUrlFromReq(req);
  const res = await registerTelegramWebhook(appBase);
  const info = await getTelegramWebhookInfo();
  return NextResponse.json({ ...res, info: info.info ?? null, expectedUrl: `${appBase.replace(/\/+$/, "")}/api/telegram/webhook` });
}
