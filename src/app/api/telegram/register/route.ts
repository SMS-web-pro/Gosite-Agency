import { NextResponse, type NextRequest } from "next/server";
import { ensureTelegramWebhookHealth } from "@/lib/telegram";
import { getSetting, setSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrlFromReq(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  return `${proto}://${host}`;
}

// Diagnostics du webhook (sans exposer le token) : on SONDE l'endpoint
// réellement au lieu de recopier l'erreur Telegram, qui peut être vieille.
export async function GET(req: NextRequest) {
  const detectedBase = baseUrlFromReq(req);
  const health = await ensureTelegramWebhookHealth({ detectedBase, repair: false });
  return NextResponse.json({
    ok: health.probes.length > 0 || health.healthy,
    healthy: health.healthy,
    expectedUrl: health.expectedUrl,
    urlMatches: health.urlMatches,
    activeUrl: health.activeUrl,
    staleTelegramError: health.staleTelegramError,
    telegramError: health.telegramError,
    telegramErrorAgeHours: health.telegramErrorAgeHours,
    kind: health.kind,
    detail: health.detail,
    checkedAt: health.checkedAt,
    info: health.probes.length
      ? {
          url: health.registeredUrl || null,
          pending_update_count: health.pendingUpdateCount,
          last_error_message: health.telegramError ?? undefined,
          last_error_date: health.telegramErrorDate ?? undefined,
          max_connections: 40,
        }
      : null,
  });
}

// Enregistrement / réparation du webhook : on sonde, on ré-enregistre si
// l'URL enregistrée est morte ou dérive, puis on revérifie.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { appBaseUrl?: string };
  const detectedBase = baseUrlFromReq(req);
  if (body.appBaseUrl) {
    // Anti-détournement : seul le domaine de l'agence est accepté.
    const allowed = new Set<string>();
    for (const candidate of [await getSetting("APP_BASE_URL"), await getSetting("AGENCY_DOMAIN"), detectedBase]) {
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
  const health = await ensureTelegramWebhookHealth({ detectedBase, repair: true });
  return NextResponse.json({
    ok: health.healthy,
    healthy: health.healthy,
    repaired: health.repaired,
    url: health.repairedUrl ?? health.activeUrl,
    error: health.healthy ? undefined : health.detail,
    detail: health.detail,
    expectedUrl: health.expectedUrl,
    info: {
      url: health.registeredUrl || null,
      last_error_message: health.telegramError ?? undefined,
      last_error_date: health.telegramErrorDate ?? undefined,
    },
  });
}
