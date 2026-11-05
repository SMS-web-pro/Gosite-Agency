import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

// Known setting keys and their env-var fallbacks
export const SETTING_KEYS = {
  TELEGRAM_BOT_TOKEN: "TELEGRAM_BOT_TOKEN",
  TELEGRAM_CHAT_ID: "TELEGRAM_CHAT_ID",
  LLM_BASE_URL: "LLM_BASE_URL",
  LLM_API_KEY: "LLM_API_KEY",
  LLM_MODEL: "LLM_MODEL",
  BREVO_API_KEY: "BREVO_API_KEY",
  BREVO_SENDER_EMAIL: "BREVO_SENDER_EMAIL",
  BREVO_SENDER_NAME: "BREVO_SENDER_NAME",
  VERCEL_TOKEN: "VERCEL_TOKEN",
  VERCEL_TEAM_ID: "VERCEL_TEAM_ID",
  CLOUDFLARE_TOKEN: "CLOUDFLARE_TOKEN",
  WHOP_API_KEY: "WHOP_API_KEY",
  WHOP_COMPANY_ID: "WHOP_COMPANY_ID",
  WHOP_PLAN_ID: "WHOP_PLAN_ID",
  AGENCY_DOMAIN: "AGENCY_DOMAIN",
  AGENCY_ADDRESS: "AGENCY_ADDRESS",
  OFFER_PRICE: "OFFER_PRICE",
  OFFER_CURRENCY: "OFFER_CURRENCY",
  ALLOW_SIMULATION: "ALLOW_SIMULATION",
  AUTOPILOT: "AUTOPILOT",
  APP_BASE_URL: "APP_BASE_URL",
  CRON_SECRET: "CRON_SECRET",
  TELEGRAM_WEBHOOK_SECRET: "TELEGRAM_WEBHOOK_SECRET",
} as const;

export type SettingKey = keyof typeof SETTING_KEYS;

const ENV_MAP: Record<SettingKey, string> = {
  TELEGRAM_BOT_TOKEN: "TELEGRAM_BOT_TOKEN",
  TELEGRAM_CHAT_ID: "TELEGRAM_CHAT_ID",
  LLM_BASE_URL: "LLM_BASE_URL",
  LLM_API_KEY: "LLM_API_KEY",
  LLM_MODEL: "LLM_MODEL",
  BREVO_API_KEY: "BREVO_API_KEY",
  BREVO_SENDER_EMAIL: "BREVO_SENDER_EMAIL",
  BREVO_SENDER_NAME: "BREVO_SENDER_NAME",
  VERCEL_TOKEN: "VERCEL_TOKEN",
  VERCEL_TEAM_ID: "VERCEL_TEAM_ID",
  CLOUDFLARE_TOKEN: "CLOUDFLARE_TOKEN",
  WHOP_API_KEY: "WHOP_API_KEY",
  WHOP_COMPANY_ID: "WHOP_COMPANY_ID",
  WHOP_PLAN_ID: "WHOP_PLAN_ID",
  AGENCY_DOMAIN: "AGENCY_DOMAIN",
  AGENCY_ADDRESS: "AGENCY_ADDRESS",
  OFFER_PRICE: "OFFER_PRICE",
  OFFER_CURRENCY: "OFFER_CURRENCY",
  ALLOW_SIMULATION: "ALLOW_SIMULATION",
  AUTOPILOT: "AUTOPILOT",
  APP_BASE_URL: "APP_BASE_URL",
  CRON_SECRET: "CRON_SECRET",
  TELEGRAM_WEBHOOK_SECRET: "TELEGRAM_WEBHOOK_SECRET",
};

const DEFAULTS: Partial<Record<SettingKey, string>> = {
  ALLOW_SIMULATION: "false",
  AUTOPILOT: "true",
  LLM_MODEL: "gpt-4o-mini",
  AGENCY_DOMAIN: "gosite.digital",
  OFFER_PRICE: "490",
  OFFER_CURRENCY: "EUR",
  BREVO_SENDER_NAME: "GoSite Digital",
};

export async function getSetting(key: SettingKey): Promise<string> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  const fromDb = rows[0]?.value?.trim();
  if (fromDb) return fromDb;
  const fromEnv = process.env[ENV_MAP[key]]?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULTS[key] ?? "";
}

export async function setSetting(key: SettingKey, value: string) {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (rows.length === 0) {
    await db.insert(settings).values({ key, value, updatedAt: new Date() });
  } else {
    await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
  }
}

// Mode démo autorisé ? Par défaut NON — le système exige de vraies clés.
export async function allowSimulation(): Promise<boolean> {
  return (await getSetting("ALLOW_SIMULATION")) === "true";
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(SETTING_KEYS) as SettingKey[]) {
    out[key] = await getSetting(key);
  }
  return out;
}
