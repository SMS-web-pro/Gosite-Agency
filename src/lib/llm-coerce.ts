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

export function coerceEnrich(
  raw: { tagline?: unknown; description?: unknown; style?: unknown; angle?: unknown; services?: unknown; servicesFull?: unknown } | null | undefined,
): Partial<{ tagline: string; description: string; style: string; angle: string; services: { title: string; desc: string }[]; servicesFull: { slug: string; title: string; short: string; paras: string[]; bullets: string[] }[] }> {
  const out: Partial<{ tagline: string; description: string; style: string; angle: string; services: { title: string; desc: string }[]; servicesFull: { slug: string; title: string; short: string; paras: string[]; bullets: string[] }[] }> = {};
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
  // Services : objets {title, desc} tous deux non vides, titres nettoyés,
  // 6 maximum (le repli niche reste en place si rien de valable).
  if (Array.isArray(raw.services)) {
    const services = raw.services
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const title = str((s as Record<string, unknown>).title, 60);
        const desc = str((s as Record<string, unknown>).desc, 160);
        return title && desc ? { title, desc } : null;
      })
      .filter((s): s is { title: string; desc: string } => s !== null)
      .slice(0, 6);
    if (services.length > 0) out.services = services;
  }
  // ServicesFull : pages /services — slug kebab, short ≤90, paras 2-3 ≤400,
  // bullets 3-4 ≤120. Un objet sans 2 paras valables est rejeté (page vide
  // interdite) ; le repli déterministe assemblé dans site-config prend le relais.
  if (Array.isArray(raw.servicesFull)) {
    const full = raw.servicesFull
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const o = s as Record<string, unknown>;
        const slug = typeof o.slug === "string" && o.slug.trim() ? o.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) : "";
        const title = str(o.title, 60);
        const short = str(o.short, 90);
        const paras = (Array.isArray(o.paras) ? o.paras : []).map((p) => str(p as string, 400)).filter(Boolean).slice(0, 3);
        const bullets = (Array.isArray(o.bullets) ? o.bullets : []).map((b) => str(b as string, 120)).filter(Boolean).slice(0, 4);
        return slug && title && short && paras.length >= 2 ? { slug, title, short, paras, bullets } : null;
      })
      .filter((s): s is { slug: string; title: string; short: string; paras: string[]; bullets: string[] } => s !== null)
      .slice(0, 6);
    if (full.length > 0) out.servicesFull = full;
  }
  return out;
}

export function coerceStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}
