// Saler — emailing commercial professionnel.
// Copy en 2 passes (rédacteur PAS → directeur commercial critique), multilingue fr/en,
// template d'agence avec inclusions réelles du site généré, « comment ça marche »
// et offre détaillée convertie dans la devise du lead (fx). Sans clé Brevo :
// envoi simulé et journalisé.

import { getSetting, setSetting } from "./settings";
import { injectPixel, linkifyEscaped, newEmailToken, trackifyText, wrapLinks } from "./track";
import { coerceCopy, sanitizeCopyRaw, type SalesCopy, type SalesCopyRaw } from "./offer-copy";
import { displayOffer, resolveDisplayCurrency, type Rates } from "./fx";
import type { Prospect } from "@/db/schema";

/** Base d'URL absolue pour les liens de tracking (pixel + clics). */
export async function appBaseUrl(): Promise<string> {
  return ((await getSetting("APP_BASE_URL")).trim() || "https://gosite.digital").replace(/\/+$/, "");
}

export async function brevoConfigured(): Promise<boolean> {
  return Boolean((await getSetting("BREVO_API_KEY")) && (await getSetting("BREVO_SENDER_EMAIL")));
}

/* ─────────── Langue ─────────── */

type Lang = "fr" | "en";

const EN_COUNTRIES = /\b(usa?|u\.s\.a?|united states|états-unis|etats-unis|america|uk|u\.k\.|united kingdom|royaume-uni|england|angleterre|great britain|gb)\b/i;
const FR_COUNTRIES = /\b(france|canada|belgium|belgique|belgie|maroc|morocco|algerie|algeria|tunisie|tunisia|suisse|switzerland|luxembourg)\b/i;

export function resolveLang(p: { clientData?: Record<string, string> | null; country?: string | null }): Lang {
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
  includedTitle: string;
  howTitle: string;
  howSteps: [string, string, string];
  domainIncluded: string;
  hostingIncluded: string;
  supportIncluded: string;
  renewalLabel: string;
  renewalSuffix: string;
  ctaLine: string;
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
    includedTitle: "Ce que votre site inclut déjà",
    howTitle: "Comment ça marche",
    howSteps: [
      "Vous répondez à cet email — une phrase suffit.",
      "On finalise avec vos informations et votre site est en ligne sous 48 h.",
      "Un seul paiement, quand vous êtes prêt.",
    ],
    domainIncluded: "Nom de domaine inclus 1 an",
    hostingIncluded: "Hébergement inclus 1 an",
    supportIncluded: "Support & modifications : 3 mois inclus",
    renewalLabel: "Année suivante",
    renewalSuffix: "/an — domaine + hébergement",
    ctaLine: "Une réponse à cet email suffit pour démarrer.",
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
      `Votre site ${p.businessName} est déjà créé et consultable maintenant`,
      "Vos services, vos horaires et votre formulaire d'appel au même endroit",
      "Votre propre nom de domaine — le site vous appartient, sans abonnement",
    ],
    fallbackClosing: "Regardez le site — si ça vous convient, une réponse à cet email suffit pour démarrer.",
  },
  en: {
    brandSub: "Your online presence, delivered turnkey",
    offerIntro: "Your complete website, already built for",
    offerDays: "Live within 48 hours",
    offerAll: "all-inclusive, no subscription",
    offerTitleFallback: "Our offer",
    cta: "View your site",
    directLinkLabel: "Direct link:",
    includedTitle: "What your site already includes",
    howTitle: "How it works",
    howSteps: [
      "You reply to this email — one sentence is enough.",
      "We finalize with your details and your site goes live within 48 hours.",
      "One single payment, when you're ready.",
    ],
    domainIncluded: "Domain name included for 1 year",
    hostingIncluded: "1 year of hosting included",
    supportIncluded: "Support & updates: first 3 months included",
    renewalLabel: "Next year",
    renewalSuffix: "/year — domain + hosting",
    ctaLine: "A reply to this email is all it takes to get started.",
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
      `Your website for ${p.businessName} is already built and viewable right now`,
      "Your services, hours and contact form in one place",
      "Your own domain name — the site is yours, no subscription",
    ],
    fallbackClosing: "Have a look — if it works for you, a reply to this email is all it takes to get started.",
  },
};

/* ─────────── Copy IA en 2 passes ─────────── */

// Le LLM ne rédige QUE subject/hook/bullets/closing : le prix, les inclusions,
// les étapes et le CTA sont déterministes (template + fx) — aucune invention
// possible sur l'offre elle-même.

async function aiSalesCopy(p: Prospect, lang: Lang): Promise<SalesCopy> {
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
Potential analysis: ${p.aiInsight ?? "—"}`
      : `Commerce: ${p.businessName}
Type: ${p.businessType}
Ville/Pays: ${p.city ?? "—"}, ${p.country ?? "—"}
Note Google: ${p.rating ?? "—"} /5, ${p.reviewCount ?? 0} avis
Angle de vente (fiche): ${sheet.SELLING_ANGLE ?? "—"}
Accroche du site créé: ${sheet.TAGLINE ?? "—"}
Analyse du potentiel: ${p.aiInsight ?? "—"}`;

  // Spec 3.3 — le vocabulaire de l'offre suit le businessModel du SiteSpec
  // (un gym = abonnement/essai, pas « devis » ; un restaurant = menu/réservation…).
  const businessModel = p.siteSpec?.businessModel ?? "";
  const modelNote = businessModel
    ? lang === "en"
      ? `Business model (SiteSpec): ${businessModel} — adapt the vocabulary accordingly (membership ≠ contractor ≠ restaurant ≠ retail).`
      : `Business model (SiteSpec) : ${businessModel} — adapte le vocabulaire en conséquence (membership ≠ contractor ≠ restaurant ≠ retail).`
    : "";
  const factsWithModel = modelNote ? `${facts}\n${modelNote}` : facts;

  const brief =
    lang === "en"
      ? "Write a cold outreach email in NATIVE US ENGLISH proposing a website that has ALREADY BEEN BUILT for this business. Goal: make them WANT to view the site and reply. Persona: a human, direct and respectful professional (no first names, polite 'you'), never pushy. Framework PAS, kept light: Problem (one verifiable fact: their Google rating/review count and the absence of a website), Agitate (ONE sentence max: what it costs them daily), Solution (their site already exists, live within 48h). The price, timeline, inclusions and call to action are added by the email template — do NOT write them. FORBIDDEN: percentages and unverifiable statistics, the word 'free', unproven superlatives, fake urgency, invented testimonials, 'I hope this finds you well'. One exclamation mark maximum in the whole email."
      : "Rédige un email de prospection à froid en français pour proposer un site vitrine DÉJÀ CRÉÉ à ce commerce. Objectif : lui donner envie d'aller voir le site et de répondre. Ton : professionnel, humain, direct, respectueux (vouvoiement obligatoire), jamais insistant. Méthode PAS allégée : Problème (un fait vérifiable : note Google, nombre d'avis, absence de site), Agitation (UNE phrase maximum : ce que ça lui coûte au quotidien), Solution (son site existe déjà, en ligne sous 48h). Le prix, le délai, les inclusions et l'appel à l'action sont ajoutés par le template de l'email — ne les écris PAS. INTERDITS : pourcentages et statistiques non vérifiables, le mot « gratuit », superlatifs non prouvés, fausse urgence, témoignages inventés, « j'espère que vous allez bien ». Un seul point d'exclamation maximum sur tout l'email.";

  const jsonShape =
    lang === "en"
      ? 'Respond ONLY in JSON: {"subject": string (90 characters max, no emoji, mentions the business name), "hook": string (1 to 2 opening sentences), "bullets": string[] (exactly 3 concrete benefits VERIFIABLE for THIS business, 90 characters max each, no trailing period), "closing": string (1 sentence inviting to view the site or to reply)}'
      : 'Réponds UNIQUEMENT en JSON : {"subject": string (90 caractères max, sans emoji, mentionne le nom du commerce), "hook": string (1 à 2 phrases d\'ouverture), "bullets": string[] (exactement 3 bénéfices concrets ET vérifiables pour CE commerce, 90 caractères max chacun, sans point final), "closing": string (1 phrase qui invite à regarder le site ou à répondre)}';

  const pass1 = await agentThinkJson<SalesCopyRaw>({
    agent: "saler",
    task: "redaction_offre_p1",
    instruction: `${brief}${modelNote ? `\n${modelNote}` : ""}\n${jsonShape}`,
    input: factsWithModel,
    maxTokens: 900,
    temperature: 0.8,
    lang,
  });

  const pass2 = await agentThinkJson<SalesCopyRaw>({
    agent: "saler",
    task: "redaction_offre_p2",
    instruction:
      (lang === "en"
        ? "You are a senior sales director. Review and REWRITE this cold email draft: sharpen specificity, clarity, brevity and credibility; make the call to action obvious. Keep the JSON structure with the SAME keys, same limits. Everything must stay in NATIVE US ENGLISH — remove any French word. One exclamation mark maximum."
        : "Tu es directeur commercial senior. Critique puis RÉÉCRIS ce brouillon d'email de prospection : plus de spécificité, de clarté, de brièveté et de crédibilité ; rende l'appel à l'action évident. Garde la structure JSON avec les MÊMES clés et les mêmes limites. Tout doit rester en français — supprime tout mot anglais. Un seul point d'exclamation maximum.") +
      `\n${jsonShape}`,
    input: (lang === "en" ? "BUSINESS SHEET:\n" : "FICHE DU COMMERCE :\n") +
      `${factsWithModel}\n\n${lang === "en" ? "DRAFT TO REVIEW:" : "PROPOSITION À CRITIQUER :"}\n${JSON.stringify(pass1)}`,
    maxTokens: 900,
    temperature: 0.4,
    lang,
  });

  const pack = LANG_PACKS[lang];
  const fallbacks: SalesCopy = {
    subject: pack.fallbackSubject(p.businessName),
    hook: pack.fallbackHook(p),
    bullets: pack.fallbackBullets(p),
    offerTitle: pack.offerTitleFallback,
    cta: pack.cta,
    closing: pack.fallbackClosing,
  };
  return coerceCopy(sanitizeCopyRaw(pass2 ?? pass1), fallbacks);
}

/* ─────────── Template d'agence ─────────── */

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FONT = "-apple-system,'Segoe UI',Arial,sans-serif";

function renderEmail(opts: {
  p: Prospect;
  copy: SalesCopy;
  previewUrl: string;
  offer: { main: string; approx: string | null };
  renewalOffer: { main: string; approx: string | null };
  includedFeatures: string[];
  lang: Lang;
  agencyAddress?: string;
}): string {
  const pack = LANG_PACKS[opts.lang];
  const { copy, p } = opts;

  const bulletRow = (text: string, size: number) =>
    `<tr><td valign="top" style="padding:0 0 12px 0;width:30px"><span style="color:#00A57E;font-weight:800;font-size:15px">✓</span></td><td valign="top" style="padding:0 0 12px 0;font-size:${size}px;color:#3a3f4a;line-height:1.55">${esc(text)}</td></tr>`;

  const bulletsHtml = copy.bullets.map((b) => bulletRow(b, 15)).join("\n      ");
  const includedHtml = opts.includedFeatures.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 6px 0"><tr><td style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#00A57E">${esc(pack.includedTitle)}</td></tr></table>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${opts.includedFeatures.map((f) => bulletRow(f, 14)).join("\n      ")}
    </table>`
    : "";

  const howHtml =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 6px 0"><tr><td style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#00A57E">${esc(pack.howTitle)}</td></tr></table>
    <table role="presentation" cellpadding="0" cellspacing="0">
      ${pack.howSteps.map((s, i) => `<tr><td valign="top" style="padding:0 0 12px 0;width:34px"><span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:11px;background:#00A57E;color:#0B1220;font-size:12px;font-weight:800">${i + 1}</span></td><td valign="top" style="padding:0 0 12px 0;font-size:14.5px;color:#3a3f4a;line-height:1.55">${esc(s)}</td></tr>`).join("\n      ")}
    </table>`;

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
    ${includedHtml}
    ${howHtml}
    ${proofHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0B1220;border-radius:14px;margin:8px 0 0 0">
      <tr><td style="padding:24px 28px">
        <div style="font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:#00E5A0">${esc(copy.offerTitle)}</div>
        <div style="font-size:16px;font-weight:700;color:#ffffff;margin-top:10px">${esc(pack.offerIntro)} ${esc(p.businessName)}</div>
        <div style="font-size:30px;font-weight:800;color:#ffffff;margin-top:6px">${esc(opts.offer.main)}</div>
        ${opts.offer.approx ? `<div style="font-size:13px;font-weight:600;color:rgba(255,255,255,.66);margin-top:2px">${esc(opts.offer.approx)}</div>` : ""}
        <div style="margin-top:12px"><span style="display:inline-block;background:rgba(0,229,160,.14);color:#7CFFDC;font-size:12.5px;font-weight:700;padding:6px 12px;border-radius:20px">${esc(pack.offerDays)}</span>
        <span style="display:inline-block;color:rgba(255,255,255,.66);font-size:12.5px;margin-left:8px">${esc(pack.offerAll)}</span></div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px">
          <tr><td style="padding:0 0 6px 0;font-size:13px;color:#7CFFDC">✓ ${esc(pack.domainIncluded)}</td></tr>
          <tr><td style="padding:0 0 6px 0;font-size:13px;color:#7CFFDC">✓ ${esc(pack.hostingIncluded)}</td></tr>
          <tr><td style="padding:0 0 6px 0;font-size:13px;color:#7CFFDC">✓ ${esc(pack.supportIncluded)}</td></tr>
          <tr><td style="padding:6px 0 0 0;font-size:12.5px;color:rgba(255,255,255,.66)">${esc(pack.renewalLabel)} : ${esc(opts.renewalOffer.main)}${esc(pack.renewalSuffix)}</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="text-align:center;margin:26px 0 10px 0">
      <a href="${esc(opts.previewUrl)}" style="display:inline-block;background:#00E5A0;color:#0B1220;padding:14px 30px;border-radius:40px;text-decoration:none;font-weight:800;font-size:15px">${esc(copy.cta)} →</a>
    </p>
    <p style="text-align:center;margin:0 0 18px 0;font-size:13px;color:#8a90a0">${esc(pack.directLinkLabel)} <a href="${esc(opts.previewUrl)}" style="color:#00A57E;text-decoration:none">${esc(opts.previewUrl)}</a></p>
    <p style="text-align:center;margin:0 0 24px 0;font-size:14px;font-weight:700;color:#22262e">${esc(pack.ctaLine)}</p>
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

function renderEmailText(opts: {
  p: Prospect;
  copy: SalesCopy;
  previewUrl: string;
  offer: { main: string; approx: string | null };
  renewalOffer: { main: string; approx: string | null };
  includedFeatures: string[];
  lang: Lang;
}): string {
  const pack = LANG_PACKS[opts.lang];
  const { copy, p } = opts;
  const lines = [
    copy.hook,
    "",
    ...copy.bullets.map((b) => `• ${b}`),
  ];
  if (opts.includedFeatures.length) {
    lines.push("", pack.includedTitle + " :", ...opts.includedFeatures.map((f) => `• ${f}`));
  }
  lines.push(
    "",
    `${pack.howTitle}${opts.lang === "en" ? ":" : " :"}`,
    ...pack.howSteps.map((s, i) => `${i + 1}. ${s}`),
    "",
    `${pack.offerIntro} ${p.businessName}`,
    `${opts.offer.main}${opts.offer.approx ? ` (${opts.offer.approx})` : ""} — ${pack.offerAll}`,
    `✓ ${pack.domainIncluded}`,
    `✓ ${pack.hostingIncluded}`,
    `✓ ${pack.supportIncluded}`,
    `${pack.renewalLabel} : ${opts.renewalOffer.main}${pack.renewalSuffix}`,
    `${pack.offerDays}. ${opts.previewUrl}`,
    "",
    pack.ctaLine,
    copy.closing,
    "",
    "GoSite Digital — gosite.digital",
    pack.stopLine,
  );
  return lines.join("\n");
}

/* ─────────── Envoi ─────────── */

const FX_TTL_MS = 24 * 3600_000;

/** Taux de change réels depuis open.er-api.com (gratuit, sans clé), cachés
 *  24 h dans les Réglages (FX_RATES). Jamais de throw : sans taux fiables on
 *  retourne null et l'email part en USD — jamais un montant faux. */
async function getRates(): Promise<Rates | null> {
  let stale: Rates | null = null;
  try {
    const raw = (await getSetting("FX_RATES")).trim();
    if (raw) {
      const parsed = JSON.parse(raw) as { rates?: Rates; fetchedAt?: string };
      if (parsed.rates) {
        if (Date.now() - new Date(parsed.fetchedAt ?? 0).getTime() < FX_TTL_MS) return parsed.rates;
        stale = parsed.rates;
      }
    }
  } catch { /* cache illisible : on tente un fetch neuf */ }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) });
    const json = (await res.json()) as { result?: string; rates?: Rates };
    if (res.ok && json.result === "success" && json.rates) {
      await setSetting("FX_RATES", JSON.stringify({ rates: json.rates, fetchedAt: new Date().toISOString() }));
      return json.rates;
    }
  } catch { /* réseau : on retombe sur le cache expiré */ }
  return stale;
}

/** Inclusions réelles du site généré, dérivées de la fiche (SiteConfig).
 *  En cas d'erreur, liste vide : le bloc est omis, l'envoi ne casse jamais. */
async function includedFeaturesFor(p: Prospect): Promise<string[]> {
  try {
    const { buildSiteConfig } = await import("./site-config");
    const { generateIncludedFeatures } = await import("./bundle");
    return generateIncludedFeatures(buildSiteConfig((p.clientData ?? {}) as Record<string, string>, p.id));
  } catch {
    return [];
  }
}

export type SendResult = { ok: boolean; simulated: boolean; messageId?: string; error?: string; subject?: string; bodyHtml?: string; token?: string };

export async function sendSalesEmail(p: Prospect, previewUrl: string): Promise<SendResult> {
  // Opt-out : aucune copie, aucun appel LLM pour une adresse désinscrite.
  const { isDoNotContact } = await import("./dnc");
  if (await isDoNotContact(p.email)) {
    return { ok: false, simulated: false, error: `do_not_contact : ${p.email} est désinscrit, envoi bloqué` };
  }
  const price = parseFloat((await getSetting("OFFER_PRICE")) || "259") || 259;
  const renewal = parseFloat((await getSetting("RENEWAL_PRICE")) || "45") || 45;
  // Devise du lead : la fiche (CURRENCY, remplie par le Mapper) gagne, sinon la
  // géo du pays — conversion au taux réel par fx (jamais le chiffre brut
  // réutilisé dans une autre devise).
  const currency = resolveDisplayCurrency(p);
  const lang = resolveLang(p);

  // 🧠 Copy en 2 passes avec garde-fous (sanitize) et repli complet par langue
  const copy = await aiSalesCopy(p, lang);

  // Taux de change réels (cache 24 h) — sans taux fiables, l'email part en USD.
  const rates = await getRates();
  const offer = displayOffer(price, currency, rates);
  const renewalOffer = displayOffer(renewal, currency, rates);

  // Inclusions réelles du site généré (faits du bundle, jamais inventées).
  const includedFeatures = await includedFeaturesFor(p);

  const senderEmail = await getSetting("BREVO_SENDER_EMAIL");
  const agencyAddress = await getSetting("AGENCY_ADDRESS");
  const token = newEmailToken();
  const appBase = await appBaseUrl();
  const bodyText0 = renderEmailText({ p, copy, previewUrl, offer, renewalOffer, includedFeatures, lang });
  const bodyHtml = injectPixel(wrapLinks(renderEmail({ p, copy, previewUrl, offer, renewalOffer, includedFeatures, lang, agencyAddress }), appBase, token), appBase, token);
  const bodyText = trackifyText(bodyText0, appBase, token);
  const content: SendResult = { ok: false, simulated: false, subject: copy.subject, bodyHtml, token };

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
// footer adresse légale, threading In-Reply-To/References — et tracking :
// le token renvoyé est archivé avec l'email (pixel + liens redirigés).
export async function sendAgentReply(params: {
  to: string;
  subject: string;
  bodyText: string;
  inReplyTo?: string;
  references?: string;
  /** Langue du client (footer STOP localisé) — défaut fr. */
  lang?: "fr" | "en";
}): Promise<{ ok: boolean; simulated?: boolean; messageId?: string; error?: string; token?: string }> {
  if (!params.to) return { ok: false, error: "Email destinataire absent" };
  if (!(await brevoConfigured())) {
    return { ok: false, error: "Brevo non configuré (BREVO_API_KEY + email expéditeur dans Réglages)" };
  }
  const senderEmail = await getSetting("BREVO_SENDER_EMAIL");
  const agencyAddress = await getSetting("AGENCY_ADDRESS");
  const stopLine = params.lang === "en" ? "Reply STOP to stop being contacted." : "Répondez STOP pour ne plus être contacté.";
  const footer = agencyAddress
    ? `\n\n— GoSite Digital\n${agencyAddress}\n${stopLine}`
    : `\n\n— GoSite Digital\n${stopLine}`;
  const fullText = params.bodyText + footer;
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<mailto:${senderEmail}?subject=STOP>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  if (params.inReplyTo) headers["In-Reply-To"] = params.inReplyTo;
  if (params.references) headers["References"] = params.references;
  const token = newEmailToken();
  const appBase = await appBaseUrl();
  const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bodyHtml =
    `<div style="font-family:${FONT};font-size:14.5px;color:#22262e;line-height:1.65">` +
    linkifyEscaped(esc(params.bodyText).replace(/\n/g, "<br>"), appBase, token) +
    `<br><br><span style="font-size:12px;color:#8a90a0">${esc(footer.trim())}</span><br>` +
    injectPixel("", appBase, token) +
    `</div>`;
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
        htmlContent: bodyHtml,
        textContent: trackifyText(fullText, appBase, token),
        headers,
      }),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json()) as { messageId?: string; message?: string };
    if (!res.ok) return { ok: false, error: json.message ?? `HTTP ${res.status}` };
    return { ok: true, messageId: json.messageId, token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network" };
  }
}
