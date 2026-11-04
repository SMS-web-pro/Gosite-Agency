// Appel HTTP résilient pour les serveurs LLM : timeout borné par tentative
// + 1 nouvelle tentative sur erreur réseau ou erreur transitoire (5xx / 429).

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type LlmFetchOptions = {
  /** Timeout par tentative (ms). */
  timeoutMs: number;
  /** Nombre de nouvelles tentatives après un échec (défaut 1). */
  retries?: number;
  /** Pause entre deux tentatives (ms). */
  delayMs?: number;
  /** Implémentation fetch injectable (tests). */
  fetchImpl?: typeof fetch;
};

export async function fetchWithRetry(url: string, init: RequestInit, opts: LlmFetchOptions): Promise<Response> {
  const { timeoutMs, retries = 1, delayMs = 800, fetchImpl = fetch } = opts;
  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      const transient = res.status >= 500 || res.status === 429;
      if (!transient || attempt > retries) return res;
      await res.text().catch(() => "");
      await sleep(delayMs);
    } catch (err) {
      if (attempt > retries) throw err;
      await sleep(delayMs);
    }
  }
}
