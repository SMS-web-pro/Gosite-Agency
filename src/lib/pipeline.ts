// Orchestrateur — chaque étape du pipeline est exécutée et journalisée
// par son agent dédié. RIO reçoit une notification Telegram aux jalons clés.

import { db } from "@/db";
import { prospects, emails, type Prospect } from "@/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { logActivity } from "./activity";
import { ensureAgentsSeeded, markAgentRunEnd, markAgentRunStart } from "./agents";
import { scoutSearch, provisionReplacementKey } from "./serper";
import { verifyEmail } from "./email-verify";
import { buildClientSheet, validateSheet } from "./mapper";
import { buildSite } from "./coder";
import { deployToVercel, linkDomain, slugifyId } from "./deploy";
import { sendSalesEmail } from "./emailer";
import { createWhopPayment } from "./whop";
import { notifyTelegram } from "./telegram";

export const STAGES = [
  "discovered", "validated", "email_verified", "mapped",
  "site_built", "deployed", "contacted", "paid", "domain_linked",
] as const;

export type Stage = (typeof STAGES)[number] | "rejected";

export const STAGE_META: Record<string, { label: string; agent: string; agentName: string }> = {
  discovered: { label: "Découvert", agent: "prospector", agentName: "Prospector" },
  validated: { label: "Qualifié", agent: "validator", agentName: "Validator" },
  email_verified: { label: "Email vérifié", agent: "emailor", agentName: "Emailor" },
  mapped: { label: "Fiche complète", agent: "mapper", agentName: "Mapper" },
  site_built: { label: "Site généré", agent: "coder", agentName: "Coder" },
  deployed: { label: "Déployé", agent: "deployer", agentName: "Deployer" },
  contacted: { label: "Contacté", agent: "saler", agentName: "Saler" },
  paid: { label: "Payé", agent: "paymer", agentName: "Paymer" },
  domain_linked: { label: "Domaine lié", agent: "domainner", agentName: "Domainner" },
  rejected: { label: "Rejeté", agent: "validator", agentName: "Validator" },
};

const stageRank = (s: string) => (STAGES as readonly string[]).indexOf(s);

// ─────────────────────────── 1. PROSPECTOR ───────────────────────────
export async function runScoutMission(
  niche: string,
  city: string,
  maxResults = 30,
  opts: { telegram?: boolean; strategy?: "precise" | "swarm" } = {},
) {
  await ensureAgentsSeeded();
  const strategy = opts.strategy ?? "swarm";
  await markAgentRunStart("prospector");
  await logActivity({
    agentKey: "prospector", action: "mission_demarree",
    message: `Mission de prospection lancée : "${niche}" à ${city} — stratégie ${strategy === "swarm" ? "essaim multi-requêtes" : "requête unique précise"}, cible ${maxResults} fiches.`,
  });
  try {
    const result = await scoutSearch(niche, city, maxResults, strategy);
    if (result.error) {
      await markAgentRunEnd("prospector", false, result.error);
      await logActivity({
        agentKey: "prospector", action: "mission_bloquee",
        message: `Mission "${niche} / ${city}" bloquée : ${result.error}`, level: "error",
      });
      await notifyTelegram(`🔴 <b>Prospector</b> — mission "${niche} / ${city}" bloquée.\n${result.error}`);
      throw new Error(`BLOCKED:${result.error}`);
    }
    let inserted = 0;
    let duplicates = 0;
    for (const place of result.places) {
      const existing = await db
        .select({ id: prospects.id })
        .from(prospects)
        .where(and(eq(prospects.businessName, place.businessName), eq(prospects.city, place.city)))
        .limit(1);
      if (existing.length > 0) { duplicates++; continue; }
      await db.insert(prospects).values({
        businessName: place.businessName,
        businessType: place.businessType,
        phone: place.phone,
        email: place.email,
        address: place.address,
        city: place.city,
        zip: place.zip,
        country: place.country,
        rating: String(place.rating),
        reviewCount: place.reviewCount,
        hasWebsite: place.hasWebsite,
        websiteUrl: place.websiteUrl,
        mapsLink: place.mapsLink,
        lat: String(place.lat),
        lng: String(place.lng),
        hours: place.hours,
        source: place.source,
        searchQuery: place.searchQuery,
        stage: "discovered",
      });
      inserted++;
    }
    await markAgentRunEnd("prospector", true);
    const perQuery = (result.queries ?? []).map((q) => `«${q.query}» ${q.kept} uniques/${q.found}`).join(" · ");
    await logActivity({
      agentKey: "prospector", action: "mission_terminee",
      message:
        `${inserted} nouveaux leads importés (${duplicates} doublons ignorés) — mode ${result.mode === "live" ? "Serper LIVE" : "simulation"}` +
        (result.creditsSpent ? ` · ${result.creditsSpent} crédit(s) consommé(s)` : "") +
        (perQuery ? ` · requêtes : ${perQuery}` : ""),
      level: "success",
      meta: { mode: result.mode, rotated: result.rotated, key: result.keyUsed?.label, queries: result.queries, creditsSpent: result.creditsSpent },
    });
    if (opts.telegram) {
      await notifyTelegram(
        `🔍 <b>Prospector</b> — "${niche}" à ${city}\n` +
          `${inserted} nouveaux leads · ${duplicates} doublons` +
          (result.queries?.length ? `\n${result.queries.map((q) => `• «${q.query}» → ${q.kept} fiches`).join("\n")}` : "") +
          (result.rotated ? `\n♻️ Rotation de compte effectuée` : ""),
      );
    }
    return { inserted, duplicates, mode: result.mode, rotated: result.rotated, places: result.places, queries: result.queries, creditsSpent: result.creditsSpent, reasoning: result.reasoning };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    if (!msg.startsWith("BLOCKED:")) {
      await markAgentRunEnd("prospector", false, msg);
      await logActivity({ agentKey: "prospector", action: "erreur", message: `Mission échouée : ${msg}`, level: "error" });
    }
    throw err;
  }
}

// ─────────────────────────── 2. VALIDATOR ───────────────────────────
// 🧠 Évaluation IA du potentiel commercial, par-delà les seuils chiffrés.
async function aiQualify(p: Prospect): Promise<{ score: number; insight: string; verdict: "go" | "no-go" } | null> {
  const { agentThinkJson } = await import("./agent-brain");
  return agentThinkJson<{ score: number; insight: string; verdict: "go" | "no-go" }>({
    agent: "validator",
    task: "qualification",
    instruction:
      "Évalue le potentiel commercial de ce prospect pour une offre de site vitrine à ~490€. " +
      "Prends en compte : preuve sociale (note/avis), type de commerce (un indépendant décide vite, une chaîne non), " +
      "absence de site, capacité à payer. Donne un score de 0 à 100 et un verdict. " +
      'Réponds en JSON : {"score": number, "insight": "une phrase d\'analyse", "verdict": "go"|"no-go"}',
    input: `Nom: ${p.businessName}\nType: ${p.businessType}\nVille: ${p.city}\nNote: ${p.rating}/5\nAvis: ${p.reviewCount}\nSite web existant: ${p.hasWebsite ? p.websiteUrl : "aucun"}\nTéléphone: ${p.phone ?? "aucun"}\nEmail: ${p.email ?? "aucun"}`,
    maxTokens: 220,
    temperature: 0.3,
  });
}

export async function validateProspect(p: Prospect): Promise<{ ok: boolean; reason?: string }> {
  await markAgentRunStart("validator");
  const rating = parseFloat(String(p.rating ?? "0"));
  const reviews = p.reviewCount ?? 0;
  // 🧠 Le cerveau IA affine la décision et attribue un score de potentiel
  const ai = await aiQualify(p);

  // Règles dures (réputation + vitrine déjà présente)
  let reason: string | null = null;
  if (rating < 4.0) reason = `Note Google insuffisante (${rating}/5 < 4,0)`;
  else if (reviews < 10) reason = `Pas assez d'avis (${reviews} < 10)`;
  else if (p.hasWebsite) reason = "Possède déjà un site web";

  // Le contact : si rien n'est visible, on laisse Emailor tenter la découverte
  // globale + les patterns IA. Seul l'échec prouvé bloque le lead.
  if (!reason) {
    if (!p.email && !p.phone) {
      const { discoverEmail } = await import("./discover");
      const found = await discoverEmail(p.businessName, p.city);
      if (found) {
        const test = await verifyEmail(found);
        if (test.status === "invalid") {
          reason = `Aucun canal de contact : email découvert (${found}) invalide (${test.detail}), pas de téléphone.`;
        } else {
          await db.update(prospects).set({
            email: found, emailStatus: test.status, emailDetail: test.detail, updatedAt: new Date(),
          }).where(eq(prospects.id, p.id));
          p = { ...p, email: found };
        }
      } else {
        reason = "Aucun canal de contact trouvé (ni email public, ni téléphone sur la fiche).";
      }
    }
  }

  // 🧠 Veto IA : potentiel jugé nul (chaîne, franchise, décision non locale)
  if (!reason && ai && ai.verdict === "no-go" && (ai.score ?? 100) < 30) {
    reason = `Potentiel jugé trop faible par l'analyse IA (${ai.score}/100) : ${ai.insight}`;
  }

  if (reason) {
    const isAiVeto = reason.startsWith("Potentiel jugé trop faible");
    await db.update(prospects).set({
      stage: "rejected", rejectReason: reason,
      aiScore: ai?.score ?? null, aiInsight: ai?.insight ?? null,
      updatedAt: new Date(),
    }).where(eq(prospects.id, p.id));
    await markAgentRunEnd("validator", true);
    await logActivity({
      agentKey: "validator", action: isAiVeto ? "lead_rejete_ia" : "lead_rejete",
      message: `${p.businessName} rejeté : ${reason}.`, level: "warn", prospectId: p.id,
    });
    return { ok: false, reason };
  }

  await db.update(prospects).set({
    stage: "validated",
    aiScore: ai?.score ?? null,
    aiInsight: ai?.insight ?? null,
    updatedAt: new Date(),
  }).where(eq(prospects.id, p.id));
  await markAgentRunEnd("validator", true);
  await logActivity({
    agentKey: "validator", action: "lead_qualifie",
    message: `${p.businessName} qualifié : ⭐${rating} (${reviews} avis), sans site web${ai ? ` · potentiel IA ${ai.score}/100 — ${ai.insight}` : ""}`,
    level: "success", prospectId: p.id,
  });
  return { ok: true };
}

export async function runBulkValidation() {
  await ensureAgentsSeeded();
  const pending = await db.select().from(prospects).where(eq(prospects.stage, "discovered")).orderBy(desc(prospects.createdAt)).limit(50);
  let validated = 0, rejected = 0;
  for (const p of pending) {
    const r = await validateProspect(p);
    r.ok ? validated++ : rejected++;
  }
  return { checked: pending.length, validated, rejected };
}

// ─────────────────────────── 3. EMAILOR ───────────────────────────
export async function verifyProspectEmail(p: Prospect) {
  await markAgentRunStart("emailor");
  // Les fiches Serper réelles n'exposent pas d'email — découverte publique
  if (!p.email) {
    const { discoverEmail } = await import("./discover");
    const found = await discoverEmail(p.businessName, p.city);
    if (found) {
      await db.update(prospects).set({ email: found, updatedAt: new Date() }).where(eq(prospects.id, p.id));
      p = { ...p, email: found };
    }
  }

  // 🧠 Toujours rien ? Emailor déduit les adresses les plus probables et les teste
  if (!p.email) {
    const { agentThinkJson } = await import("./agent-brain");
    const guess = await agentThinkJson<{ candidates: string[] }>({
      agent: "emailor",
      task: "deduction_email",
      instruction:
        "Déduis jusqu'à 4 adresses email plausibles pour ce commerce, du plus au moins probable. " +
        "Utilise les conventions réelles des petits commerces (contact@domaine, nomducommerce@gmail.com, etc.). " +
        'Réponds en JSON : {"candidates": ["email1", "email2"]}',
      input: `Nom: ${p.businessName}\nVille: ${p.city}\nPays: ${p.country}\nType: ${p.businessType}\nSite web: ${p.websiteUrl ?? "aucun"}`,
      maxTokens: 200,
      temperature: 0.3,
    });
    for (const candidate of (guess?.candidates ?? []).slice(0, 4)) {
      const test = await verifyEmail(candidate);
      if (test.status === "valid") {
        await db.update(prospects).set({ email: candidate, updatedAt: new Date() }).where(eq(prospects.id, p.id));
        p = { ...p, email: candidate };
        await logActivity({
          agentKey: "emailor", action: "email_deduit",
          message: `Adresse déduite par l'IA et validée (MX ✓) pour ${p.businessName} : ${candidate}`,
          level: "success", prospectId: p.id,
        });
        break;
      }
    }
  }
  const check = await verifyEmail(p.email);
  if (check.status === "invalid") {
    await db.update(prospects).set({ emailStatus: "invalid", emailDetail: check.detail, stage: "rejected", rejectReason: `Email invalide : ${check.detail}`, updatedAt: new Date() }).where(eq(prospects.id, p.id));
    await markAgentRunEnd("emailor", true);
    await logActivity({ agentKey: "emailor", action: "email_invalide", message: `${p.email ?? "?"} rejeté — ${check.detail}`, level: "warn", prospectId: p.id });
    return { ok: false as const, check };
  }
  const stage = check.status === "valid" ? "email_verified" : p.stage === "validated" ? "email_verified" : p.stage;
  await db.update(prospects).set({ emailStatus: check.status, emailDetail: check.detail, stage, updatedAt: new Date() }).where(eq(prospects.id, p.id));
  await markAgentRunEnd("emailor", true);
  await logActivity({
    agentKey: "emailor", action: "email_verifie",
    message: `${p.email} → ${check.status === "valid" ? "boîte valide et fonctionnelle" : "délivrabilité à risque"} (${check.detail})`,
    level: check.status === "valid" ? "success" : "warn", prospectId: p.id, meta: { mx: check.mxHosts },
  });
  return { ok: true as const, check };
}

// ─────────────────────────── 4. MAPPER ───────────────────────────
export async function mapProspect(p: Prospect) {
  await markAgentRunStart("mapper");
  const sheet = buildClientSheet(p);

  // 🧠 Mapper enrichit la fiche : accroche, description et angle éditorial sur-mesure
  const { agentThinkJson } = await import("./agent-brain");
  const enriched = await agentThinkJson<{ tagline: string; description: string; style: string; angle: string }>({
    agent: "mapper",
    task: "enrichissement_fiche",
    instruction:
      "Rédige l'identité éditoriale de ce commerce pour son futur site vitrine. " +
      "tagline : accroche percutante en français, max 8 mots, spécifique au métier et à la ville, sans point d'exclamation. " +
      "description : 2 phrases naturelles décrivant l'établissement, ancrées localement, sans superlatif creux. " +
      "style : un seul mot parmi luxury, bold, warm, minimal, urban. " +
      "angle : en une phrase, l'argument de vente principal à mettre en avant. " +
      'Réponds en JSON : {"tagline": string, "description": string, "style": string, "angle": string}',
    input: `Nom: ${p.businessName}\nType: ${p.businessType}\nVille: ${p.city}, ${p.country}\nAdresse: ${p.address}\nNote Google: ${p.rating}/5 avec ${p.reviewCount} avis\nAnalyse du Validator: ${p.aiInsight ?? "—"}`,
    maxTokens: 400,
    temperature: 0.7,
  });
  if (enriched?.tagline) sheet.TAGLINE = enriched.tagline.slice(0, 90);
  if (enriched?.description) sheet.DESCRIPTION = enriched.description.slice(0, 400);
  if (enriched?.style && ["luxury", "bold", "warm", "minimal", "urban"].includes(enriched.style)) sheet.STYLE = enriched.style;
  if (enriched?.angle) sheet.SELLING_ANGLE = enriched.angle.slice(0, 220);

  const validation = validateSheet(sheet);
  if (!validation.ok) {
    await markAgentRunEnd("mapper", false, `Champs manquants: ${validation.missing.join(",")}`);
    await logActivity({ agentKey: "mapper", action: "fiche_incomplete", message: `${p.businessName} : fiche incomplète (${validation.missing.join(", ")})`, level: "error", prospectId: p.id });
    throw new Error("Fiche client incomplète");
  }
  await db.update(prospects).set({ clientData: sheet, tagline: sheet.TAGLINE, description: sheet.DESCRIPTION, stage: "mapped", updatedAt: new Date() }).where(eq(prospects.id, p.id));
  await markAgentRunEnd("mapper", true);
  await logActivity({
    agentKey: "mapper", action: "fiche_validee",
    message: `Fiche client remplie et validée : 28 champs · palette ${sheet.PRIMARY_COLOR}/${sheet.ACCENT_COLOR} · ${sheet.SCHEMA_TYPE} · ${sheet.LOCALE}.`,
    level: "success", prospectId: p.id,
  });
  return sheet;
}

// ─────────────────────────── 5. CODER ───────────────────────────
export async function buildProspectSite(p: Prospect) {
  await markAgentRunStart("coder");
  const sheet = p.clientData ?? buildClientSheet(p);
  const result = await buildSite(sheet);
  const slug = await decideSlug(p);
  await db.update(prospects).set({ siteHtml: result.html, siteSlug: slug, stage: "site_built", updatedAt: new Date() }).where(eq(prospects.id, p.id));
  await markAgentRunEnd("coder", true);
  await logActivity({
    agentKey: "coder", action: "site_genere",
    message: `Site généré pour ${p.businessName} (${(result.html.length / 1024).toFixed(0)} Ko) — moteur ${result.engine === "llm" ? "LLM omniroute" : "gabarit interne"}.`,
    level: "success", prospectId: p.id, meta: { engine: result.engine, size: result.html.length },
  });
  return { ...result, slug };
}

// ─────────────────────────── 6. DEPLOYER ───────────────────────────
// 🧠 Deployer choisit un sous-domaine court et crédible
async function aiSlug(p: Prospect): Promise<string> {
  const fallback = slugifyId(p.businessName);
  const { agentThinkJson } = await import("./agent-brain");
  const out = await agentThinkJson<{ slug: string }>({
    agent: "deployer",
    task: "nommage_sousdomaine",
    instruction:
      "Propose un identifiant de sous-domaine pour ce commerce : minuscules, sans accents, tirets simples, 30 caractères max, " +
      "reconnaissable par le client (pas de mots génériques). " +
      'Réponds en JSON : {"slug": "mon-commerce-ville"}',
    input: `Nom: ${p.businessName}\nVille: ${p.city}\nType: ${p.businessType}`,
    maxTokens: 80,
    temperature: 0.3,
  });
  const clean = (out?.slug ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return clean.length >= 4 && clean.length <= 34 ? clean : fallback;
}

// Garantit l'unicité du siteSlug : sans le préfixe à id, deux commerces du même
// nom peuvent aboutir au même sous-domaine — on suffixe en cas de collision.
async function uniqueSiteSlug(candidate: string, selfId: number): Promise<string> {
  const base = candidate.slice(0, 36);
  let s = base;
  let n = 2;
  for (;;) {
    const taken = await db
      .select({ id: prospects.id })
      .from(prospects)
      .where(and(eq(prospects.siteSlug, s), ne(prospects.id, selfId)))
      .limit(1);
    if (!taken.length) return s;
    s = `${base}-${n++}`.slice(0, 40);
  }
}

// Slug final : les slugs d'avant la v1 étaient préfixés c{id}- — on converge
// vers le nom nu avant d'assurer l'unicité en base.
function decideSlug(p: Prospect): Promise<string> {
  return uniqueSiteSlug(p.siteSlug?.replace(/^c\d+-/, "") ?? slugifyId(p.businessName), p.id);
}

export async function deployProspectSite(p: Prospect) {
  await markAgentRunStart("deployer");
  if (!p.siteHtml) throw new Error("Aucun site généré");
  const slug = await decideSlug(p);
  const res = await deployToVercel(slug, p.siteHtml);
  if (!res.ok) {
    await markAgentRunEnd("deployer", false, res.error);
    await logActivity({ agentKey: "deployer", action: "deploy_echec", message: `Déploiement Vercel échoué : ${res.error}`, level: "error", prospectId: p.id });
    throw new Error(res.error);
  }
  // URL finale = sous-domaine de l'agence : {slug}.{AGENCY_DOMAIN}.
  // Le lien de domaine est appliqué immédiatement après le déploiement ;
  // l'URL *.vercel.app n'est qu'un repli temporaire si la liaison échoue.
  let finalUrl = res.url;
  let domainMode = "Vercel production";
  if (res.mode === "vercel") {
    const domainRes = await linkDomain(slug, "");
    if (domainRes.ok) {
      finalUrl = domainRes.url;
      domainMode = "sous-domaine agence lié";
    } else {
      domainMode = `Vercel production — sous-domaine agence non lié (${domainRes.error})`;
      await logActivity({
        agentKey: "deployer", action: "domaine_agence_echec",
        message: `Sous-domaine agence non lié (URL Vercel temporaire en place) : ${domainRes.error}`,
        level: "warn", prospectId: p.id,
      });
    }
  }
  await db.update(prospects).set({ deployedUrl: finalUrl, deployStatus: res.mode === "vercel" ? "live" : "simulated", siteSlug: slug, stage: "deployed", updatedAt: new Date() }).where(eq(prospects.id, p.id));
  await markAgentRunEnd("deployer", true);
  await logActivity({
    agentKey: "deployer", action: "deploiement",
    message: `${slug} déployé → ${finalUrl} (${res.mode === "vercel" ? domainMode : "simulation, preview sandbox active"}).`,
    level: "success", prospectId: p.id, meta: { url: finalUrl, mode: res.mode },
  });
  await notifyTelegram(`🚀 <b>Deployer</b> — ${p.businessName}\nSite en ligne : ${finalUrl}${res.mode === "simulated" ? "\n(mode simulation : ajoutez VERCEL_TOKEN pour un vrai déploiement)" : ""}`);
  return { ok: res.ok, url: finalUrl, mode: res.mode, error: res.error };
}

// ─────────────────────────── 7. SALER ───────────────────────────
// Chaque tentative d'envoi est archivée en base (succès ET échec) :
// source de vérité consultable dans l'app, indépendante de Brevo.
export async function contactProspect(p: Prospect) {
  await markAgentRunStart("saler");
  const preview = p.deployedUrl ?? "";
  if (!preview) throw new Error("Site non déployé");
  // Opt-out : on ne contacte jamais une adresse désinscrite.
  const { isDoNotContact } = await import("./dnc");
  if (await isDoNotContact(p.email)) {
    await markAgentRunEnd("saler", false, "do_not_contact");
    await logActivity({ agentKey: "saler", action: "envoi_bloque", message: `Envoi bloqué : ${p.email} est sur la liste do-not-contact.`, level: "warn", prospectId: p.id });
    throw new Error("do_not_contact");
  }
  // Réservation atomique : un seul appel peut passer de "deployed" à "contacting".
  // Tout appel concurrent (cron + RIO + manuel) repart sans envoyer, ce qui
  // garantit zéro double-email au commerçant.
  const claimed = await db.update(prospects)
    .set({ stage: "contacting", updatedAt: new Date() })
    .where(and(eq(prospects.id, p.id), eq(prospects.stage, "deployed")))
    .returning();
  if (claimed.length === 0) {
    await markAgentRunEnd("saler", false, "deja_contacte");
    throw new Error("Lead déjà contacté ou en cours d'envoi");
  }
  let res: Awaited<ReturnType<typeof sendSalesEmail>>;
  try {
    res = await sendSalesEmail(p, preview);
  } catch (err) {
    // Libère le lead pour une nouvelle tentative ultérieure.
    await db.update(prospects).set({ stage: "deployed", updatedAt: new Date() }).where(eq(prospects.id, p.id));
    await markAgentRunEnd("saler", false, err instanceof Error ? err.message : "erreur envoi");
    throw err;
  }
  // L'archivage ne doit jamais casser l'envoi : en cas de souci DB ce sont uniquement
  // les logs qui manqueront, le flux Saler continue.
  const tryArchive = async (row: typeof emails.$inferInsert) => {
    try {
      await db.insert(emails).values(row).onConflictDoNothing();
    } catch (e) {
      console.error("[archive email] non bloquant:", e instanceof Error ? e.message : e);
    }
  };
  if (!res.ok) {
    await tryArchive({
      prospectId: p.id, toEmail: p.email ?? "", subject: res.subject ?? null,
      bodyHtml: res.bodyHtml ?? null, status: "failed", error: res.error ?? null,
    });
    // Libère le lead pour une nouvelle tentative (ex. panne LLM/Brevo temporaire).
    await db.update(prospects).set({ stage: "deployed", updatedAt: new Date() }).where(eq(prospects.id, p.id));
    await markAgentRunEnd("saler", false, res.error);
    await logActivity({ agentKey: "saler", action: "envoi_echec", message: `Envoi à ${p.email} échoué : ${res.error}`, level: "error", prospectId: p.id });
    throw new Error(res.error);
  }
  await tryArchive({
    prospectId: p.id, toEmail: p.email ?? "", subject: res.subject ?? null,
    bodyHtml: res.bodyHtml ?? null, status: res.simulated ? "simulated" : "sent",
    messageId: res.messageId ?? null,
  });
  await db.update(prospects).set({ salesEmailId: res.messageId ?? null, contactedAt: new Date(), stage: "contacted", updatedAt: new Date() }).where(eq(prospects.id, p.id));
  await markAgentRunEnd("saler", true);
  await logActivity({
    agentKey: "saler", action: "offre_envoyee",
    message: `Offre personnalisée envoyée à ${p.email} avec lien de prévisualisation ${preview} (${res.simulated ? "simulation Brevo" : "via Brevo SMTP"}).`,
    level: "success", prospectId: p.id,
  });
  await notifyTelegram(`📨 <b>Saler</b> — Offre envoyée à <b>${p.businessName}</b> (${p.email}) avec le lien du site.\nEn attente de réponse…`);
  return res;
}

// ─────────────────────────── 8. PAYMER ───────────────────────────
export async function createPaymentLink(p: Prospect) {
  await markAgentRunStart("paymer");
  const res = await createWhopPayment(p);
  if (!res.ok) {
    await markAgentRunEnd("paymer", false, res.error);
    throw new Error(res.error);
  }
  await db.update(prospects).set({ paymentUrl: res.url, paymentStatus: res.simulated ? "simulated" : "pending", stage: "paid", updatedAt: new Date() }).where(eq(prospects.id, p.id));
  await markAgentRunEnd("paymer", true);

  // 🧠 Paymer prépare le message d'accompagnement du lien de paiement
  const { agentThink } = await import("./agent-brain");
  const pitch = await agentThink({
    agent: "paymer",
    task: "message_paiement",
    instruction: "Rédige en 2 phrases le message qui accompagne l'envoi du lien de paiement à ce client. Rappelle la valeur livrée, reste simple et rassurant, sans pression.",
    input: `Commerce: ${p.businessName} (${p.city})\nSite livré: ${p.deployedUrl ?? "—"}\nLien de paiement: ${res.url}`,
    maxTokens: 200,
    temperature: 0.6,
  });
  if (pitch) {
    await logActivity({ agentKey: "paymer", action: "message_prepare", message: `Message de paiement rédigé : ${pitch.trim().slice(0, 200)}`, level: "info", prospectId: p.id });
  }
  await logActivity({
    agentKey: "paymer", action: "lien_paiement",
    message: `Lien de paiement Whop généré pour ${p.businessName} : ${res.url}${res.simulated ? " (simulation)" : ""}.`,
    level: "success", prospectId: p.id,
  });
  await notifyTelegram(`💳 <b>Paymer</b> — Lien Whop créé pour <b>${p.businessName}</b> : ${res.url}`);
  return res;
}

// ─────────────────────────── 9. DOMAINNER ───────────────────────────
export async function linkProspectDomain(p: Prospect, customDomain?: string) {
  await markAgentRunStart("domainner");
  const slug = await decideSlug(p);

  // 🧠 Domainner propose un domaine crédible si aucun n'est imposé
  let target = customDomain ?? "";
  if (!target) {
    const { agentThinkJson } = await import("./agent-brain");
    const out = await agentThinkJson<{ domain: string; alternatives: string[] }>({
      agent: "domainner",
      task: "suggestion_domaine",
      instruction:
        "Propose le nom de domaine le plus crédible pour ce commerce (extension locale adaptée au pays : .ma pour le Maroc, .fr pour la France). " +
        'Réponds en JSON : {"domain": "exemple.ma", "alternatives": ["autre.ma"]}',
      input: `Nom: ${p.businessName}\nVille: ${p.city}\nPays: ${p.country}\nType: ${p.businessType}`,
      maxTokens: 150,
      temperature: 0.4,
    });
    if (out?.domain) {
      await logActivity({
        agentKey: "domainner", action: "domaine_suggere",
        message: `Domaine recommandé pour ${p.businessName} : ${out.domain}${out.alternatives?.length ? ` (alternatives : ${out.alternatives.slice(0, 2).join(", ")})` : ""}`,
        level: "info", prospectId: p.id,
      });
    }
  }

  const res = await linkDomain(slug, target);
  if (!res.ok) {
    await markAgentRunEnd("domainner", false, res.error);
    throw new Error(res.error);
  }
  await db.update(prospects).set({ domainUrl: res.url, stage: "domain_linked", updatedAt: new Date() }).where(eq(prospects.id, p.id));
  await markAgentRunEnd("domainner", true);
  await logActivity({
    agentKey: "domainner", action: "domaine_lie",
    message: `Domaine ${res.url} lié au déploiement de ${p.businessName} (${res.mode === "vercel" ? "DNS Vercel" : "simulation"}).`,
    level: "success", prospectId: p.id,
  });
  await notifyTelegram(`🌐 <b>Domainner</b> — ${res.url} pointe désormais vers le site de <b>${p.businessName}</b>.`);
  return res;
}

// ─────────────────────────── AUTO-PILOT ───────────────────────────
export async function runFullPipeline(p: Prospect, opts: { telegram?: boolean } = {}) {
  await ensureAgentsSeeded();
  let current: Prospect = { ...p };
  const reload = async () => {
    const rows = await db.select().from(prospects).where(eq(prospects.id, p.id)).limit(1);
    current = rows[0] ?? current;
    return current;
  };
  try {
    if (stageRank(current.stage) < stageRank("validated")) {
      const r = await validateProspect(current);
      if (!r.ok) return { ok: false as const, stage: "rejected", error: r.reason ?? "Rejeté par Validator" };
      await reload();
    }
    if (current.stage === "validated") {
      const r = await verifyProspectEmail(current);
      if (!r.ok) return { ok: false as const, stage: "rejected", error: r.check.detail };
      await reload();
    }
    if (current.stage === "email_verified") { await mapProspect(current); await reload(); }
    if (current.stage === "mapped") { await buildProspectSite(current); await reload(); }
    if (current.stage === "site_built") { await deployProspectSite(current); await reload(); }
    if (current.stage === "deployed") { await contactProspect(current); await reload(); }
    return { ok: true as const, stage: current.stage, deployedUrl: current.deployedUrl ?? undefined };
  } catch (err) {
    await reload();
    return { ok: false as const, stage: current.stage, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// ─────────────────────────── PROVISIONING HOOK ───────────────────────────
export { provisionReplacementKey };
