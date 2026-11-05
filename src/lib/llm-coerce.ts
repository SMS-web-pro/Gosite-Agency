// Coercition des sorties LLM : parseLooseJson renvoie le JSON brut sans
// validation de types — un champ mal typé (tagline numérique, score "85 pts")
// ne doit JAMAIS planter un agent ni empoisonner un lead en boucle de retry.

const STYLES = ["luxury", "bold", "warm", "minimal", "urban"] as const;

function toFiniteNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function coerceQualify(raw: { score?: unknown; insight?: unknown; verdict?: unknown } | null | undefined): { score: number; insight: string; verdict: "go" | "no-go" } | null {
  if (!raw || typeof raw !== "object") return null;
  const scoreRaw = toFiniteNumber(raw.score);
  if (scoreRaw === null) return null;
  const score = Math.max(0, Math.min(100, Math.round(scoreRaw)));
  const verdict: "go" | "no-go" = raw.verdict === "no-go" ? "no-go" : raw.verdict === "go" ? "go" : score < 30 ? "no-go" : "go";
  const insight = typeof raw.insight === "string" && raw.insight.trim() ? raw.insight.trim().slice(0, 300) : "—";
  return { score, insight, verdict };
}

export function coerceEnrich(raw: { tagline?: unknown; description?: unknown; style?: unknown; angle?: unknown } | null | undefined): Partial<{ tagline: string; description: string; style: string; angle: string }> {
  const out: Partial<{ tagline: string; description: string; style: string; angle: string }> = {};
  if (!raw || typeof raw !== "object") return out;
  const str = (v: unknown, max: number): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
  const tagline = str(raw.tagline, 90);
  if (tagline) out.tagline = tagline;
  const description = str(raw.description, 400);
  if (description) out.description = description;
  if (typeof raw.style === "string" && (STYLES as readonly string[]).includes(raw.style)) out.style = raw.style;
  const angle = str(raw.angle, 220);
  if (angle) out.angle = angle;
  return out;
}

export function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}
