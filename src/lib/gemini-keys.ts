// Rotation des clés Gemini — helpers PURS (aucun import) :
// testables isolément dans tests/_lib via scripts/test.mjs.

export type QuarantineMap = Record<string, number>; // clé -> ms d'épuisement (RM)

/** "a, b\n c,  , d, a" -> ["a","b","c","d"] (trim, sans vides, dédupliqué). */
export function parseKeys(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,\n\r]+/)) {
    const key = part.trim();
    if (key && !seen.has(key)) { seen.add(key); out.push(key); }
  }
  return out;
}

/** Mur d'horloge LA interprété comme epoch (pseudo-epoch de la time zone). */
function wallCandidateMs(utcMs: number, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const m = fmt.format(new Date(utcMs)); // "2026-11-08 10:43:21"
  const p = m.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!p) throw new Error(`wall unparseable: ${m}`);
  return Date.UTC(Number(p[1]), Number(p[2]) - 1, Number(p[3]), Number(p[4]), Number(p[5]), Number(p[6]));
}

/**
 * Instant UTC du prochain (ou présent) minuit Pacific — les quotas RPD gratuits
 * Gemini se réinitialisent exactement à minuit America/Los_Angeles.
 * DST-safe : recherche binaire sur le mur dessiné dans la fenêtre ±… sans
 * transition (2:00 local) dans [-6h ; +5h] autour de minuit.
 */
export function nextPacificMidnight(nowMs: number): number {
  const TZ = "America/Los_Angeles";
  const wallNow = wallCandidateMs(nowMs, TZ);
  const dayBoundary = Math.floor(wallNow / 86_400_000) * 86_400_000;
  const targetWall = wallNow === dayBoundary ? dayBoundary : dayBoundary + 86_400_000;

  // L'instant UTC du minuit wall W vaut W + |décalage| ∈ [W+7h ; W+8h] (PDT/PST).
  // Fenêtre [W+5h ; W+9h] : constantes, jamais la transition 2:00 (minuit+2h).
  let lo = targetWall + 5 * 3_600_000;
  let hi = targetWall + 9 * 3_600_000;
  while (hi - lo > 2) {
    const mid = Math.round((lo + hi) / 2);
    if (wallCandidateMs(mid, TZ) >= targetWall) hi = mid; else lo = mid;
  }
  return hi;
}

/**
 * Ordre d'utilisation des clés : les clés en quarantine (jusqu'à `now` ms)
 * sont écartées, puis rotation à partir de `startIndex` (fair-use entre
 * toutes les clés disponibles).
 */
export function pickKeyOrder(
  keys: string[],
  quarantine: QuarantineMap,
  now: number,
  startIndex = 0,
): string[] {
  const available = keys.filter((k) => (quarantine[k] ?? 0) <= now);
  if (available.length === 0) return [];
  const s = ((startIndex % available.length) + available.length) % available.length;
  return [...available.slice(s), ...available.slice(0, s)];
}
