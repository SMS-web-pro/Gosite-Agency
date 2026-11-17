import { fetchWithRetry } from "./_lib/llm-fetch.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

async function main() {

const url = "http://test.local/v1/chat/completions";
const init: RequestInit = { method: "POST" };

// retries: 0 → UNE seule tentative, même sur 5xx transitoire
let calls = 0;
const r500 = await fetchWithRetry(url, init, {
  timeoutMs: 200,
  retries: 0,
  fetchImpl: (async () => { calls++; return new Response("boom", { status: 500 }); }) as typeof fetch,
});
check("retries:0 → 1 seul appel sur 500", calls === 1 && r500.status === 500);

// retries: 0 → un fetch qui pend échoue après ~1 timeoutMs (pas 2)
// NB : AbortSignal.timeout ne pousse pas d'événement sous node --experimental-strip-types
// (.ts) — le mock rejette donc lui-même après 60 ms, comme le ferait le vrai
// fetch à la réception du signal. Ce qui est verrouillé ici : UNE seule
// tentative, l'erreur remonte, zéro retry.
calls = 0;
const hang = ((url: string, i: RequestInit) => {
  calls++;
  return new Promise<Response>((_, rej) => {
    (i.signal as AbortSignal).addEventListener("abort", () => rej(new Error("TimeoutError")));
    setTimeout(() => rej(new Error("TimeoutError")), 60);
  });
}) as unknown as typeof fetch;
const t0 = Date.now();
let threw = false;
try { await fetchWithRetry(url, init, { timeoutMs: 80, retries: 0, fetchImpl: hang }); } catch { threw = true; }
const dt = Date.now() - t0;
check("retries:0 → pend échoue en 1 timeout", threw && calls === 1 && dt >= 50 && dt < 400);

// retries: 1 → 2 tentatives sur 5xx
calls = 0;
await fetchWithRetry(url, init, {
  timeoutMs: 200,
  retries: 1,
  delayMs: 10,
  fetchImpl: (async () => { calls++; return new Response("boom", { status: 503 }); }) as typeof fetch,
});
check("retries:1 → 2 appels sur 503", calls === 2);

// 4xx non transitoire → pas de retry même avec retries: 1
calls = 0;
const r400 = await fetchWithRetry(url, init, {
  timeoutMs: 200,
  retries: 1,
  fetchImpl: (async () => { calls++; return new Response("nope", { status: 400 }); }) as typeof fetch,
});
check("400 → pas de retry", calls === 1 && r400.status === 400);

// 200 → réponse retournée
const rOK = await fetchWithRetry(url, init, {
  timeoutMs: 150,
  fetchImpl: (async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch,
});
check("200 → réponse retournée", rOK.status === 200);
}

main().then(() => {
  console.log(fail ? `\n${fail} échec(s)` : "\ntout est bon");
  process.exit(fail ? 1 : 0);
});
