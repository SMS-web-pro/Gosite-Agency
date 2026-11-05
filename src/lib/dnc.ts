// Do-Not-Contact — opt-out définitif. Toute adresse ici ne reçoit plus jamais d'email.
import { db } from "@/db";
import { doNotContact } from "@/db/schema";
import { eq } from "drizzle-orm";

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export async function addDoNotContact(email: string, source: "manual" | "stop_reply" | "rio" | "support", reason = "stop"): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e || !e.includes("@")) return false;
  await db.insert(doNotContact).values({ email: e, source, reason }).onConflictDoNothing();
  return true;
}

export async function isDoNotContact(email: string | null | undefined): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e) return false;
  const rows = await db.select({ id: doNotContact.id }).from(doNotContact).where(eq(doNotContact.email, e)).limit(1);
  return rows.length > 0;
}

// Réponse entrante = demande de désinscription ? Détection large (fr/en) sur
// radicaux : STOP, désinscri*, désabonn*, unsubscribe, "ne plus me contacter"…
export function looksLikeOptOut(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return /\b(stop|unsubscribe|un[\s-]?subscribe|desinscri\w*|désinscri\w*|desabonn\w*|désabonn\w*|ne plus (me |vous )?contacter|plus jamais (me |vous )?contacter|retirez[- ]?(moi|nous)|remove me|opt[- ]?out)\b/.test(t);
}
