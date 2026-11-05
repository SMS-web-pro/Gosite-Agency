// Emailor — découverte d'email pour les fiches réelles.
// Serper Places n'expose pas les emails : on interroge la recherche organique
// (1 crédit) et on extrait les adresses visibles dans les résultats publics.

import { db } from "@/db";
import { serperKeys } from "@/db/schema";
import { and, asc, eq, lt } from "drizzle-orm";
import { logActivity } from "./activity";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const BLACKLIST = [
  "example.com", "sentry", "wixpress", "godaddy", "cloudflare", "wordpress",
  "noreply", "no-reply", "@2x.", ".png", ".jpg", ".jpeg", ".gif", "@sentry",
  "schema.org", "w3.org", "googleapis", "gstatic", "@facebook.com", "@google.com",
];

function cleanEmail(e: string): string | null {
  const lower = e.toLowerCase().trim().replace(/[.,;:]+$/, "");
  if (BLACKLIST.some((b) => lower.includes(b))) return null;
  if (lower.length > 60) return null;
  return lower;
}

export async function discoverEmail(businessName: string, city: string | null): Promise<string | null> {
  const keys = await db
    .select()
    .from(serperKeys)
    .where(and(eq(serperKeys.status, "active"), lt(serperKeys.creditsUsed, serperKeys.creditLimit)))
    .orderBy(asc(serperKeys.createdAt));
  const key = keys.find((k) => !k.apiKey.startsWith("AUTO-POOL"));
  if (!key) return null;

  const q = `"${businessName}" ${city ?? ""} contact email`;
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "ma", hl: "fr", num: 10 }),
      signal: AbortSignal.timeout(15000),
    });
    // Décompte du crédit quoiqu'il arrive (succès, pas de résultat, etc.)
    await db.update(serperKeys).set({ creditsUsed: key.creditsUsed + 1, lastUsedAt: new Date() }).where(eq(serperKeys.id, key.id));
    if (!res.ok) {
      console.warn(`[discover] serper HTTP ${res.status} pour "${businessName}"`);
      return null;
    }

    const json = (await res.json()) as {
      organic?: { title?: string; snippet?: string }[];
      knowledgeGraph?: Record<string, unknown>;
    };
    const haystack = (json.organic ?? [])
      .map((o) => `${o.title ?? ""} ${o.snippet ?? ""}`)
      .join("\n");
    const found = new Set<string>();
    for (const m of haystack.matchAll(EMAIL_RE)) {
      const cleaned = cleanEmail(m[0]);
      if (cleaned) found.add(cleaned);
    }
    if (found.size === 0) return null;

    // Rang : on préfère une adresse qui ressemble au nom du business
    const slug = businessName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
    const ranked = [...found].sort((a, b) => {
      const score = (e: string) => (slug && e.replace(/[^a-z0-9]/g, "").includes(slug.slice(0, 8)) ? 2 : 0)
        + (/gmail|outlook|hotmail|yahoo|icloud|proton/.test(e) ? 1 : 0);
      return score(b) - score(a);
    });
    const best = ranked[0];
    await logActivity({
      agentKey: "emailor", action: "email_decouvert",
      message: `Email découvert publiquement pour ${businessName} : ${best}`,
      level: "info",
    });
    return best;
  } catch (err) {
    console.warn(`[discover] réseau pour "${businessName}":`, err instanceof Error ? err.message : err);
    return null;
  }
}
