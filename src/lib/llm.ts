// omniroute-compatible LLM client — reads BASE_URL / API_KEY / MODEL
// from settings (DB) with env fallbacks.

import { getSetting } from "./settings";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function llmConfigured(): Promise<boolean> {
  const base = await getSetting("LLM_BASE_URL");
  const key = await getSetting("LLM_API_KEY");
  return Boolean(base && key);
}

export async function chatCompletion(params: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** Délai réseau de l'appel — par défaut 40 s (Vercel Hobby = 60 s max
   *  par fonction : un appel plus long tue la route entière). */
  timeoutMs?: number;
  /** Nombre de tentatives (1 = pas de retry). */
  retries?: number;
}): Promise<string | null> {
  const baseUrl = (await getSetting("LLM_BASE_URL")).replace(/\/+$/, "");
  const apiKey = await getSetting("LLM_API_KEY");
  const model = (await getSetting("LLM_MODEL")) || "gpt-4o-mini";
  if (!baseUrl || !apiKey) return null;

  const attempts = Math.max(1, params.retries ?? 1);
  const budget = params.timeoutMs ?? 35_000;
  let lastError = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    // La 2e tentative est plus courte : le temps total doit rester sous le
    // budget de la route (60 s sur Vercel Hobby).
    const timeout = attempt === 1 ? budget : Math.min(budget, 20_000);
    try {
      // Backend omniroute : le modèle « agent » est désormais un modèle à
      // raisonnement (gpt-oss-120b) — sans `reasoning_effort` ni un budget
      // minimal, tous les tokens partent dans le thinking et le content revient
      // vide (les gros prompts timeout). Effort réduit + plancher de tokens.
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
          max_tokens: Math.max(params.maxTokens ?? 8000, 2000),
          reasoning_effort: "low",
          temperature: params.temperature ?? 0.7,
        }),
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        console.error(`[llm] ${lastError} (${model}) — tentative ${attempt}/${attempts} — ${params.system.slice(0, 60)}…`);
        if (res.status < 500 && res.status !== 429) return null;
        continue;
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = json.choices?.[0]?.message?.content ?? "";
      const trimmed = content.trim();
      if (trimmed.length > 0) return trimmed;
      lastError = "contenu vide";
      console.error(`[llm] contenu vide (${model}) — tentative ${attempt}/${attempts}`);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.error(`[llm] réseau: ${lastError} — tentative ${attempt}/${attempts}`);
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, 1200));
  }
  console.error(`[llm] échec final (${model}): ${lastError}`);
  return null;
}

// Extract a full HTML document from an LLM response (handles fences/prose)
export function extractHtml(raw: string): string | null {
  let s = raw.trim();
  const fence = s.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.toLowerCase().indexOf("<!doctype html");
  const htmlStart = start === -1 ? s.toLowerCase().indexOf("<html") : start;
  const end = s.toLowerCase().lastIndexOf("</html>");
  if (htmlStart === -1 || end === -1 || end <= htmlStart) return null;
  let doc = s.slice(htmlStart, end + "</html>".length);
  if (!doc.toLowerCase().startsWith("<!doctype")) doc = "<!DOCTYPE html>\n" + doc;
  if (doc.includes("[PLACEHOLDER]") || doc.includes("[XXX]")) return null;
  return doc;
}
