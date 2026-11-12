import { downloadImages } from "./_lib/bundle-images.ts";

let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`ok   ${name}`);
  else {
    console.log(`FAIL ${name}`);
    fail++;
  }
}
const JPEG_15K = Buffer.alloc(15360, 7).buffer as ArrayBuffer;
const JPEG_5K = Buffer.alloc(5000, 3).buffer as ArrayBuffer;

const okRes = (bytes: ArrayBuffer) => new Response(bytes, { status: 200, headers: { "content-type": "image/jpeg" } });

// 1. Succès : hero + about + 6 gallery téléchargés
{
  const calls: string[] = [];
  const fetchImpl = async (url: string | URL) => {
    calls.push(String(url));
    return okRes(JPEG_15K);
  };
  const r = await downloadImages(
    [
      { slot: "hero", url: "https://img.example/hero.jpg" },
      { slot: "about", url: "https://img.example/about.jpg" },
      { slot: "gallery", url: "https://img.example/g1.jpg" },
      { slot: "gallery", url: "https://img.example/g2.jpg" },
      { slot: "gallery", url: "https://img.example/g3.jpg" },
      { slot: "gallery", url: "https://img.example/g4.jpg" },
      { slot: "gallery", url: "https://img.example/g5.jpg" },
      { slot: "gallery", url: "https://img.example/g6.jpg" },
    ],
    fetchImpl as typeof fetch
  );
  check("succes: 8 fichiers", Object.keys(r.files).length === 8);
  check("succes: hero chemin", r.hero === "images/hero.jpg");
  check("succes: about chemin", r.about === "images/about.jpg");
  check("succes: gallery 6", r.gallery.length === 6 && r.gallery[0] === "images/work-1.jpg" && r.gallery[5] === "images/work-6.jpg");
  check("succes: base64 sans prefix", (r.files["images/hero.jpg"] ?? "").length > 100 && !(r.files["images/hero.jpg"] ?? "").startsWith("data:"));
  check("succes: base64 décode", Buffer.from(r.files["images/hero.jpg"] ?? "", "base64").length === 15360);
}

// 2. Échec réseau 2x sur hero → hero null, pas de fichier, pas d'URL externe
{
  const fetchImpl = async () => {
    throw new Error("boom");
  };
  const r = await downloadImages(
    [
      { slot: "hero", url: "https://img.example/hero.jpg" },
      { slot: "gallery", url: "https://img.example/g1.jpg" },
    ],
    fetchImpl as typeof fetch
  );
  check("echec: hero null", r.hero === null);
  check("echec: pas de hero.jpg", !r.files["images/hero.jpg"]);
  check("echec: gallery null", r.gallery.length === 0);
  check("echec: aucune clé contenant http", !Object.keys(r.files).some((k) => k.includes("http")));
}

// 3. Trop petit (< 10 Ko) → rejeté
{
  const fetchImpl = async () => okRes(JPEG_5K);
  const r = await downloadImages([{ slot: "hero", url: "https://img.example/small.jpg" }], fetchImpl as typeof fetch);
  check("petit: hero null", r.hero === null);
  check("petit: pas de fichier", !r.files["images/hero.jpg"]);
}

// 4. Réserves : 6 gallery dont 2 échouent + 2 reserves → gallery complète
{
  let n = 0;
  const fetchImpl = async (url: string | URL) => {
    n++;
    const u = String(url);
    if (u.includes("g2") || u.includes("g5")) throw new Error("down");
    return okRes(JPEG_15K);
  };
  const r = await downloadImages(
    [
      { slot: "gallery", url: "https://img.example/g1.jpg" },
      { slot: "gallery", url: "https://img.example/g2.jpg" },
      { slot: "gallery", url: "https://img.example/g3.jpg" },
      { slot: "gallery", url: "https://img.example/g4.jpg" },
      { slot: "gallery", url: "https://img.example/g5.jpg" },
      { slot: "gallery", url: "https://img.example/g6.jpg" },
      { slot: "gallery", url: "https://img.example/g7.jpg" },
      { slot: "gallery", url: "https://img.example/g8.jpg" },
    ],
    fetchImpl as typeof fetch
  );
  check("reserve: gallery complète 6", r.gallery.length === 6);
  check("reserve: work-1..6 sans trou", r.gallery.join() === ["images/work-1.jpg", "images/work-2.jpg", "images/work-3.jpg", "images/work-4.jpg", "images/work-5.jpg", "images/work-6.jpg"].join());
  check("reserve: 6 fichiers work", Object.keys(r.files).filter((k) => k.startsWith("images/work-")).length === 6);
}

process.exit(fail ? 1 : 0);
