// Recherche d'images sectorielles via Serper Images — module PUR (aucune DB).
// La rotation des clés et le comptage des crédits restent dans serper.ts ; ici
// on ne fait que filtrer, semer et valider des URLs d'images.

import { hashSeed, rotateSeeded } from "./images";

export type ImageCandidate = { url: string; title: string; width: number; height: number };

/** Filtre les candidats bruts Serper : http(s), pas de SVG, >=600x400,
 *  dédoublonnés par host (un seul site par image, pas de collage visuel). */
export function filterImageCandidates(raw: Record<string, unknown>[]): ImageCandidate[] {
  const seenHosts = new Set<string>();
  const out: ImageCandidate[] = [];
  for (const r of raw) {
    const url = typeof r.imageUrl === "string" ? r.imageUrl.trim() : "";
    if (!/^https?:\/\//.test(url)) continue;
    if (/\.svg(\?|$)/i.test(url)) continue;
    const width = Number(r.imageWidth ?? 0) || 0;
    const height = Number(r.imageHeight ?? 0) || 0;
    if (width < 600 || height < 400) continue;
    let host = "";
    try {
      host = new URL(url).host;
    } catch {
      continue;
    }
    if (seenHosts.has(host)) continue;
    seenHosts.add(host);
    out.push({ url, title: typeof r.title === "string" ? r.title : "", width, height });
  }
  return out;
}

/** Sous-ensemble rotation seedée — deux leads différents reçoivent des images
 *  différentes, un même lead reste stable d'une génération à l'autre. */
export function seededSubset(valid: ImageCandidate[], seed: string, count: number): ImageCandidate[] {
  if (valid.length === 0) return [];
  return rotateSeeded(valid, hashSeed(seed)).slice(0, Math.max(0, count));
}

/** HEAD en parallèle (paquets de 6) : garde status 200 + content-type image/*. */
export async function validateHeads(urls: string[], timeoutMs = 8000): Promise<string[]> {
  const keep: string[] = [];
  for (let i = 0; i < urls.length; i += 6) {
    const batch = urls.slice(i, i + 6);
    const settled = await Promise.all(
      batch.map(async (u) => {
        try {
          const res = await fetch(u, {
            method: "HEAD",
            signal: AbortSignal.timeout(timeoutMs),
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          });
          const ct = res.headers.get("content-type") ?? "";
          return res.status === 200 && ct.startsWith("image/") ? u : null;
        } catch {
          return null;
        }
      }),
    );
    for (const u of settled) if (u) keep.push(u);
  }
  return keep;
}

/** Recherche complète : POST Serper /images → filtre → HEAD → count candidats. */
export async function searchValidImages(opts: {
  apiKey: string;
  query: string;
  gl: string;
  hl: string;
  count: number;
}): Promise<ImageCandidate[]> {
  const res = await fetch("https://google.serper.dev/images", {
    method: "POST",
    headers: { "X-API-KEY": opts.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: opts.query, gl: opts.gl, hl: opts.hl, num: 20 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const j = (await res.json()) as { images?: Record<string, unknown>[] };
  const filtered = filterImageCandidates(j.images ?? []).slice(0, 12);
  const valid = await validateHeads(filtered.map((c) => c.url));
  const byUrl = new Map(filtered.map((c) => [c.url, c]));
  return valid.map((u) => byUrl.get(u)!).filter(Boolean).slice(0, Math.max(0, opts.count));
}
