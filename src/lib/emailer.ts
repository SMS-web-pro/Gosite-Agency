// Saler — emailing commercial professionnel.
// Copy en 2 passes (rédacteur PAS → directeur commercial critique), multilingue fr/en,
// template d'agence responsive. Sans clé Brevo : envoi simulé et journalisé.

import { getSetting } from "./settings";
import type { Prospect } from "@/db/schema";

export async function brevoConfigured(): Promise<boolean> {
  return Boolean((await getSetting("BREVO_API_KEY")) && (await getSetting("BREVO_SENDER_EMAIL")));
}

/* ─────────── Langue ─────────── */

type Lang = "fr" | "en";

const EN_COUNTRIES = /\b(usa?|u\.s\.a?|united states|états-unis|etats-unis|america|uk|u\.k\.|united kingdom|royaume-uni|england|angleterre|great britain|gb)\b/i;
const FR_COUNTRIES = /\b(france|canada|belgium|belgique|belgie|maroc|morocco|algerie|algeria|tunisie|tunisia|suisse|switzerland|luxembourg)\b/i;

export function resolveLang(p: Prospect): Lang {
  const sheet = (p.clientData ?? {}) as Record<string, unknown>;
  const raw = typeof sheet.LANG === "string" ? sheet.LANG.trim().toLowerCase() : "";
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("fr")) return "fr";
  const country = String(p.country ?? "");
  if (EN_COUNTRIES.test(country)) return "en";
  if (FR_COUNTRIES.test(country)) return "fr";
  return "fr";
}

/* ─────────── Packs de langue (libellés template + replis sans LLM) ─────────── */

type LangPack = {
  brandSub: string;
  offerIntro: string;
  offerDays: string;
  offerAll: string;
  offerTitleFallback: string;
  cta: string;
  directLinkLabel: string;
  proof: (p: Prospect) => string | null;
  stopLine: string;
  signature: string;
  fallbackSubject: (name: string) => string;
  fallbackHook: (p: Prospect) => string;
  fallbackBullets: (p: Prospect) => string[];
  fallbackClosing: string;
};

const LANG_PACKS: Record<Lang, LangPack> = {
  fr: {
    brandSub: "Votre présence en ligne, livrée clé en main",
    offerIntro: "Votre site vitrine complet, déjà créé pour",
    offerDays: "Mise en ligne sous 48h",
    offerAll: "tout compris, sans abonnement",
    offerTitleFallback: "Notre offre",
    cta: "Voir votre site",
    directLinkLabel: "Lien direct :",
    proof: (p) =>
      p.rating && Number(p.rating) > 0 ? `Note Google : ${p.rating}/5 · ${p.reviewCount ?? 0} avis publics` : null,
    stopLine:
      "Vous recevez cet email car votre établissement est référencé publiquement sur Google Maps. Répondez « STOP » pour ne plus être contacté.",
    signature: "Cordialement,<br><strong>L'équipe GoSite Digital</strong>",
    fallbackSubject: (name) => `Un site web prêt pour ${name}`,
    fallbackHook: (p) => {
      const base = p.rating && Number(p.rating) > 0
        ? `${p.businessName} ressort parmi les commerces les mieux notés de ${p.city ?? "votre région"} — ${p.rating}/5 avec ${p.reviewCount ?? 0} avis.`
        : `En parcourant les commerces de ${p.city ?? "votre région"}, ${p.businessName} nous a tapé dans l'œil.`;
      return `${base} Ce qui manque à cette réputation : un endroit en ligne où vos clients peuvent vous trouver et vous appeler.`;
    },
    fallbackBullets: (p) => [
      `Un site complet à votre image, déjà créé pour ${p.businessName}`,
      "Visible sur Google, parfait sur mobile, formulaire d'appel déjà intégré",
      "Votre propre nom de domaine — le site vous appartient, sans abonnement",
    ],
    fallbackClosing: "Jetez un œil, cela prend deux minutes — une réponse à cet email suffit pour la suite.",
  },
  en: {
    brandSub: "Your online presence, delivered turnkey",
    offerIntro: "Your complete website, already built for",
    offerDays: "Live within 48 hours",
    offerAll: "all-inclusive, no subscription",
    offerTitleFallback: "Our offer",
    cta: "View your site",
    directLinkLabel: "Direct link:",
    proof: (p) =>
      p.rating && Number(p.rating) > 0 ? `Google rating: ${p.rating}/5 · ${p.reviewCount ?? 0} public reviews` : null,
    stopLine:
      "You received this email because your business is publicly listed on Google Maps. Reply \"STOP\" and we will never contact you again.",
    signature: "Best regards,<br><strong>The GoSite Digital Team</strong>",
    fallbackSubject: (name) => `A website ready for ${name}`,
    fallbackHook: (p) => {
      const base = p.rating && Number(p.rating) > 0
        ? `${p.businessName} stands out among the best-rated businesses in ${p.city ?? "your area"} — ${p.rating}/5 with ${p.reviewCount ?? 0} reviews.`
        : `While reviewing businesses in ${p.city ?? "your area"}, ${p.businessName} caught our attention.`;
      return `${base} What that reputation is missing: a place online where your customers can find you and call you.`;
    },
    fallbackBullets: (p) => [
      `A complete website already built around ${p.businessName}`,
      "Visible on Google, flawless on mobile, contact forms built in",
      "Your own domain name — the site is yours, no subscription",
    ],
    fallbackClosing: "Have a look, it takes two minutes — a reply to this email is all it takes.",
  },
};

/* ─────────── Copy IA en 2 passes ─────────── */

type SalesCopyRaw = { subject?: string; hook?: string; bullets?: string[]; offerTitle?: string; cta?: string; closing?: string };
export type SalesCopy = { subject: string; hook: string; bullets: string[]; offerTitle: string; cta: string; closing: string };

async function aiSalesCopy(p: Prospect, price: string, currency: string, lang: Lang): Promise<SalesCopy | null> {
  const { agentThinkJson } = await import("./agent-brain");
  const sheet = (p.clientData ?? {}) as Record<string, string>;
  const facts =
    lang === "en"
      ? `Business: ${p.businessName}
Type: ${p.businessType}
City/Country: ${p.city ?? "—"}, ${p.country ?? "—"}
Google rating: ${p.rating ?? "—"} /5, ${p.reviewCount ?? 0} reviews
Selling angle (sheet): ${sheet.SELLING_ANGLE ?? "—"}
Website tagline: ${sheet.TAGLINE ?? "—"}
Potential analysis: ${p.aiInsight ?? "—"}
Offer: complete website for ${price} ${currency} all-inclusive, live within 48h, no subscription`
      : `Commerce: ${p.businessName}
Type: ${p.businessType}
Ville/Pays: ${p.city ?? "—"}, ${p.country ?? "—"}
Note Google: ${p.rating ?? "—"} /5, ${p.reviewCount ?? 0} avis
Angle de vente (fiche): ${sheet.SELLING_ANGLE ?? "—"}
Accroche du site créé: ${sheet.TAGLINE ?? "—"}
Analyse du potentiel: ${p.aiInsight ?? "—"}
Offre: site vitrine complet pour ${price} ${currency} tout compris, mise en ligne sous 48h, sans abonnement`;

  const brief =
    lang === "en"
      ? "Write a cold outreach email in NATIVE US ENGLISH proposing a website that has ALREADY BEEN BUILT for this business. Persona: a human, direct and respectful professional (no first names, polite 'you'). Framework PAS: Problem (a verifiable fact: their Google rating/review count and the absence of a website), Agitate (missed calls, customers choosing competitors), Solution (their site already exists, live within 48h, one all-inclusive price). One exclamation mark maximum in the whole email. No invented testimonials, no invented statistics, no 'I hope this finds you well'."
      : "Rédige un email de prospection à froid en français pour proposer un site vitrine DÉJÀ CRÉÉ à ce commerce. Ton : humain, direct, respectueux (vouvoiement obligatoire). Méthode PAS : Problème (un fait vérifiable : note Google, nombre d'avis, absence de site), Agitation (appels manqués, clients qui partent chez le concurrent), Solution (leur site existe déjà, en ligne sous 48h, un prix tout compris). Un seul point d'exclamation maximum sur tout l'email. Aucun témoignage inventé, aucune statistique inventée, pas de « j'espère que vous allez bien ».";

  const jsonShape =
    lang === "en"
      ? 'Respond ONLY in JSON: {"subject": string (90 characters max, no emoji, mentions the business name), "hook": string (1 to 2 opening sentences), "bullets": string[] (exactly 3 concrete benefits, 90 characters max each, no trailing period), "offerTitle": string (60 characters max, heading of the offer box), "cta": string (28 characters max, button label), "closing": string (1 sentence inviting to view the site or to reply)}'
      : 'Réponds UNIQUEMENT en JSON : {"subject": string (90 caractères max, sans emoji, mentionne le nom du commerce), "hook": string (1 à 2 phrases d\'ouverture), "bullets": string[] (exactement 3 bénéfices concrets, 90 caractères max chacun, sans point final), "offerTitle": string (60 caractères max, intitulé de l\'encadré offre), "cta": string (28 caractères max, texte du bouton), "closing": string (1 phrase qui invite à regarder le site ou à répondre)}';

  const pass1 = await agentThinkJson<SalesCopyRaw>({
    agent: "saler",
    task: "redaction_offre_p1",
    instruction: `${brief}\n${jsonShape}`,
    input: facts,
    maxTokens: 900,
    temperature: 0.8,
    lang,
  });
  if (!pass1) return null;

  const pass2 = await agentThinkJson<SalesCopyRaw>({
    agent: "saler",
    task: "redaction_offre_p2",
    instruction:
      (lang === "en"
        ? "You are a senior sales director. Review and REWRITE this cold email draft: sharpen specificity, clarity, brevity and credibility; make the call to action obvious. Keep the JSON structure with the SAME keys, same limits. Everything must stay in NATIVE US ENGLISH — remove any French word. One exclamation mark maximum."
        : "Tu es directeur commercial senior. Critique puis RÉÉCRIS ce brouillon d'email de prospection : plus de spécificité, de clarté, de brièveté et de crédibilité ; rende l'appel à l'action évident. Garde la structure JSON avec les MÊMES clés et les mêmes limites. Tout doit rester en français — supprime tout mot anglais. Un seul point d'exclamation maximum.") +
      `\n${jsonShape}`,
    input: (lang === "en" ? "BUSINESS SHEET:\n" : "FICHE DU COMMERCE :\n") +
      `${facts}\n\n${lang === "en" ? "DRAFT TO REVIEW:" : "PROPOSITION À CRITIQUER :"}\n${JSON.stringify(pass1)}`,
    maxTokens: 900,
    temperature: 0.4,
    lang,
  });

  return coerceCopy(pass2 ?? pass1, lang, p);
}

/** Validation/défauts : chaque valeur LLM invalide retombe sur le pack, jamais "undefined". */
function coerceCopy(raw: SalesCopyRaw | null, lang: Lang, p: Prospect): SalesCopy {
  const pack = LANG_PACKS[lang];
  const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const bullets = Array.isArray(raw?.bullets)
    ? raw.bullets
        .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
        .map((b) => b.trim().slice(0, 120))
        .slice(0, 4)
    : [];
  return {
    subject: str(raw?.subject, 90) || pack.fallbackSubject(p.businessName),
    hook: str(raw?.hook, 420) || pack.fallbackHook(p),
    bullets: bullets.length >= 2 ? bullets : pack.fallbackBullets(p),
    offerTitle: str(raw?.offerTitle, 60) || pack.offerTitleFallback,
    cta: str(raw?.cta, 28) || pack.cta,
    closing: str(raw?.closing, 300) || pack.fallbackClosing,
  };
}

/* ─────────── Template d'agence ─────────── */

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONT = "-apple-system,'Segoe UI',Arial,sans-serif";

function renderEmail(opts: {
  p: Prospect;
  copy: SalesCopy;
  previewUrl: string;
  price: string;
  currency: string;
  lang: Lang;
  agencyAddress?: string;
}): string {
  const pack = LANG_PACKS[opts.lang];
  const { copy, p } = opts;

  const bulletsHtml = copy.bullets
    .map(
      (b) =>
        `<tr><td valign="top" style="padding:0 0 12px 0;width:30px"><span style="color:#00A57E;font-weight:800;font-size:15px">✓</span></td><td valign="top" style="padding:0 0 12px 0;font-size:15px;color:#3a3f4a;line-height:1.55">${esc(b)}</td></tr>`
    )
    .join("\n      ");

  const proofText = pack.proof(p);
  const proofHtml = proofText
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="background:#f6f8fa;border-left:3px solid #00A57E;padding:10px 16px;font-size:13px;color:#5b6270">${esc(proofText)}</td></tr></table>`
    : "";

  return `<!DOCTYPE html>
<html lang="${opts.lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f4f5f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7">
<tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;font-family:${FONT}">
  <tr><td style="background:#0B1220;padding:26px 36px;border-radius:14px 14px 0 0">
    <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:.3px">GoSite <span style="color:#00E5A0">Digital</span></div>
    <div style="font-size:13px;color:rgba(255,255,255,.72);margin-top:4px">${esc(pack.brandSub)}</div>
  </td></tr>
  <tr><td style="background:#ffffff;padding:34px 36px;border:1px solid #e8eaee;border-top:0">
    <p style="margin:0 0 18px 0;font-size:16px;line-height:1.65;color:#22262e">${esc(copy.hook)}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 0 0">
      ${bulletsHtml}
    </table>
    ${proofHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B1220;border-radius:14px;margin:8px 0 0 0">
      <tr><td style="padding:24px 28px">
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#00E5A0">${esc(copy.offerTitle)}</div>
        <div style="font-size:16px;font-weight:700;color:#ffffff;margin-top:10px">${esc(pack.offerIntro)} ${esc(p.businessName)}</div>
        <div style="font-size:30px;font-weight:800;color:#ffffff;margin-top:6px">${esc(opts.price)} <span style="font-size:14px;font-weight:600;color:rgba(255,255,255,.75)">${esc(opts.currency)}</span></div>
        <div style="margin-top:10px"><span style="display:inline-block;background:rgba(0,229,160,.14);color:#7CFFDC;font-size:12.5px;font-weight:700;padding:6px 12px;border-radius:20px">${esc(pack.offerDays)}</span>
        <span style="display:inline-block;color:rgba(255,255,255,.66);font-size:12.5px;margin-left:8px">${esc(pack.offerAll)}</span></div>
      </td></tr>
    </table>
    <p style="text-align:center;margin:26px 0 10px 0">
      <a href="${esc(opts.previewUrl)}" style="display:inline-block;background:#00E5A0;color:#0B1220;padding:14px 30px;border-radius:40px;text-decoration:none;font-weight:800;font-size:15px">${esc(copy.cta)} →</a>
    </p>
    <p style="text-align:center;margin:0 0 24px 0;font-size:13px;color:#8a90a0">${esc(pack.directLinkLabel)} <a href="${esc(opts.previewUrl)}" style="color:#00A57E;text-decoration:none">${esc(opts.previewUrl)}</a></p>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#22262e">${esc(copy.closing)}</p>
    <p style="margin:22px 0 0 0;font-size:14px;line-height:1.6;color:#22262e">${pack.signature}</p>
  </td></tr>
  <tr><td style="padding:18px 36px 26px 36px;font-size:11px;line-height:1.6;color:#9aa0ab">
    GoSite Digital · gosite.digital${opts.agencyAddress ? ` · ${esc(opts.agencyAddress)}` : ""}<br>${esc(pack.stopLine)}
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/* ─────────── Version texte (accessibilité + délivrabilité) ─────────── */

function renderEmailText(opts: { p: Prospect; copy: SalesCopy; previewUrl: string; price: string; currency: string; lang: Lang }): string {
  const pack = LANG_PACKS[opts.lang];
  const { copy, p } = opts;
  const lines = [
    copy.hook,
    "",
    ...copy.bullets.map((b) => `• ${b}`),
    "",
    `${pack.offerIntro} ${p.businessName}`,
    `${opts.price} ${opts.currency} — ${pack.offerAll}`,
    `${pack.offerDays}. ${opts.previewUrl}`,
    "",
    copy.closing,
    "",
    "GoSite Digital — gosite.digital",
    pack.stopLine,
  ];
  return lines.join("\n");
}

/* ─────────── Envoi ─────────── */

export type SendResult = { ok: boolean; simulated: boolean; messageId?: string; error?: string; subject?: string; bodyHtml?: string };

export async function sendSalesEmail(p: Prospect, previewUrl: string): Promise<SendResult> {
  // Opt-out : aucune copie, aucun appel LLM pour une adresse désinscrite.
  const { isDoNotContact } = await import("./dnc");
  if (await isDoNotContact(p.email)) {
    return { ok: false, simulated: false, error: `do_not_contact : ${p.email} est désinscrit, envoi bloqué` };
  }
  const price = (await getSetting("OFFER_PRICE")) || "490";
  const sheet = (p.clientData ?? {}) as Record<string, string>;
  const sheetCurrency = typeof sheet.CURRENCY === "string" ? sheet.CURRENCY.trim().toUpperCase() : "";
  // Devise du pays du lead si la fiche ne la précise pas (un lead US ne doit
  // jamais recevoir « 490 € »).
  const country = String(p.country ?? "");
  const geoCurrency = /\b(usa?|us|united states|états-unis|etats-unis|america)\b/i.test(country)
    ? "USD"
    : /\b(uk|united kingdom|england|royaume-uni|gb)\b/i.test(country)
      ? "GBP"
      : "";
  const currency = sheetCurrency || geoCurrency || (await getSetting("OFFER_CURRENCY")) || "EUR";
  const lang = resolveLang(p);

  // 🧠 Copy en 2 passes, avec repli complet par langue (jamais de blocage)
  const ai = await aiSalesCopy(p, price, currency, lang);
  const copy = coerceCopy(ai, lang, p);
  const senderEmail = await getSetting("BREVO_SENDER_EMAIL");
  const agencyAddress = await getSetting("AGENCY_ADDRESS");
  const bodyHtml = renderEmail({ p, copy, previewUrl, price, currency, lang, agencyAddress });
  const bodyText = renderEmailText({ p, copy, previewUrl, price, currency, lang });
  const content: SendResult = { ok: false, simulated: false, subject: copy.subject, bodyHtml };

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
        sender: { email: senderEmail, name: (await getSetting("BREVO_SENDER_NAME")) || "GoSite Digital" },
        to: [{ email: p.email, name: p.businessName }],
        replyTo: { email: senderEmail },
        subject: copy.subject,
        htmlContent: bodyHtml,
        textContent: bodyText,
        headers: {
          // Désinscription standard (RFC 2369) : honore la promesse STOP du footer.
          "List-Unsubscribe": `<mailto:${senderEmail}?subject=STOP>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
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

// Réponse d'agent (Saler/Paymer/Support) à un message client entrant.
// Même discipline que l'offre : texte + HTML simples, List-Unsubscribe,
// footer adresse légale, threading In-Reply-To/References.
export async function sendAgentReply(params: {
  to: string;
  subject: string;
  bodyText: string;
  inReplyTo?: string;
  references?: string;
}): Promise<{ ok: boolean; simulated?: boolean; messageId?: string; error?: string }> {
  if (!params.to) return { ok: false, error: "Email destinataire absent" };
  if (!(await brevoConfigured())) {
    return { ok: false, error: "Brevo non configuré (BREVO_API_KEY + email expéditeur dans Réglages)" };
  }
  const senderEmail = await getSetting("BREVO_SENDER_EMAIL");
  const agencyAddress = await getSetting("AGENCY_ADDRESS");
  const footer = agencyAddress
    ? `\n\n— GoSite Digital\n${agencyAddress}\nRépondez STOP pour ne plus être contacté.`
    : `\n\n— GoSite Digital\nRépondez STOP pour ne plus être contacté.`;
  const fullText = params.bodyText + footer;
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<mailto:${senderEmail}?subject=STOP>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  if (params.inReplyTo) headers["In-Reply-To"] = params.inReplyTo;
  if (params.references) headers["References"] = params.references;
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": await getSetting("BREVO_API_KEY"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: senderEmail, name: (await getSetting("BREVO_SENDER_NAME")) || "GoSite Digital" },
        to: [{ email: params.to }],
        replyTo: { email: senderEmail },
        subject: params.subject,
        textContent: fullText,
        headers,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json()) as { messageId?: string; message?: string };
    if (!res.ok) return { ok: false, error: json.message ?? `HTTP ${res.status}` };
    return { ok: true, messageId: json.messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network" };
  }
}
