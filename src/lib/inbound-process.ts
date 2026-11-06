// Moteur de réponse entrante : transforme un message client reçu (Worker
// Cloudflare → webhook → row inbound_emails) en réponse d'agent (Saler /
// Paymer / Support). Utilisé par le webhook (temps réel) et par le tick
// (réconciliation des rows "new" échouées). Idempotent par status + attempts.
import { db } from "@/db";
import { inboundEmails, emails, prospects } from "@/db/schema";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  extractNewText,
  isAutoReply,
  isDeliveryStatus,
  isOwnAddress,
  normalizeMessageIds,
  coerceInboundDecision,
  sanitizeReplyUrls,
  shouldIgnoreShortUnmatched,
  RATE_PER_ADDRESS_24H,
  type InboundHeaders,
} from "./inbound";
import { isDoNotContact, looksLikeOptOut, addDoNotContact, normalizeEmail } from "./dnc";
import { sendAgentReply } from "./emailer";
import { getSetting } from "./settings";
import { agentThinkJson } from "./agent-brain";
import { createPaymentLink, STAGES } from "./pipeline";
import { logActivity } from "./activity";
import { notifyTelegram } from "./telegram";
import { escapeHtml } from "./format";
import type { Prospect } from "@/db/schema";

type InboundRow = typeof inboundEmails.$inferSelect;

const MAX_ATTEMPTS = 4;

async function setStatus(id: number, status: string) {
  await db.update(inboundEmails).set({ status }).where(eq(inboundEmails.id, id));
}

async function findProspect(row: InboundRow): Promise<Prospect | null> {
  // 1) Fil : In-Reply-To / References → nos envois sortants (couvre un client
  //    qui répond depuis une autre adresse sur un fil existant).
  const ids = normalizeMessageIds(row.inReplyTo);
  if (ids.length) {
    const out = await db
      .select({ prospectId: emails.prospectId, messageId: emails.messageId })
      .from(emails)
      .where(sql`${emails.messageId} IS NOT NULL AND ${emails.prospectId} IS NOT NULL`);
    const hit = out.find((e) => e.messageId && normalizeMessageIds(e.messageId).some((m) => ids.includes(m)));
    if (hit?.prospectId) {
      const p = await db.select().from(prospects).where(eq(prospects.id, hit.prospectId)).limit(1);
      if (p[0]) return p[0];
    }
  }
  // 2) Adresse From = email du prospect (insensible à la casse).
  const norm = normalizeEmail(row.fromEmail);
  if (!norm) return null;
  const byEmail = await db
    .select()
    .from(prospects)
    .where(sql`lower(${prospects.email}) = ${norm}`)
    .limit(1);
  return byEmail[0] ?? null;
}

function langFor(p: Prospect): "fr" | "en" {
  const country = String(p.country ?? "");
  return /\b(usa?|us|united states|états-unis|etats-unis|uk|united kingdom|england|royaume-uni|gb)\b/i.test(country)
    ? "en"
    : "fr";
}

export async function processInboundRow(id: number): Promise<{ ok: boolean; status: string }> {
  const rows = await db.select().from(inboundEmails).where(eq(inboundEmails.id, id)).limit(1);
  const row = rows[0];
  if (!row) return { ok: false, status: "absent" };
  if (row.status !== "new") return { ok: true, status: row.status };

  // Compteur de tentatives : un entrant qui échoue répétitivement finit en
  // "human" (file d'intervention) au lieu de bloquer la réconciliation.
  const attempts = row.attempts + 1;
  await db.update(inboundEmails).set({ attempts }).where(eq(inboundEmails.id, id));
  if (attempts >= MAX_ATTEMPTS) {
    await setStatus(id, "human");
    await notifyTelegram(`⚠️ <b>Réception</b> — message de <b>${escapeHtml(row.fromEmail)}</b> non traité après ${attempts} tentatives. Intervention humaine.`);
    return { ok: false, status: "human" };
  }

  const headers = (row.headers ?? {}) as InboundHeaders;
  const freshText = extractNewText(row.bodyText);

  // ── Filtres « ne pas répondre » ─────────────────────────────────────────
  const ownAddresses = [(await getSetting("BREVO_SENDER_EMAIL")) || "", (await getSetting("CONTACT_EMAIL")) || ""].filter(Boolean);
  if (isAutoReply(headers, row.fromEmail) || isOwnAddress(row.fromEmail, ownAddresses)) {
    await setStatus(id, "ignored");
    return { ok: true, status: "ignored" };
  }
  if (isDeliveryStatus(headers, row.subject ?? "")) {
    // Bounce : jamais de LLM ni de réponse, mais l'opérateur doit savoir
    // qu'une adresse client est morte.
    await setStatus(id, "ignored");
    await notifyTelegram(`📭 <b>Bounce</b> — email non remis à <b>${escapeHtml(row.fromEmail)}</b> (${escapeHtml(row.subject ?? "")}).`);
    return { ok: true, status: "ignored" };
  }

  // ── Rattachement au prospect ────────────────────────────────────────────
  const prospect = await findProspect(row);
  const matched = prospect !== null;
  if (shouldIgnoreShortUnmatched(freshText || row.bodyText, matched)) {
    await setStatus(id, "ignored");
    return { ok: true, status: "ignored" };
  }
  if (!prospect) {
    await setStatus(id, "unmatched");
    return { ok: true, status: "unmatched" };
  }
  const p = prospect;

  // Anti-backscatter : on ne répond qu'à qui on a déjà contacté.
  const stageIdx = STAGES.indexOf(p.stage as (typeof STAGES)[number]);
  const contacted = stageIdx >= STAGES.indexOf("contacted");
  const outgoing = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emails)
    .where(and(eq(emails.prospectId, p.id), inArray(emails.status, ["sent", "agent_reply"])));
  if (!contacted || (outgoing[0]?.n ?? 0) === 0) {
    await setStatus(id, "unmatched");
    return { ok: true, status: "unmatched" };
  }
  if (!p.email) {
    await setStatus(id, "human");
    return { ok: false, status: "human" };
  }

  // ── Garde conformité : STOP sur le texte NOUVEAU (pas les citations) ────
  if (await isDoNotContact(p.email)) {
    await setStatus(id, "optout");
    return { ok: true, status: "optout" };
  }
  if (looksLikeOptOut(freshText)) {
    await addDoNotContact(p.email, "stop_reply");
    await setStatus(id, "optout");
    await notifyTelegram(`🛑 <b>STOP</b> — <b>${escapeHtml(p.businessName)}</b> (${escapeHtml(p.email)}) demande une désinscription. Ajouté à do_not_contact.`);
    await logActivity({ agentKey: "support", action: "dnc", message: `STOP détecté dans la réponse de ${p.businessName}`, prospectId: p.id, level: "warn" });
    return { ok: true, status: "optout" };
  }

  // ── Interrupteur : notification seule ───────────────────────────────────
  if ((await getSetting("AUTO_REPLY_ENABLED")) !== "on") {
    await notifyTelegram(
      `💬 <b>${escapeHtml(p.businessName)}</b> a répondu :\n${escapeHtml((freshText || row.bodyText).slice(0, 300))}\n<i>Réponses automatiques désactivées — répondez depuis la boîte Gmail.</i>`,
    );
    return { ok: true, status: "new" };
  }

  // ── Rate-limits ─────────────────────────────────────────────────────────
  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  const hourAgo = new Date(Date.now() - 3600_000);
  const perAddress = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emails)
    .where(and(eq(emails.status, "agent_reply"), sql`lower(${emails.toEmail}) = ${normalizeEmail(row.fromEmail)}`, gte(emails.createdAt, dayAgo)));
  if ((perAddress[0]?.n ?? 0) >= RATE_PER_ADDRESS_24H) {
    await setStatus(id, "human");
    await notifyTelegram(`⚠️ <b>Rate-limit</b> — 2 réponses déjà envoyées à <b>${escapeHtml(row.fromEmail)}</b> en 24 h. Intervention humaine.`);
    return { ok: false, status: "human" };
  }
  const cap = parseInt((await getSetting("AUTO_REPLY_HOURLY_CAP")) || "20", 10);
  const globalHour = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(emails)
    .where(and(eq(emails.status, "agent_reply"), gte(emails.createdAt, hourAgo)));
  if ((globalHour[0]?.n ?? 0) >= cap) {
    await setStatus(id, "human");
    await notifyTelegram(`⚠️ <b>Rate-limit global</b> — cap horaire (${cap}) atteint. Intervention humaine.`);
    return { ok: false, status: "human" };
  }

  // ── Historique de conversation (6 derniers messages, chronologiques) ────
  const [outHist, inHist] = await Promise.all([
    db.select({ subject: emails.subject, createdAt: emails.createdAt, body: emails.bodyHtml }).from(emails).where(eq(emails.prospectId, p.id)).orderBy(desc(emails.createdAt)).limit(6),
    db.select({ subject: inboundEmails.subject, createdAt: inboundEmails.createdAt, body: inboundEmails.bodyText }).from(inboundEmails).where(and(eq(inboundEmails.prospectId, p.id), inArray(inboundEmails.status, ["replied", "human"]))).orderBy(desc(inboundEmails.createdAt)).limit(6),
  ]);
  const history = [
    ...outHist.map((m) => ({ dir: "nous", subject: m.subject ?? "", body: stripForHistory(m.body) ?? "", at: m.createdAt })),
    ...inHist.map((m) => ({ dir: "client", subject: m.subject ?? "", body: stripForHistory(m.body) ?? "", at: m.createdAt })),
  ]
    .filter((m) => m.body || m.subject)
    .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0))
    .slice(-6)
    .map((m) => `[${m.dir}] ${m.subject || "(sans objet)"} : ${m.body.slice(0, 400)}`)
    .join("\n");

  // ── Un seul appel LLM : décision d'agent + réponse ──────────────────────
  const lang = langFor(p);
  const reusePending = p.paymentStatus === "pending" && p.paymentUrl;
  const decision = await agentThinkJson<{ agent: string; reply: string; needsHuman: boolean }>({
    agent: "saler",
    task: "reponse_entrante",
    lang,
    maxTokens: 600,
    instruction: [
      `Tu réponds à un email entrant d'un client de l'agence GoSite Digital. Langue imposée : ${lang === "en" ? "anglais" : "français"}.`,
      `Choisis l'agent qui signe : "saler" (questions sur le service, négociation), "paymer" (le client accepte ou veut payer), "support" (problème technique, FAQ).`,
      `Règles absolues : réponse courte (120 mots max), humaine, sans jargon ; le prix est strictement celui affiché (${lang === "en" ? "price is final" : "prix non négociable, aucune remise"}) ; n'invente AUCUNE donnée (pas de témoignage, pas de chiffre, pas de garantie) ; si le client semble confus, propose un appel ; si la demande est insolite, juridique ou si tu n'es pas sûr, mets needsHuman=true.`,
      `Réponds uniquement en JSON : {"agent":"saler|paymer|support","reply":"...","needsHuman":false}`,
    ].join("\n"),
    input: [
      `Commerce : ${p.businessName} (${p.city ?? ""} — ${p.country ?? ""})`,
      `Site livré : ${p.deployedUrl ?? "(pas encore)"}`,
      reusePending ? `Lien de paiement actif : ${p.paymentUrl}` : "",
      history ? `Historique :\n${history}` : "",
      `Message entrant de ${row.fromName || row.fromEmail} :\n${freshText || row.bodyText}`,
    ].filter(Boolean).join("\n\n"),
  });

  if (!decision) {
    await setStatus(id, "new");
    await notifyTelegram(`⚠️ <b>LLM indisponible</b> — message de <b>${escapeHtml(p.businessName)}</b> non traité. Retentative au prochain tick.`);
    return { ok: false, status: "new" };
  }
  const parsed = coerceInboundDecision(decision);
  if (!parsed || parsed.needsHuman) {
    await setStatus(id, "human");
    await notifyTelegram(
      `🙋 <b>Intervention humaine souhaitée</b> — ${escapeHtml(p.businessName)} :\n${escapeHtml((freshText || row.bodyText).slice(0, 300))}${parsed ? `\n<i>Brouillon (${parsed.agent}) : ${escapeHtml(parsed.reply.slice(0, 200))}</i>` : ""}`,
    );
    await logActivity({ agentKey: parsed?.agent ?? "saler", action: "inbound_human", message: `Réponse manuelle requise pour ${p.businessName}`, prospectId: p.id });
    return { ok: true, status: "human" };
  }

  // ── Paymer : lien de paiement (réutilisé tant que pending) ──────────────
  let paymentUrl = p.paymentUrl ?? "";
  if (parsed.agent === "paymer" && !reusePending) {
    try {
      await createPaymentLink(p);
      paymentUrl = (await db.select({ u: prospects.paymentUrl }).from(prospects).where(eq(prospects.id, p.id)).limit(1))[0]?.u ?? paymentUrl;
    } catch (err) {
      await setStatus(id, "new");
      await notifyTelegram(`⚠️ <b>Paymer</b> — échec de création du lien pour <b>${escapeHtml(p.businessName)}</b> : ${escapeHtml(err instanceof Error ? err.message : "?")}`);
      return { ok: false, status: "new" };
    }
  }

  // Anti prompt-injection : seules nos URL peuvent sortir.
  const reply = sanitizeReplyUrls(parsed.reply, [paymentUrl, p.deployedUrl ?? ""].filter(Boolean));
  const lastOut = await db.select({ subject: emails.subject }).from(emails).where(eq(emails.prospectId, p.id)).orderBy(desc(emails.createdAt)).limit(1);
  const subject = `Re: ${lastOut[0]?.subject || row.subject || "Votre site web"}`;

  const sent = await sendAgentReply({
    to: p.email,
    subject,
    bodyText: reply,
    inReplyTo: row.messageId,
    references: row.inReplyTo || undefined,
  });
  if (!sent.ok) {
    await setStatus(id, "new");
    await notifyTelegram(`⚠️ <b>Envoi impossible</b> à <b>${escapeHtml(p.email)}</b> : ${escapeHtml(sent.error ?? "?")} — retentative au prochain tick.`);
    await logActivity({ agentKey: parsed.agent, action: "inbound_erreur", message: `Envoi réponse échoué : ${sent.error}`, prospectId: p.id, level: "error" });
    return { ok: false, status: "new" };
  }

  // ── Archives + notification ─────────────────────────────────────────────
  await setStatus(id, "replied");
  await db.insert(emails).values({
    prospectId: p.id,
    toEmail: p.email,
    subject,
    bodyHtml: `<p>${escapeHtml(reply).replace(/\n/g, "<br>")}</p>`,
    status: "agent_reply",
    messageId: sent.messageId,
  });
  await logActivity({
    agentKey: parsed.agent,
    action: "inbound_reply",
    message: `Réponse automatique envoyée à ${p.businessName} : ${reply.slice(0, 120)}`,
    level: "success",
    prospectId: p.id,
  });
  await notifyTelegram(
    `🤖 <b>${parsed.agent.charAt(0).toUpperCase() + parsed.agent.slice(1)}</b> → <b>${escapeHtml(p.businessName)}</b>\nClient : « ${escapeHtml((freshText || row.bodyText).slice(0, 160))} »\nRéponse : « ${escapeHtml(reply.slice(0, 160))} »`,
  );
  return { ok: true, status: "replied" };
}

function stripForHistory(body: string | null): string | null {
  if (!body) return null;
  return body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
