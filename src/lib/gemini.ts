// Gemini 3.8 Flash — moteur DÉDIÉ du Coder.
// Rotation multi-clés (le RPD gratuit = par projet Google : 20 req/jour/compte),
// quarantine 429 jusqu'au minuit Pacific, retry anti-«thinkingConfig», et
// fallback géré par le Coder (omniroute → gabarit).

import { getSetting } from "./settings";
import { nextPacificMidnight, parseKeys, pickKeyOrder, type QuarantineMap } from "./gemini-keys";

const DEFAULT_MODEL = "gemini-3.8-flash";
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const CALL_TIMEOUT_MS = 150_000;
const QUARANTINE_SOFT_MS = 60_000;      // 5xx / réseau : îlot court
const QUARANTINE_BAD_MS = 24 * 3_600_000; // clé invalide / erreur métier : îlot long

const quarantine: QuarantineMap = {};
let cursor = 0;

export async function geminiKeys(): Promise<string[]> {
  return parseKeys(await getSetting("GEMINI_API_KEYS"));
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
  if (!opts.bare) gen.thinkingConfig = { thinkingLevel: "low" };
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

export async function geminiCompleteStep(params: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<string | null> {
  const keys = await geminiKeys();
  if (keys.length === 0) return null;
  const model = await geminiModel();

  for (const key of pickKeyOrder(keys, quarantine, Date.now(), (cursor++) % keys.length)) {
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
    const r = await callModel(key, model, "Tu t'appelles TestBot. Réponds très brièvement.", "Réponds exactement : OK", {
      maxOutputTokens: 64,
      temperature: 0,
      timeoutMs: 120_000,
    });
    return {
      label: `Compte ${i + 1} (${model})`,
      ok: "text" in r,
      info: "text" in r
        ? `quota libre — réponse « ${r.text.slice(0, 20)} »`
        : `${r.status === null ? "échec" : `HTTP ${r.status}`} — ${r.body.slice(0, 180)}`,
    };
  }));
}
