import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { serperKeys, prospects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAllSettings, allowSimulation, getSetting } from "@/lib/settings";
import { getTelegramWebhookInfo } from "@/lib/telegram";
import { ensureAgentsSeeded } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type Check = {
  key: string;
  label: string;
  status: "ok" | "warn" | "down";
  detail: string;
  fixHref: string;
  required: boolean;
};

export async function GET(req: NextRequest) {
  await ensureAgentsSeeded();
  const s = await getAllSettings();
  const keys = await db.select().from(serperKeys);
  const realActive = keys.filter((k) => k.status === "active" && !k.apiKey.startsWith("AUTO-POOL"));
  const creditsLeft = realActive.reduce((a, k) => a + (k.creditLimit - k.creditsUsed), 0);
  const sim = await allowSimulation();

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const detectedBase = `${proto}://${host}`;
  const configuredBase = s.APP_BASE_URL;

  // Base de données
  let dbOk = true;
  try { await db.select({ id: prospects.id }).from(prospects).limit(1); } catch { dbOk = false; }

  // Telegram webhook
  let tgDetail = "Token absent — RIO ne peut pas vous répondre sur Telegram.";
  let tgStatus: Check["status"] = "down";
  if (s.TELEGRAM_BOT_TOKEN) {
    const info = await getTelegramWebhookInfo();
    const expected = `${(configuredBase || detectedBase).replace(/\/+$/, "")}/api/telegram/webhook`;
    if (!info.ok) { tgStatus = "down"; tgDetail = info.error ?? "Token refusé par Telegram."; }
    else if (!info.info?.url) { tgStatus = "warn"; tgDetail = "Webhook non enregistré — cliquez sur « Enregistrer / réparer »."; }
    else if (info.info.url !== expected) { tgStatus = "warn"; tgDetail = `Webhook pointe vers ${info.info.url} au lieu de ${expected}.`; }
    else if (info.info.last_error_message) { tgStatus = "warn"; tgDetail = `Webhook actif mais Telegram signale : ${info.info.last_error_message}`; }
    else { tgStatus = "ok"; tgDetail = `Webhook actif${s.TELEGRAM_CHAT_ID ? ` · chat ${s.TELEGRAM_CHAT_ID} enregistré` : " · envoyez /start au bot pour lier votre chat"}`; }
    if (tgStatus === "ok" && !s.TELEGRAM_CHAT_ID) tgStatus = "warn";
  }

  const checks: Check[] = [
    { key: "database", label: "Base de données PostgreSQL", status: dbOk ? "ok" : "down", detail: dbOk ? "Connexion OK, schéma auto-migré." : "Connexion impossible — vérifiez DATABASE_URL.", fixHref: "/settings", required: true },
    {
      key: "serper", label: "Serper.dev — Prospector",
      status: realActive.length ? (creditsLeft < 250 ? "warn" : "ok") : "down",
      detail: realActive.length ? `${realActive.length} compte(s) actif(s) · ${creditsLeft} crédits restants` : "Aucune clé — la prospection réelle est impossible.",
      fixHref: "/agents", required: true,
    },
    {
      key: "telegram", label: "Telegram — Canal RIO",
      status: tgStatus, detail: tgDetail, fixHref: "/telegram", required: true,
    },
    {
      key: "llm", label: "LLM omniroute — Cerveau de RIO & Coder",
      status: s.LLM_BASE_URL && s.LLM_API_KEY ? "ok" : "warn",
      detail: s.LLM_BASE_URL && s.LLM_API_KEY ? `Modèle ${s.LLM_MODEL}` : "Non configuré — RIO répond en mode réflexes et Coder utilise le gabarit interne.",
      fixHref: "/settings", required: false,
    },
    {
      key: "vercel", label: "Vercel — Deployer & Domainner",
      status: s.VERCEL_TOKEN ? "ok" : "down",
      detail: s.VERCEL_TOKEN ? `Token actif · domaine agence ${s.AGENCY_DOMAIN}` : "Token absent — aucun site ne peut être mis en ligne.",
      fixHref: "/settings", required: true,
    },
    {
      key: "brevo", label: "Brevo — Saler",
      status: s.BREVO_API_KEY && s.BREVO_SENDER_EMAIL ? "ok" : "down",
      detail: s.BREVO_API_KEY && s.BREVO_SENDER_EMAIL ? `Expéditeur ${s.BREVO_SENDER_EMAIL}` : "Clé ou email expéditeur manquant — aucune offre ne peut partir.",
      fixHref: "/settings", required: true,
    },
    {
      key: "whop", label: "Whop — Paymer",
      status: s.WHOP_API_KEY && s.WHOP_PLAN_ID ? "ok" : "warn",
      detail: s.WHOP_API_KEY && s.WHOP_PLAN_ID ? "Plan de paiement connecté" : "Non configuré — pas de lien de paiement automatique.",
      fixHref: "/settings", required: false,
    },
    {
      key: "appurl", label: "URL publique de l'application",
      status: configuredBase ? "ok" : "warn",
      detail: configuredBase ? configuredBase : `Non définie — détectée automatiquement : ${detectedBase}`,
      fixHref: "/settings", required: false,
    },
    {
      key: "autopilot", label: "Auto-pilote 24/7",
      status: s.AUTOPILOT === "true" ? "ok" : "warn",
      detail: s.AUTOPILOT === "true" ? "Actif : cron horaire Vercel + cycles console + /tick Telegram." : "En pause — aucun cycle automatique ne tournera.",
      fixHref: "/settings", required: false,
    },
    {
      key: "mode", label: "Mode production stricte",
      status: sim ? "warn" : "ok",
      detail: sim ? "Mode test ACTIVÉ : des données simulées peuvent être générées." : "Production stricte : aucune donnée inventée, erreurs explicites.",
      fixHref: "/settings", required: false,
    },
    {
      key: "cron", label: "Secret cron",
      status: s.CRON_SECRET ? "ok" : "warn",
      detail: s.CRON_SECRET ? "Endpoint /api/cron/tick protégé." : "Aucun secret : seul l'en-tête Vercel Cron est accepté en production.",
      fixHref: "/settings", required: false,
    },
  ];

  const blocking = checks.filter((c) => c.required && c.status === "down");
  return NextResponse.json({
    checks,
    detectedBase,
    productionReady: blocking.length === 0,
    blocking: blocking.map((c) => c.label),
    score: Math.round((checks.filter((c) => c.status === "ok").length / checks.length) * 100),
  });
}
