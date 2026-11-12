// bundle-images.ts — télécharge les images du pool au build et les embarque
// en base64 dans le bundle (v6 : ZÉRO hotlink externe dans les sites livrés).
// Échec d'un slot → null : le caller passe à la réserve suivante du pool
// (jamais d'URL distante substituée dans le HTML).

export type ImageSlot = { slot: "hero" | "about" | "gallery"; url: string };

export type LocalImages = {
  files: Record<string, string>; // nom de fichier → base64 (sans préfixe data:)
  hero: string | null; // "images/hero.jpg" ou null
  about: string | null; // "images/about.jpg" ou null
  gallery: string[]; // chemins réussis, dans l'ordre, "images/work-N.jpg"
};

const MIN_BYTES = 10 * 1024; // < 10 Ko = pas une vraie photo
const TIMEOUT_MS = 12_000;
const ATTEMPTS = 2;
const PARALLEL = 3;

async function fetchOne(url: string, fetchImpl: typeof fetch): Promise<Buffer | null> {
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const res = await fetchImpl(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      } as RequestInit);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MIN_BYTES) return buf;
      continue;
    } catch {
      // retry
    }
  }
  return null;
}

export async function downloadImages(
  slots: ImageSlot[],
  fetchImpl?: typeof fetch
): Promise<LocalImages> {
  const impl = fetchImpl ?? fetch;
  const galleryUrls = slots.filter((s) => s.slot === "gallery").map((s) => s.url);
  const heroUrl = slots.find((s) => s.slot === "hero")?.url ?? null;
  const aboutUrl = slots.find((s) => s.slot === "about")?.url ?? null;

  const files: Record<string, string> = {};
  let hero: string | null = null;
  let about: string | null = null;
  const gallery: string[] = [];

  // Téléchargements en paquets de 3 (pool = CDN Unsplash : séquentiel serait lent)
  const jobs: { url: string; kind: "hero" | "about" | "gallery"; idx: number }[] = [];
  if (heroUrl) jobs.push({ url: heroUrl, kind: "hero", idx: 0 });
  if (aboutUrl) jobs.push({ url: aboutUrl, kind: "about", idx: 0 });
  galleryUrls.forEach((u, i) => jobs.push({ url: u, kind: "gallery", idx: i }));

  for (let i = 0; i < jobs.length; i += PARALLEL) {
    const batch = jobs.slice(i, i + PARALLEL);
    const results = await Promise.all(batch.map((j) => fetchOne(j.url, impl)));
    batch.forEach((j, k) => {
      const buf = results[k];
      if (!buf) return;
      let path: string;
      if (j.kind === "hero") path = "images/hero.jpg";
      else if (j.kind === "about") path = "images/about.jpg";
      else path = `images/work-${gallery.length + 1}.jpg`;
      files[path] = buf.toString("base64");
      if (j.kind === "hero") hero = path;
      else if (j.kind === "about") about = path;
      else gallery.push(path);
    });
  }

  return { files, hero, about, gallery };
}
