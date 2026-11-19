// Formatage téléphone par pays (spec 2.8) : affichage lisible et stable ;
// les liens tel: continuent d'utiliser PHONE_LINK (chiffres seuls).

import type { ClientSheet } from "../types";

type CountryKind = "us" | "fr" | "ma" | "generic";

function kindOf(country: string | undefined): CountryKind {
  const c = (country ?? "").toLowerCase();
  if (/united states|usa|canada|etats-unis|états-unis/.test(c)) return "us";
  if (/france/.test(c)) return "fr";
  if (/maroc|morocco/.test(c)) return "ma";
  return "generic";
}

function groups(digits: string, size: number): string {
  const out: string[] = [];
  for (let i = 0; i < digits.length; i += size) out.push(digits.slice(i, i + size));
  return out.join(" ");
}

export function formatPhone(value: string | undefined, country?: string): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return raw;
  const international = raw.startsWith("+") || raw.startsWith("00");

  // Détection par préfixe international (prioritaire sur le pays de la fiche).
  if (digits.startsWith("1") && digits.length === 11) {
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.startsWith("33") && digits.length === 11) {
    const d = digits.slice(2);
    return `+33 ${d[0]} ${groups(d.slice(1), 2)}`;
  }
  if (digits.startsWith("212") && digits.length === 12) {
    const d = digits.slice(3);
    return `+212 ${d[0]} ${groups(d.slice(1), 2)}`;
  }

  const kind = kindOf(country);
  if (kind === "us" && digits.length === 10) {
    return international
      ? `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
      : `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if ((kind === "fr" || kind === "ma") && digits.length === 10 && digits.startsWith("0")) {
    return groups(digits, 2);
  }
  if (international) return `+${digits}`.replace(/\+(\d{1,3})(\d+)/, (_m, cc, rest) => `+${cc} ${groups(rest, 3)}`);
  return raw;
}

/** Raccourci pour les composants : PHONE de la fiche + pays. */
export function formatPhoneFromSheet(sheet: ClientSheet): string {
  return formatPhone(sheet.PHONE, sheet.COUNTRY);
}
