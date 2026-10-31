import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { getAllSettings } from "@/lib/settings";
import { ensureAgentsSeeded } from "@/lib/agents";
import { db } from "@/db";
import { serperKeys } from "@/db/schema";
import { eq } from "drizzle-orm";

export const metadata: Metadata = {
  title: "GoSite Digital — Agence IA",
  description: "Agence web 100% automatisée par agents IA, pilotée depuis Telegram.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  await ensureAgentsSeeded();
  const s = await getAllSettings();
  const activeKeys = await db
    .select({ apiKey: serperKeys.apiKey })
    .from(serperKeys)
    .where(eq(serperKeys.status, "active"));
  const serperLive = activeKeys.some((k) => !k.apiKey.startsWith("AUTO-POOL"));
  const integrations = {
    telegram: Boolean(s.TELEGRAM_BOT_TOKEN && s.TELEGRAM_CHAT_ID),
    llm: Boolean(s.LLM_BASE_URL && s.LLM_API_KEY),
    brevo: Boolean(s.BREVO_API_KEY),
    vercel: Boolean(s.VERCEL_TOKEN),
    whop: Boolean(s.WHOP_API_KEY),
    serper: serperLive,
  };
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%2306080c'/%3E%3Ccircle cx='16' cy='16' r='7' fill='none' stroke='%2300e5a0' stroke-width='2.5'/%3E%3Ccircle cx='16' cy='16' r='2.5' fill='%2300e5a0'/%3E%3C/svg%3E" />
      </head>
      <body>
        <AppShell integrations={integrations}>{children}</AppShell>
      </body>
    </html>
  );
}
