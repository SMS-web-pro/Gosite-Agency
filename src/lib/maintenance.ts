// Rétention des données : les tables de journalisation croissent sans limite
// (2 500+ activités, 1 600+ appels IA au bout de quelques semaines). Une purge
// légère tourne à chaque tick — coût nul tant que rien ne dépasse les seuils.
import { db } from "@/db";
import { activities, aiCalls, emails, rioMessages } from "@/db/schema";
import { lt, sql } from "drizzle-orm";

const ACTIVITY_MAX_ROWS = 5000;
const CALLS_RETENTION_DAYS = 30;
const RIO_RETENTION_DAYS = 30;

export type PurgeResult = {
  activities: number;
  aiCalls: number;
  rioMessages: number;
  orphanEmails: number;
};

export async function purgeOldData(): Promise<PurgeResult> {
  const out: PurgeResult = { activities: 0, aiCalls: 0, rioMessages: 0, orphanEmails: 0 };

  // 1) Journal d'activité : garder les ACTIVITY_MAX_ROWS plus récentes.
  const oldest = await db
    .select({ id: activities.id })
    .from(activities)
    .orderBy(sql`${activities.id} DESC`)
    .limit(1)
    .offset(ACTIVITY_MAX_ROWS);
  if (oldest[0]) {
    const del = await db.delete(activities).where(lt(activities.id, oldest[0].id)).returning();
    out.activities = del.length;
  }

  // 2) Appels IA : 30 jours suffisent pour les stats.
  const callsCutoff = new Date(Date.now() - CALLS_RETENTION_DAYS * 24 * 3600_000);
  const delCalls = await db.delete(aiCalls).where(lt(aiCalls.createdAt, callsCutoff)).returning();
  out.aiCalls = delCalls.length;

  // 3) Messages RIO : 30 jours (la conversation courante vit côté client/appel).
  const rioCutoff = new Date(Date.now() - RIO_RETENTION_DAYS * 24 * 3600_000);
  const delRio = await db.delete(rioMessages).where(lt(rioMessages.createdAt, rioCutoff)).returning();
  out.rioMessages = delRio.length;

  // 4) Emails orphelins : le lead a été supprimé, l'archive contient de la PII
  //    qui ne sert plus à personne (RGPD : minimisation).
  const delOrphans = await db
    .delete(emails)
    .where(sql`${emails.prospectId} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM prospects WHERE prospects.id = ${emails.prospectId})`)
    .returning();
  out.orphanEmails = delOrphans.length;

  return out;
}
