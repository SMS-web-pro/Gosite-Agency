// ══════════════════════════════════════════════════════════════
// Prospector — moteur Serper.dev en mode ESSAIM.
// Une mission professionnelle n'interroge pas Google une seule fois :
// elle déploie plusieurs requêtes complémentaires (synonymes métier ×
// quartiers de la ville, affinés par l'IA), dédoublonne les fiches,
// analyse le rendement de chaque requête et apprend de ses missions.
// Production-first : sans clé réelle, aucune donnée n'est inventée.
// ══════════════════════════════════════════════════════════════

import { db } from "@/db";
import { serperKeys, type SerperKey } from "@/db/schema";
import { and, asc, eq, lt } from "drizzle-orm";
import { simulatePlaces, type RawPlace } from "./simulate";
import { resolveMissionGeo } from "./geo";
import { logActivity } from "./activity";
import { notifyTelegram } from "./telegram";
import { allowSimulation } from "./settings";

export type QueryStat = { query: string; found: number; kept: number; simulated?: boolean };

export type ScoutResult = {
  places: RawPlace[];
  mode: "live" | "simulation";
  keyUsed: { id: number; label: string; creditsUsed: number; creditLimit: number } | null;
  rotated: boolean;
  provisionedKey?: SerperKey | null;
  error?: string;
  queries?: QueryStat[];
  creditsSpent?: number;
  reasoning?: string;
};

export type ScoutStrategy = "precise" | "swarm";

const NO_KEY_ERROR =
  "Aucune clé Serper.dev active. Créez un compte gratuit sur serper.dev (2500 requêtes offertes) et collez la clé dans Agents → Rotation Serper.";
const QUOTA_ERROR =
  "Tous les comptes Serper ont épuisé leurs 2500 crédits gratuits. Créez un nouveau compte serper.dev et ajoutez la clé — la rotation reprendra automatiquement.";

/* ───────────── Ciblage local : synonymes métier × quartiers ───────────── */

const NICHE_SYNONYMS: Record<string, string[]> = {
  barbershop: ["barber shop", "coiffeur homme", "salon de coiffure homme"],
  barbier: ["barber shop", "coiffeur homme", "barbier traditionnel"],
  coiffeur: ["salon de coiffure", "coiffeur homme", "institut coiffure"],
  "salon de coiffure": ["coiffeur", "coiffeur femme", "barbier"],
  restaurant: ["restaurant traditionnel", "brasserie", "restaurant grill", "restaurant familial"],
  "restaurant marocain": ["restaurant marocain traditionnel", "riad restaurant", "cuisine marocaine", "restaurant tajine"],
  restaurant_marocain: ["restaurant marocain traditionnel", "riad restaurant", "cuisine marocaine", "restaurant tajine"],
  plombier: ["plomberie", "dépannage plomberie", "chauffagiste", "installation sanitaire"],
  plumber: ["plomberie", "dépannage plomberie", "chauffagiste"],
  plomberie: ["plombier", "dépannage plomberie", "chauffagiste"],
  dentiste: ["cabinet dentaire", "orthodontiste", "centre dentaire", "implant dentaire"],
  dentist: ["cabinet dentaire", "centre dentaire", "orthodontiste"],
  "salle de sport": ["fitness club", "gym musculation", "club de remise en forme", "salle de musculation"],
  gym: ["salle de sport", "fitness club", "musculation"],
  spa: ["institut de beauté", "massage & soins", "hammam spa", "spa détente"],
  beauté: ["institut de beauté", "salon esthétique", "soins visage"],
  électricien: ["électricité", "dépannage électrique", "installation électrique"],
  electricien: ["électricité", "dépannage électrique régulier", "installation électrique"],
  boulangerie: ["boulangerie artisanale", "pâtisserie", "boulangerie pâtisserie"],
  pâtisserie: ["pâtisserie artisanale", "boulangerie pâtisserie", "pâtisserie maison"],
  garage: ["garagiste", "réparation automobile", "mécanicien auto", "contrôle technique"],
  avocat: ["cabinet d'avocat", "avocats associés", "cabinet juridique"],
  comptable: ["cabinet comptable", "expert-comptable", "comptabilité"],
  pressing: ["pressing eco", "nettoyage textile", "pressing express"],
  photographe: ["photographe mariage", "studio photo", "photographe événementiel"],
  traiteur: ["traiteur événementiel", "buffet traiteur", "traiteur maison"],
  tatoueur: ["salon de tatouage", "tattoo studio", "studio piercing"],
  veterinaire: ["clinique vétérinaire", "soins vétérinaires", "cabinet vétérinaire"],
  vétérinaire: ["clinique vétérinaire", "cabinet vétérinaire", "vétérinaire à domicile"],
  opticien: ["optique", "lunettes", "audioprothésiste"],
  pharmacie: ["pharmacie de garde", "pharmacie parapharmacie", "parapharmacie"],
};

const CITY_QUARTERS: Record<string, string[]> = {
  casablanca: ["Maârif", "Anfa", "Bourgogne", "Sidi Maarouf", "Hay Riad", "Ain Diab", "Gauthier", "Oulfa"],
  marrakech: ["Guéliz", "Hivernage", "Médina", "Mhamid", "Sidi Ghanem", "Targa", "Route de l'Ourika"],
  rabat: ["Agdal", "Hay Riad", "Hassan", "Souissi", "Océan", "Youssoufia"],
  tanger: ["Centre-ville", "Malabata", "Cap Malabata", "Berhoua"],
  agadir: ["Hauts d'Agadir", "Talborjt", "Nouveau Talborjt", "Hay Mohammadi"],
  fes: ["Ville Nouvelle", "Atlas", "Route d'Immouzer", "Saïss"],
  paris: ["Centre", "Bastille", "Belleville", "Batignolles", "Montmartre"],
  lyon: ["Presqu'île", "Part-Dieu", "Croix-Rousse", "Villeurbanne"],
  marseille: ["Vieux-Port", "Canebière", "La Joliette", "Prado"],
  toulouse: ["Capitole", "Compans", "Carmes", "Saint-Cyprien"],
  bruxelles: ["Centre", "Ixelles", "Schaerbeek", "Saint-Gilles"],
  deauville: ["Plage", "Marina"],
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Requêtes heuristiques — synonymes métier × quartiers de la ville. */
function heuristicQueries(niche: string, city: string, wanted: number, isMA: boolean): string[] {
  const nKey = norm(niche).trim();
  const syns = NICHE_SYNONYMS[nKey] ?? NICHE_SYNONYMS[nKey.replace(/é/g, "e")] ?? [niche];
  const allSyns = Array.from(new Set([niche, ...syns]));
  const quarters = CITY_QUARTERS[norm(city)] ?? [];
  const out: string[] = [];
  // Syllabe 1 : synonymes à l'échelle de la ville
  for (const s of allSyns.slice(0, 3)) out.push(`${s} ${city}`);
  // Syllabe 2 : niche principale × quartiers (couverture géographique)
  for (const q of quarters.slice(0, 3)) out.push(`${allSyns[0] ?? niche} ${q} ${city}`);
  // Repli sans quartier répertorié : ciblage grande surface
  if (out.length < wanted) {
    out.push(`${allSyns[0] ?? niche} centre ${city}`);
    if (isMA) out.push(`${allSyns[0] ?? niche} pas cher ${city}`);
    else out.push(`${allSyns[0] ?? niche} avis ${city}`);
  }
  return Array.from(new Set(out)).slice(0, wanted);
}

/** 🧠 L'IA affine et complète le plan de requêtes pour cette mission. */
async function planQueries(niche: string, city: string, wanted: number, isMA: boolean, localeLabel = "français"): Promise<{ queries: string[]; reasoning: string }> {
  const heuristics = heuristicQueries(niche, city, wanted, isMA);
  const { agentThinkJson } = await import("./agent-brain");
  const out = await agentThinkJson<{ queries: string[]; reasoning: string }>({
    agent: "prospector",
    task: "plan_requetes",
    instruction:
      `Tu dois préparer un essaim de ${wanted} requêtes Google Places COMPLÉMENTAIRES (donc différentes) pour trouver le maximum de petits ` +
      `commerces de cette niche dans cette ville, en privilégiant ceux qui n'ont probablement PAS de site web. ` +
      `Varie : synonymes métier en langue locale (${localeLabel}), quartiers/axes de la ville, expressions que tapent les habitants. ` +
      `Aucune requête ne doit être trop proche d'une autre. ` +
      `Réponds en JSON : {"queries": string[] (${wanted} maximum, 2 minimum), "reasoning": "une phrase"}`,
    input: `Niche: ${niche}\nVille: ${city}\nRéférences heuristiques à raffiner (tu peux en garder les meilleures et en ajouter de nouvelles) :\n${heuristics.join("\n")}`,
    maxTokens: 400,
    temperature: 0.55,
  });
  if (out?.queries?.length) {
    const cleaned = out.queries
      .map((q) => q.trim())
      .filter((q) => q.length > 4 && q.length < 90 && norm(q).includes(norm(city)))
      .slice(0, wanted);
    if (cleaned.length >= 2) {
      const merged = Array.from(new Set([...cleaned, ...heuristics])).slice(0, Math.max(wanted, cleaned.length));
      return { queries: merged, reasoning: out.reasoning ?? "" };
    }
  }
  return { queries: heuristics, reasoning: "" };
}

/* ───────────── Comptes & requêtes réutilisables (Mapper v5) ───────────── */

/** Clé active suivante (rotation) — null si le parc est épuisé. */
export async function nextSerperKey(): Promise<SerperKey | null> {
  return getActiveRealKey();
}

/** Compte 1 crédit sur la clé et marque l'épuisement le cas échéant. */
export async function countSerperCredit(keyId: number): Promise<void> {
  const rows = await db.select().from(serperKeys).where(eq(serperKeys.id, keyId)).limit(1);
  const key = rows[0];
  if (!key) return;
  const used = key.creditsUsed + 1;
  await db.update(serperKeys).set({ creditsUsed: used, lastUsedAt: new Date() }).where(eq(serperKeys.id, keyId));
  if (used >= key.creditLimit) {
    await markExhausted(keyId);
    await notifyTelegram(`⚠️ <b>Prospector</b> — ${key.label} a atteint ${key.creditLimit} requêtes. Rotation sur le compte suivant.`);
  }
}

/** POST générique sur un endpoint Serper — null si !ok ou réseau down (jamais throw). */
export async function serperPost(
  path: "images" | "maps",
  body: Record<string, unknown>,
  apiKey: string,
  timeoutMs = 15000,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`https://google.serper.dev/${path}`, {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Fiche Google Maps réelle : description + horaires (au mieux — null si absent). */
export async function fetchLeadDetails(opts: {
  apiKey: string;
  q: string;
  gl: string;
  hl: string;
}): Promise<{ description: string; hours: Record<string, string> | null }> {
  const j = await serperPost("maps", { q: opts.q, gl: opts.gl, hl: opts.hl }, opts.apiKey);
  const place = (j?.places as Record<string, unknown>[] | undefined)?.[0];
  const description = typeof place?.description === "string" ? place.description.trim() : "";
  let hours: Record<string, string> | null = null;
  const oh = place?.openingHours;
  if (Array.isArray(oh) && oh.length > 0) {
    const line = (pred: (l: string) => boolean): string =>
      oh.filter((h): h is string => typeof h === "string" && pred(h.toLowerCase()))
        .slice(0, 1)
        .join(" · ");
    const weekday = line((l) => /^(lun|mar|mer|jeu|ven|mon|tue|wed|thu|fri)/.test(l));
    const sat = line((l) => /^(sam|sab|sat)/.test(l));
    const sun = line((l) => /^(dim|dom|sun)/.test(l));
    if (weekday || sat || sun) hours = { weekday, sat, sun };
  }
  return { description, hours };
}

/* ───────────── Gestion des comptes et rotation ───────────── */

async function getActiveRealKey(): Promise<SerperKey | null> {
  const rows = await db
    .select()
    .from(serperKeys)
    .where(and(eq(serperKeys.status, "active"), lt(serperKeys.creditsUsed, serperKeys.creditLimit)))
    .orderBy(asc(serperKeys.createdAt));
  return rows.find((k) => !k.apiKey.startsWith("AUTO-POOL")) ?? null;
}

async function markExhausted(keyId: number) {
  await db.update(serperKeys).set({ status: "exhausted" }).where(eq(serperKeys.id, keyId));
}

async function alertQuotaCritical(reason: string) {
  await logActivity({
    agentKey: "prospector", action: "quota_critique",
    message: "Toutes les clés Serper sont épuisées — rotation impossible sans nouvelle clé.",
    level: "error", meta: { reason },
  });
  await notifyTelegram(
    `🔴 <b>Prospector — QUOTA SERPER ÉPUISÉ</b>\nLes 2500 crédits de chaque compte sont consommés.\n➜ Créez un nouveau compte sur serper.dev puis collez la clé dans l'onglet Agents. La rotation reprendra instantanément.`,
  );
}

export async function provisionReplacementKey(reason: string): Promise<SerperKey> {
  const n = Math.floor(Math.random() * 9000) + 1000;
  const rows = await db
    .insert(serperKeys)
    .values({ label: `Compte auto #${n}`, apiKey: `AUTO-POOL-${n}-${Date.now()}`, creditLimit: 2500, creditsUsed: 0, status: "active", isProvisioned: true })
    .returning();
  const key = rows[0];
  await logActivity({
    agentKey: "prospector", action: "rotation_cle",
    message: `Quota épuisé → compte provisionné automatiquement : ${key.label} (2500 crédits).`,
    level: "warn", meta: { reason },
  });
  await notifyTelegram(`♻️ <b>Prospector — Rotation Serper</b>\nQuota épuisé. Remplacement provisionné : <b>${key.label}</b>.`);
  return key;
}

function mapSerperPlace(p: Record<string, unknown>, niche: string, city: string, country: string): RawPlace {
  const pos = (p.position as Record<string, number>) ?? {};
  const lat = Number(pos.latitude ?? 0) || 0;
  const lng = Number(pos.longitude ?? 0) || 0;
  const website = (p.website as string) || null;
  const addr = String(p.address ?? "");
  return {
    businessName: String(p.title ?? "Inconnu"),
    businessType: niche,
    phone: (p.phoneNumber as string) || null,
    email: null,
    address: addr,
    city: city.charAt(0).toUpperCase() + city.slice(1),
    zip: (p as Record<string, unknown>).zip ? String((p as Record<string, unknown>).zip) : "",
    country,
    rating: Number(p.rating ?? 0),
    reviewCount: Number(p.ratingCount ?? 0),
    hasWebsite: Boolean(website) && !String(website).includes("google.com/goto"),
    websiteUrl: website && !String(website).includes("google.com/goto") ? website : null,
    mapsLink: lat && lng
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${String(p.title ?? "")} ${addr} ${city}`)}`,
    lat,
    lng,
    hours: {},
    source: "serper",
    searchQuery: `${niche} ${city}`,
  };
}

/* ───────────── Appel Serper unitaire (1 crédit) ───────────── */

type CallOutcome =
  | { ok: true; places: Record<string, unknown>[] }
  | { ok: false; kind: "quota" | "network"; detail: string };

async function serperPlacesCall(query: string, gl: string, hl: string, key: SerperKey): Promise<CallOutcome> {
  try {
    const res = await fetch("https://google.serper.dev/places", {
      method: "POST",
      headers: { "X-API-KEY": key.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl, hl, num: 20 }),
      signal: AbortSignal.timeout(25000),
    });
    if (res.status === 401 || res.status === 402 || res.status === 403 || res.status === 429) {
      return { ok: false, kind: "quota", detail: `HTTP ${res.status}` };
    }
    if (!res.ok) return { ok: false, kind: "network", detail: `HTTP ${res.status}` };
    const json = (await res.json()) as { places?: Record<string, unknown>[] };
    return { ok: true, places: json.places ?? [] };
  } catch (err) {
    return { ok: false, kind: "network", detail: err instanceof Error ? err.message : "réseau" };
  }
}

/* ───────────── Mission principale : précise OU essaim ───────────── */

export async function scoutSearch(
  niche: string,
  city: string,
  maxResults = 12,
  strategy: ScoutStrategy = "swarm",
  countryOverride?: string,
): Promise<ScoutResult> {
  const sim = await allowSimulation();
  const geo = resolveMissionGeo(city, countryOverride);
  const isMA = geo.country === "Maroc";
  const country = geo.country;
  const gl = geo.gl;

  // ── Mode test (simulation) ──
  if (sim) {
    let key = await getActiveRealKey().catch(() => null);
    if (!key) {
      const auto = await db.select().from(serperKeys).where(and(eq(serperKeys.status, "active"), lt(serperKeys.creditsUsed, serperKeys.creditLimit))).limit(1);
      key = auto[0] ?? null;
    }
    const places = simulatePlaces(niche, city, Math.max(maxResults, strategy === "swarm" ? 18 : maxResults));
    return {
      places, mode: "simulation", keyUsed: key ? { id: key.id, label: key.label, creditsUsed: key.creditsUsed, creditLimit: key.creditLimit } : null,
      rotated: false,
      queries: strategy === "swarm" ? heuristicQueries(niche, city, 4, isMA).map((q) => ({ query: q, found: places.length, kept: 0, simulated: true })) : undefined,
    };
  }

  // ── Production : une clé réelle est indispensable ──
  let key = await getActiveRealKey();
  if (!key) return { places: [], mode: "live", keyUsed: null, rotated: false, error: NO_KEY_ERROR };

  // 🧠 Plan de requêtes (IA) — 1 en mode précise, 3 à 5 en essaim
  const wanted = strategy === "swarm" ? Math.min(5, Math.max(3, Math.ceil(maxResults / 8))) : 1;
  const plan = strategy === "swarm"
    ? await planQueries(niche, city, wanted, isMA, geo.hl === "en" ? "en anglais américain" : isMA ? "français marocain" : "français")
    : { queries: [`${niche} ${city}`], reasoning: "" };

  if (plan.reasoning) {
    await logActivity({
      agentKey: "prospector", action: "plan_ia",
      message: `Essaim planifié par l'IA (${plan.queries.length} requêtes) — ${plan.reasoning}`,
      level: "info",
      meta: { queries: plan.queries },
    });
  }

  const seenKey = new Set<string>();
  const merged: RawPlace[] = [];
  const stats: QueryStat[] = [];
  let creditsSpent = 0;
  let rotated = false;

  for (const query of plan.queries) {
    const call = await serperPlacesCall(query, gl, geo.hl, key);

    if (!call.ok) {
      if (call.kind === "quota") {
        await markExhausted(key.id);
        await logActivity({
          agentKey: "prospector", action: "quota_epuise",
          message: `Clé ${key.label} épuisée pendant « ${query} » (${call.detail}) — rotation automatique.`,
          level: "warn",
        });
        const next = await getActiveRealKey();
        if (!next) {
          await alertQuotaCritical("parc_epuise_en_mission");
          // Sauvegarde partielle : on livre ce qui a été trouvé
          const partial = merged.slice(0, maxResults);
          return {
            places: partial, mode: "live", keyUsed: { id: key.id, label: key.label, creditsUsed: key.creditLimit, creditLimit: key.creditLimit },
            rotated, error: QUOTA_ERROR, queries: stats, creditsSpent, reasoning: plan.reasoning,
          };
        }
        key = next;
        rotated = true;
        continue; // réessaie la même requête avec la nouvelle clé
      }
      // Erreur réseau : on saute cette requête, la mission continue
      stats.push({ query, found: 0, kept: 0 });
      continue;
    }

    creditsSpent += 1;
    const used = key.creditsUsed + 1;
    await db.update(serperKeys).set({ creditsUsed: used, lastUsedAt: new Date() }).where(eq(serperKeys.id, key.id));
    if (used >= key.creditLimit) {
      await markExhausted(key.id);
      await notifyTelegram(`⚠️ <b>Prospector</b> — ${key.label} a atteint 2500 requêtes. Rotation sur le compte suivant.`);
    }

    let kept = 0;
    for (const raw of call.places) {
      const mapped = mapSerperPlace(raw, niche, city, country);
      const dedupeKey = norm(`${mapped.businessName}~${mapped.address}`).replace(/\s+/g, "");
      if (seenKey.has(dedupeKey)) continue;
      seenKey.add(dedupeKey);
      merged.push(mapped);
      kept++;
      if (merged.length >= maxResults) break;
    }
    stats.push({ query, found: call.places.length, kept });
    if (merged.length >= maxResults) break;
  }

  // 🧠 Apprentissage du rendement : quelles requêtes rapportent, lesquelles flanchent
  const empty = stats.filter((s) => s.found === 0).map((s) => s.query);
  const rich = stats.filter((s) => s.kept >= 6).map((s) => s.query);
  const { recordLearning } = await import("./agent-brain");
  for (const q of empty) {
    await recordLearning("prospector", `La requête « ${q} » n'a rien rapporté — éviter cette formulation sur ${city}.`, "observation", 55);
  }
  for (const q of rich) {
    await recordLearning("prospector", `La requête « ${q} » rapporte beaucoup (${stats.find((s) => s.query === q)?.kept} fiches uniques) — formulation à reproduire pour ${city}.`, "strategy", 75);
  }

  return {
    places: merged.slice(0, maxResults),
    mode: "live",
    keyUsed: key ? { id: key.id, label: key.label, creditsUsed: key.creditsUsed + 1, creditLimit: key.creditLimit } : null,
    rotated,
    queries: stats,
    creditsSpent,
    reasoning: plan.reasoning,
  };
}
