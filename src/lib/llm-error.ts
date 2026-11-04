// Extraction d'un message d'erreur lisible depuis une réponse HTTP d'un serveur LLM.
// Pur et sans dépendance — testé par .superpowers/tmp/test-llm-error.mts.

export function llmErrorDetail(status: number, bodyText: string): string {
  const body = bodyText.trim().slice(0, 2000);
  try {
    const j = JSON.parse(body) as { error?: { message?: string } | string; message?: string };
    const msg = typeof j.error === "string" ? j.error : (j.error?.message ?? j.message);
    if (msg) return `HTTP ${status} — ${String(msg).replace(/\s+/g, " ").slice(0, 160)}`;
  } catch { /* corps non JSON */ }
  if (body) return `HTTP ${status} — ${body.replace(/\s+/g, " ").slice(0, 160)}`;
  return `HTTP ${status}`;
}
