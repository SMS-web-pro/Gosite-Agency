// Sélection d'images déterministe par site — deux leads différents reçoivent
// des images DIFFÉRENTES (rotation seedée par nom+ville), un même lead reste
// stable d'une génération à l'autre. Aucune image n'est inventée : le pool
// vient de niches.ts (Unsplash vérifiés, full HD).

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Rotation du point de départ selon le seed — deux seeds différents partent d'indices différents. */
export function rotateSeeded<T>(arr: T[], seed: number): T[] {
  if (arr.length === 0) return [];
  const start = seed % arr.length;
  return [...arr.slice(start), ...arr.slice(0, start)];
}

/**
 * Récupère le jeu d'images du site : entrée 0 = héros, 1 = about, suivantes =
 * galerie. Distinctes tant que le pool le permet ; si le pool est court, le
 * débordement réutilise le début du cycle (le héros reste toujours la 0).
 */
export function pickSeededImages(
  pool: string[],
  seed: string,
  count: number,
): { hero: string; about: string; gallery: string[] } {
  if (pool.length === 0) throw new Error("image pool empty");
  const rotated = rotateSeeded(pool, hashSeed(seed));
  const hero = rotated[0];
  const about = rotated[1 % rotated.length];
  const raw = rotated.slice(2);
  const gallery = raw.slice(0, count);
  if (gallery.length < count) gallery.push(...rotated.slice(0, count - gallery.length));
  return { hero, about, gallery };
}
