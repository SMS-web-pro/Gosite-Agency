import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { prospects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { chatCompletion, llmConfigured } from "@/lib/llm";
import { logActivity } from "@/lib/activity";
import { markAgentRunEnd, markAgentRunStart } from "@/lib/agents";
import { addDoNotContact, looksLikeOptOut } from "@/lib/dnc";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { prospectId?: number; question?: string; email?: string };
  const question = (body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "question requise" }, { status: 400 });

  // Opt-out : une demande de désinscription est honorée immédiatement,
  // avant toute autre considération.
  if (looksLikeOptOut(question)) {
    const email = (body.email ?? "").trim();
    if (email) await addDoNotContact(email, "support");
    else if (body.prospectId) {
      const rows = await db.select({ email: prospects.email }).from(prospects).where(eq(prospects.id, body.prospectId)).limit(1);
      if (rows[0]?.email) await addDoNotContact(rows[0].email, "support");
    }
    await logActivity({ agentKey: "support", action: "desinscription", message: `Désinscription demandée (${question.slice(0, 60)}…) — ajoutée à do-not-contact.`, level: "warn", prospectId: body.prospectId ?? null });
    return NextResponse.json({ ok: true, answer: "C'est bien noté : vous ne recevrez plus aucun message de notre part. Désolé pour la gêne occasionnée.", engine: "canned" });
  }

  await markAgentRunStart("support");
  let p = null;
  if (body.prospectId) {
    const rows = await db.select().from(prospects).where(eq(prospects.id, body.prospectId)).limit(1);
    p = rows[0] ?? null;
  }

  let answer: string;
  let engine: "llm" | "canned" = "canned";
  if (await llmConfigured()) {
    const ctx = p
      ? `Client: ${p.businessName} (${p.businessType}) à ${p.city}. Étape pipeline: ${p.stage}. Site: ${p.deployedUrl ?? "non déployé"}. Paiement: ${p.paymentStatus}. Notes internes connues: ${p.aiInsight ?? "—"}.`
      : "Question générale de l'agence GoSite Digital (agence web automatisée).";
    // Cerveau partagé : Support hérite de ses skills et de ses apprentissages
    const { agentThink } = await import("@/lib/agent-brain");
    const raw = await agentThink({
      agent: "support",
      task: "reponse_client",
      instruction:
        "Réponds au client en 3 à 6 phrases, en français, avec précision et chaleur. " +
        "Reformule d'abord sa demande en une phrase, puis annonce l'action et le délai. " +
        "Si une modification du site est demandée, précise qu'elle sera appliquée sous 24h avec un nouveau lien.",
      input: `${ctx}\n\nMessage du client : "${question}"`,
      maxTokens: 600,
      temperature: 0.5,
    });
    if (raw) { answer = raw.trim(); engine = "llm"; } else { answer = fallbackAnswer(question, p?.businessName); }
  } else {
    answer = fallbackAnswer(question, p?.businessName);
  }

  await markAgentRunEnd("support", true);
  await logActivity({
    agentKey: "support", action: "reponse_client",
    message: `Support a répondu${p ? ` à ${p.businessName}` : ""} : "${question.slice(0, 60)}…" (${engine === "llm" ? "LLM" : "script"}).`,
    level: "info", prospectId: p?.id,
  });
  return NextResponse.json({ ok: true, answer, engine });
}

function fallbackAnswer(question: string, business?: string | null): string {
  const q = question.toLowerCase();
  const who = business ? `pour ${business} ` : "";
  if (q.includes("prix") || q.includes("tarif") || q.includes("coût"))
    return `Merci pour votre message ! Concernant le tarif ${who}: notre offre site vitrine clé en main est tout compris (création, mise en ligne, hébergement la première année). Je viens de vous renvoyer le lien de paiement sécurisé avec le détail précis. N'hésitez pas si vous souhaitez une option supplémentaire.`;
  if (q.includes("modif") || q.includes("change") || q.includes("horaire") || q.includes("couleur") || q.includes("photo"))
    return `Bien reçu ! J'ai transmis votre demande de modification ${who}à notre équipe de production. Les changements seront appliqués sous 24h et vous recevrez le lien mis à jour pour validation. Y a-t-il autre chose à ajuster en même temps ?`;
  if (q.includes("domaine") || q.includes("url") || q.includes("adresse"))
    return `Excellente question. Votre site est actuellement accessible sur son adresse de prévisualisation. Dès validation du paiement, nous lions votre nom de domaine personnalisé (ex. www.votre-entreprise.com) sous 48h, certificat SSL inclus.`;
  if (q.includes("délai") || q.includes("quand") || q.includes("livraison"))
    return `Votre site est déjà prêt et visible sur le lien de prévisualisation ! Après validation, la mise en ligne définitive prend 24 à 48h. Vous recevrez une confirmation par email avec l'ensemble de vos accès.`;
  return `Merci pour votre message${business ? ` concernant ${business}` : ""} ! Je transmets votre demande à l'équipe et je reviens vers vous très rapidement avec une réponse précise. En attendant, votre lien de prévisualisation reste accessible. Belle journée !`;
}
