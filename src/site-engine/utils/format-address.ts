// Normalisation d'adresse (spec 2.8) : nettoie espaces/segments vides et
// supprime les doublons — fréquents quand Google Maps met déjà la ville dans
// ADDRESS (« 12 rue X, Marrakech » + CITY « Marrakech »).

import type { ClientSheet } from "../types";

const clean = (value: string | undefined): string => (value ?? "").trim().replace(/\s{2,}/g, " ");

export function formatAddress(sheet: ClientSheet): string {
  const parts = [sheet.ADDRESS, sheet.CITY, sheet.ZIP, sheet.COUNTRY].map(clean).filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (unique.some((u) => u.toLowerCase() === key)) continue;
    // Segment déjà contenu dans un précédent (ville répétée dans la rue).
    if (unique.some((u) => u.toLowerCase().includes(key))) continue;
    unique.push(part);
  }
  return unique.join(", ").replace(/\s{2,}/g, " ").replace(/,\s*,/g, ",").replace(/,\s*$/, "").trim();
}
