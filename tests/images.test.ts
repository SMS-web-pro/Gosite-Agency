// images.ts — rotation seedée déterministe : sites différents → jeux d'images
// différents ; même lead → même jeu ; pas de doublon tant que le pool le permet.
import assert from "node:assert";
import { pickSeededImages, hashSeed, rotateSeeded } from "./_lib/images.ts";
import { DEFAULT_NICHE, NICHES } from "./_lib/niches.ts";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "✓" : "✗"} ${label}${!cond ? ` ${extra}` : ""}`);
};

const pool = ["a", "b", "c", "d", "e", "f", "g", "h"];

// 1. Rotation seedée
assert.deepEqual(rotateSeeded(["a", "b", "c"], 0), ["a", "b", "c"]);
ok("rotation depart 0", true);
assert.deepEqual(rotateSeeded(["a", "b", "c"], 1), ["b", "c", "a"]);
ok("rotation depart 1", true);

// 2. Deux leads différents → concrètement des héros/about différents
let differents = 0;
for (let i = 0; i < 20; i++) {
  const a = pickSeededImages(pool, `Business A|City Antigone${i}`, 6);
  const b = pickSeededImages(pool, `Business B|City Bordel${i}`, 6);
  if (a.hero !== b.hero || a.about !== b.about) differents++;
}
ok("jeux differents entre leads", differents >= 15, `differs=${differents}/20`);

// 3. Determinisme : un mem lead = mem jeu tout le temps
const one = pickSeededImages(pool, "Business A|City X1", 6);
const again = pickSeededImages(pool, "Business A|City X1", 6);
ok("hero stable", one.hero === again.hero);
ok("about stable", one.about === again.about);
assert.deepEqual(one.gallery, again.gallery);
ok("galerie stable", true);

// 4. Pas de doublon dans un jeu (heros = about = galerie distincte, pool 8)
const all = [one.hero, one.about, ...one.gallery];
ok("pas de doublon", new Set(all).size === all.length, all.join(","));

// 5. Pool court (4) : galerie complete quand moins (complete a partir du cycle)
const small = pickSeededImages(["a", "b", "c", "d"], "s", 6);
ok("galerie pool court complete", small.gallery.length === 6);

// 6. Pools de niches : >= la 4 URLs, w=1920 (photos complettes full HD)
for (const n of [...NICHES, DEFAULT_NICHE]) {
  ok(`pool ${n.label}`, (n.imagePool?.length ?? 0) >= 4);
  const badUrls = (n.imagePool || []).filter((u) => !u.includes("images.unsplash.com/photo-") || !u.includes("w=1920"));
  ok(`pool ${n.label} URLs full HD`, badUrls.length === 0, badUrls.join(" | "));
}

// 7. hashSeed ultrastable
ok("hashSeed numérique", Math.trunc(hashSeed("a")) >= 0);

console.log(`${fails === 0 ? "images.test.ts OK" : "FAILURES: " + fails}`);
if (fails) process.exit(1);
