// Gemini Flash — moteur DÉDIÉ du Coder.
// Rotation multi-clés (le RPD gratuit = par projet Google : 20 req/jour/compte,
// 500/jour pour les flash-lite), quarantine 429 jusqu'au minuit Pacific,
// retry anti-«thinkingConfig», échelle de repli 503 «forte demande»
// (3.8/3.7 saturables la nuit → dégradation en 3.6 puis 3.5-lite) et
// fallback géré par le Coder (omniroute → gabarit).

import { getSetting } from "./settings";
import { nextPacificMidnight, parseKeys, pickKeyOrder, type QuarantineMap } from "./gemini-keys";

const DEFAULT_MODEL = "gemini-3.6-flash";
const LADDER_FALLBACKS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const CALL_TIMEOUT_MS = 40_000;
const QUARANTINE_SOFT_MS = 60_000;      // 5xx / réseau : îlot court
const QUARANTINE_BAD_MS = 24 * 3_600_000; // clé invalide / erreur métier : îlot long

const quarantine: QuarantineMap = {};
let cursor = 0;

export async function geminiKeys(): Promise<string[]> {
  // 3 emplacements indépendants (Réglages) + l'historique GEMINI_API_KEYS
  // (virgule-joint) pour compat ; parseKeys dédoublonne tout cela.
  const [k1, k2, k3, legacy] = await Promise.all([
    getSetting("GEMINI_API_KEY_1"),
    getSetting("GEMINI_API_KEY_2"),
    getSetting("GEMINI_API_KEY_3"),
    getSetting("GEMINI_API_KEYS"),
  ]);
  return parseKeys([k1, k2, k3, legacy].join(","));
}

export async function geminiKeysConfigured(): Promise<boolean> {
  return (await geminiKeys()).length > 0;
}

type Hit = { text: string; finishReason?: string };
type Miss = { status: null | number; body: string };

async function callModel(
  key: string,
  model: string,
  system: string,
  user: string,
  opts: { maxOutputTokens: number; temperature: number; timeoutMs: number; bare?: boolean },
): Promise<Hit | Miss> {
  const gen: Record<string, unknown> = {
    temperature: opts.temperature,
    maxOutputTokens: opts.maxOutputTokens,
  };
  // Les modèles «lite» n'ont pas de pensée : on n'envoie pas thinkingConfig
  // (il serait recalé en 400 et déclencherait un second appel pour rien).
  if (!opts.bare && !model.includes("lite")) gen.thinkingConfig = { thinkingLevel: "low" };
  const fire = (): Promise<Response> =>
    fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: user }] }],
        systemInstruction: { parts: [{ text: system }] },
        generationConfig: gen,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });

  const fail = (status: null | number, body: string): Miss => ({ status, body: body.slice(0, 300) });
  const hard = (err: unknown): Miss => {
    const m = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error("[gemini] échec:", m);
    const wait = /aborted|timeout/i.test(m);
    return fail(null, wait
      ? `timeout ${Math.round(opts.timeoutMs / 1000)}s — le free tier Google peut garder la requête en file ; réessaie`
      : `réseau: ${err instanceof Error ? err.message : m}`);
  };

  try {
    let res = await fire();
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      // 400 «thinking» inconnu de ce backend → un essai sans thinkingConfig
      if (res.status === 400 && body.toLowerCase().includes("thinking") && gen.thinkingConfig) {
        delete gen.thinkingConfig;
        res = await fire();
        if (!res.ok) return fail(res.status, await res.text().catch(() => ""));
      } else {
        return fail(res.status, body);
      }
    }
    const json = (await res.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    } | null;
    if (!json) return fail(200, "réponse illisible");
    const block = json.promptFeedback?.blockReason;
    if (block) return fail(200, `bloqué: ${block}`);
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) {
      return fail(200, `réponse vide (finishReason=${json.candidates?.[0]?.finishReason ?? "?"})`);
    }
    return { text, finishReason: json.candidates?.[0]?.finishReason };
  } catch (err) {
    return hard(err);
  }
}

export async function geminiModel(): Promise<string> {
  return (await getSetting("GEMINI_MODEL")).trim() || DEFAULT_MODEL;
}

/** L'échelle de repli 503 : modèle choisi en tête, plus les secours connus,
 * dédoublonnés (ex. 3.8 → [3.8, 3.6, 3.5-lite] ; 3.5-lite → [3.5-lite]). */
export function modelLadder(base: string): string[] {
  return [base, ...LADDER_FALLBACKS.filter((m) => m !== base)];
}

export async function geminiCompleteStep(params: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Horloge murale de la LADDER entière : dés qu'elle est franchie on
   *  s'arrête (retour null) au lieu de lancer un énième essai qui ne pourra
   *  pas finir dans le budget du caller (route 300 s, tick, etc.). */
  deadlineMs?: number;
}): Promise<string | null> {
  const keys = await geminiKeys();
  if (keys.length === 0) return null;
  const ladder = modelLadder(await geminiModel());
  const t0 = Date.now();
  const wall = params.deadlineMs ?? Number.POSITIVE_INFINITY;

  for (const key of pickKeyOrder(keys, quarantine, Date.now(), (cursor++) % keys.length)) {
    for (const model of ladder) {
      if (Date.now() - t0 >= wall) {
        console.error(`[gemini] échéance wall-clock atteinte (${wall} ms) — arrêt de l'échelle.`);
        return null;
      }
      const r = await callModel(key, model, params.system, params.user, {
        maxOutputTokens: params.maxTokens ?? 16384,
        temperature: params.temperature ?? 0.6,
        timeoutMs: params.timeoutMs ?? CALL_TIMEOUT_MS,
      });
      if ("text" in r) return r.text;

      const now = Date.now();
      if (r.status === 429) {
        const until = nextPacificMidnight(now);
        quarantine[key] = until;
        console.error(`[gemini] 429 → clé en îlot jusqu'à minuit Pacific (${new Date(until).toISOString()}).`);
        break; // clé épuisée : on passe à la clé suivante
      }
      if (r.status === 503) {
        // Saturé CE modèle, clé saine : pas d'isolement, essai du modèle de
        // secours avec la même clé immédiatement.
        console.error(`[gemini] 503 «forte demande» sur ${model} — repli : ${r.body.slice(0, 120)}`);
        continue;
      }
      if (r.status === null || (r.status >= 500 && r.status < 600) || (r.status === 200)) {
        quarantine[key] = now + QUARANTINE_SOFT_MS;
        console.error(`[gemini] stat ${r.status ?? "réseau"} — îlot 60s : ${r.body.slice(0, 160)}`);
        continue;
      }
      // 401/403/400 tarif, région, clé piègée… : îlot long pour la clé fautive
      console.error(`[gemini] ${r.status} — îlot 24h : ${r.body.slice(0, 160)}`);
      quarantine[key] = now + QUARANTINE_BAD_MS;
      break;
    }
  }
  return null;
}

/** Diagnostic Réglages : 1 micro-appel PARALLÈLE par clé — une clé valide
 * peut rester en file d'attente du free tier, une clé invalide répond vite.
 * NE modifie pas la quarantine. */
export async function testGeminiKeys(): Promise<{ label: string; ok: boolean; info: string }[]> {
  const keys = await geminiKeys();
  const model = await geminiModel();
  return Promise.all(keys.map(async (key, i) => {
    // Deux formats de clés valables pour l'API Gemini : « AIza… » (AI Studio,
    // historique) et « AQ.… » (format 2025-2026, console Google Cloud).
    // « ya29. »/« go… » = jetons OAuth temporaires : rejetés d'office.
    if (!key.startsWith("AIza") && !key.startsWith("AQ.")) {
      return {
        label: `Compte ${i + 1}`,
        ok: false,
        info: `format inattendu (début « ${key.slice(0, 4)}… ») — crée une clé « AIza » sur aistudio.google.com/apikey ou une clé API dans la console Google Cloud`,
      };
    }
    const r = await callModel(key, model, "Tu t'appelles TestBot. Réponds très brièvement.", "Réponds exactement : OK", {
      maxOutputTokens: 512,
      temperature: 0,
      timeoutMs: 20_000,
    });
    if (!("text" in r) && r.status === 503) {
      return {
        label: `Compte ${i + 1} (${model})`,
        ok: false,
        info: "clé validée par Google (authentification OK) mais modèle saturé « forte demande » — réessaie dans quelques minutes ; la génération de sites se repliera toute seule sur un modèle libre",
      };
    }
    return {
      label: `Compte ${i + 1} (${model})`,
      ok: "text" in r,
      info: "text" in r
        ? `quota libre — réponse « ${r.text.slice(0, 20)} »`
        : `${r.status === null ? "échec" : `HTTP ${r.status}`} — ${r.body.slice(0, 180)}`,
    };
  }));
}
