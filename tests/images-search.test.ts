// images-search.ts — module pur : filtre candidats Serper, sous-ensemble seedé,
// validation HEAD. Pas de réseau dans les tests (sauf validateHeads, testée ici
// sur des URLs locales invalides → écart).
import assert from "node:assert";
import { filterImageCandidates, seededSubset } from "./_lib/images-search.ts";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "✔" : "✖"} ${label}${!cond ? ` ${extra}` : ""}`);
};

// 1. Filtre : taille min, pas de SVG, protocole http(s), dédoublonnage par host
const kept = filterImageCandidates([
  { imageUrl: "https://a.com/x.jpg", imageWidth: 800, imageHeight: 600, title: "A" },
  { imageUrl: "https://a.com/y.jpg", imageWidth: 900, imageHeight: 700, title: "Doublon host" },
  { imageUrl: "https://b.com/z.svg", imageWidth: 1000, imageHeight: 800, title: "SVG" },
  { imageUrl: "https://c.com/t.jpg", imageWidth: 500, imageHeight: 400, title: "Trop petit" },
  { imageUrl: "https://c.com/t2.jpg", imageWidth: 500, imageHeight: 200, title: "Trop plat" },
  { imageUrl: "javascript:alert(1)", imageWidth: 2000, imageHeight: 1000, title: "Mauvais proto" },
  { imageUrl: "", imageWidth: 2000, imageHeight: 1000, title: "Vide" },
]);
ok("filtre garde 1 seul candidat", kept.length === 1, JSON.stringify(kept));
ok("filtre conserve title", kept[0]?.title === "A");

// 2. Sous-ensemble seedé : count exact, pas de doublon d'URL, varié entre seeds
const pool = filterImageCandidates(
  Array.from({ length: 10 }, (_, i) => ({
    imageUrl: `https://h${i}.com/p${i}.jpg`,
    imageWidth: 1200,
    imageHeight: 800,
    title: `T${i}`,
  })),
);
const a = seededSubset(pool, "Positiflo|Paris", 8);
const b = seededSubset(pool, "Autre|Lyon", 8);
ok("subset taille exacte", a.length === 8, String(a.length));
ok("subset pas de doublon d'URL", new Set(a.map((c) => c.url)).size === 8);
const diff = a.filter((c, i) => c.url !== b[i].url).length;
ok("subset diffère entre seeds (>=3/8)", diff >= 3, `diff=${diff}`);
ok("subset stable pour un même seed", JSON.stringify(seededSubset(pool, "Positiflo|Paris", 8)) === JSON.stringify(a));

// 3. Pool plus court que count : retourne tout ce qui existe
const small = seededSubset(pool.slice(0, 3), "Seed|X", 8);
ok("pool court → tout le pool", small.length === 3, String(small.length));

// 4. Entrée vide → sortie vide (jamais throw)
ok("entrée vide", seededSubset([], "S|C", 8).length === 0);

console.log(fails === 0 ? "SUITE OK" : `SUITE KO (${fails})`);
if (fails) process.exit(1);
