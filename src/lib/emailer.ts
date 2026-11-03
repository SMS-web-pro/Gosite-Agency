// Saler — envoi de l'offre commerciale via Brevo (API transactionnelle).
// Sans clé Brevo : envoi simulé et journalisé.

import { getSetting } from "./settings";
import type { Prospect } from "@/db/schema";

export async function brevoConfigured(): Promise<boolean> {
  return Boolean((await getSetting("BREVO_API_KEY")) && (await getSetting("BREVO_SENDER_EMAIL")));
}

// 🧠 Saler rédige un email sur-mesure pour CE commerce précis
async function aiSalesCopy(p: Prospect, price: string, currency: string): Promise<{ subject: string; paragraphs: string[]; cta: string } | null> {
  const { agentThinkJson } = await import("./agent-brain");
  const sheet = (p.clientData ?? {}) as Record<string, string>;
  return agentThinkJson<{ subject: string; paragraphs: string[]; cta: string }>({
    agent: "saler",
    task: "redaction_offre",
    instruction:
      "Rédige un email de prospection à froid en français pour proposer un site vitrine DÉJÀ CRÉÉ à ce commerce. " +
      "Règles : tutoiement interdit (vouvoiement), ton humain et direct, aucune formule creuse, pas plus d'un point d'exclamation sur tout l'email. " +
      "Commence par une observation vraie et vérifiable (note Google, nombre d'avis, absence de site). " +
      "subject : objet court (max 60 caractères) mentionnant le nom du commerce. " +
      "paragraphs : 4 à 5 paragraphes courts (1 à 2 phrases chacun), le dernier invite à répondre. " +
      "cta : texte du bouton (max 4 mots). " +
      'Réponds en JSON : {"subject": string, "paragraphs": string[], "cta": string}',
    input: `Commerce: ${p.businessName}
Type: ${p.businessType}
Ville: ${p.city}, ${p.country}
Note Google: ${p.rating}/5 avec ${p.reviewCount} avis
Angle de vente identifié: ${sheet.SELLING_ANGLE ?? "—"}
Accroche du site créé: ${sheet.TAGLINE ?? "—"}
Analyse du potentiel: ${p.aiInsight ?? "—"}
Prix de l'offre: ${price} ${currency} tout compris, mise en ligne sous 48h`,
    maxTokens: 700,
    temperature: 0.75,
  });
}

function renderEmail(opts: {
  businessName: string; previewUrl: string; price: string; currency: string;
  subjectParagraphs: string[]; cta: string;
}): string {
  const body = opts.subjectParagraphs.map((t) => `<p>${t.replace(/</g, "&lt;")}</p>`).join("\n    ");
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#222;max-width:600px;margin:0 auto;line-height:1.65">
  <div style="background:#0B1220;color:#fff;padding:28px 32px;border-radius:14px 14px 0 0">
    <div style="font-size:20px;font-weight:700">GoSite <span style="color:#00E5A0">Digital</span></div>
    <div style="opacity:.7;font-size:13px;margin-top:4px">Votre présence en ligne, livrée clé en main</div>
  </div>
  <div style="padding:32px;border:1px solid #eee;border-top:0;border-radius:0 0 14px 14px">
    ${body}
    <p style="text-align:center;margin:28px 0">
      <a href="${opts.previewUrl}" style="background:#00E5A0;color:#0B1220;padding:14px 28px;border-radius:40px;text-decoration:none;font-weight:700">${opts.cta} →</a>
    </p>
    <p style="font-size:14px;color:#555">Lien direct : <a href="${opts.previewUrl}">${opts.previewUrl}</a></p>
    <p><strong>L'offre :</strong> mise en ligne sous 48h sur votre propre adresse pour <strong>${opts.price} ${opts.currency}</strong> tout compris, sans abonnement caché.</p>
    <p style="margin-top:28px">Cordialement,<br><strong>L'équipe GoSite Digital</strong></p>
  </div>
  <p style="font-size:11px;color:#999;margin-top:16px">Vous recevez cet email car votre établissement est référencé publiquement sur Google Maps. Répondez STOP pour ne plus être contacté.</p>
</body></html>`;
}

function fallbackParagraphs(p: Prospect): string[] {
  return [
    "Bonjour,",
    `En recensant les meilleurs établissements de ${p.city}, nous sommes tombés sur <strong>${p.businessName}</strong> : ${p.rating}/5 avec ${p.reviewCount} avis. Votre réputation locale est solide.`,
    `Un détail nous a surpris : ${p.businessName} n'a pas de site web. La plupart de vos futurs clients vous cherchent pourtant en ligne avant d'appeler.`,
    `Nous avons donc pris les devants et créé un site vitrine complet pour ${p.businessName}, déjà prêt à être mis en ligne.`,
    "Jetez-y un œil et dites-nous ce que vous en pensez — une réponse à cet email suffit.",
  ];
}

export type SendResult = { ok: boolean; simulated: boolean; messageId?: string; error?: string; subject?: string; bodyHtml?: string };

export async function sendSalesEmail(p: Prospect, previewUrl: string): Promise<SendResult> {
  const price = (await getSetting("OFFER_PRICE")) || "490";
  const currency = (await getSetting("OFFER_CURRENCY")) || "EUR";

  // 🧠 Copy générée par le cerveau IA, avec repli sur un modèle éprouvé
  const ai = await aiSalesCopy(p, price, currency);
  const subject = (ai?.subject && ai.subject.length <= 90)
    ? ai.subject
    : `Un site web prêt pour ${p.businessName} — à découvrir`;
  const paragraphs = (ai?.paragraphs && ai.paragraphs.length >= 2) ? ai.paragraphs : fallbackParagraphs(p);
  const cta = ai?.cta && ai.cta.length <= 28 ? ai.cta : "Découvrir votre site";
  const bodyHtml = renderEmail({
    businessName: p.businessName, previewUrl, price, currency,
    subjectParagraphs: paragraphs, cta,
  });
  const content: SendResult = { ok: false, simulated: false, subject, bodyHtml };

  if (!p.email) return { ...content, ok: false, simulated: false, error: "Email absent" };
  if (!(await brevoConfigured())) {
    const { allowSimulation } = await import("./settings");
    if (!(await allowSimulation())) {
      return { ...content, ok: false, simulated: false, error: "Brevo non configuré (BREVO_API_KEY + email expéditeur dans Réglages). Aucun email simulé en production." };
    }
    return { ...content, ok: true, simulated: true, messageId: `sim-${Date.now()}` };
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": await getSetting("BREVO_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: await getSetting("BREVO_SENDER_EMAIL"), name: (await getSetting("BREVO_SENDER_NAME")) || "GoSite Digital" },
        to: [{ email: p.email, name: p.businessName }],
        subject,
        htmlContent: bodyHtml,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json()) as { messageId?: string; message?: string };
    if (!res.ok) return { ...content, ok: false, simulated: false, error: json.message ?? `HTTP ${res.status}` };
    return { ...content, ok: true, simulated: false, messageId: json.messageId };
  } catch (err) {
    return { ...content, ok: false, simulated: false, error: err instanceof Error ? err.message : "network" };
  }
}
