// Phase 9 (spec 2.8) — utilitaires critiques : échappement, adresse, téléphone.

import { esc, escapeHtml } from "./_lib/escape.ts";
import { formatAddress } from "./_lib/format-address.ts";
import { formatPhone, formatPhoneFromSheet } from "./_lib/format-phone.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

// ── Échappement ─────────────────────────────────────────────────────────────
{
  check("esc: & < > \" '", esc(`A&B <C> "D" 'E'`) === "A&amp;B &lt;C&gt; &quot;D&quot; &#39;E&#39;");
  check("esc: alias exact de escapeHtml", esc("<&>") === escapeHtml("<&>"));
  check("esc: pas de double échappement", esc("&amp;") === "&amp;amp;");
  check("esc: chaîne vide", esc("") === "");
}

// ── Adresse ─────────────────────────────────────────────────────────────────
{
  const full = formatAddress({ ADDRESS: "12 rue X", CITY: "Marrakech", ZIP: "40000", COUNTRY: "Maroc" });
  check("adresse: complète", full === "12 rue X, Marrakech, 40000, Maroc");
  const dup = formatAddress({ ADDRESS: "12 rue X, Marrakech", CITY: "Marrakech", ZIP: "40000", COUNTRY: "Maroc" });
  check("adresse: ville dupliquée dans ADDRESS supprimée", dup === "12 rue X, Marrakech, 40000, Maroc");
  const dupExact = formatAddress({ ADDRESS: "1 Main St", CITY: "1 Main St", ZIP: "75201", COUNTRY: "United States" });
  check("adresse: doublon exact supprimé", dupExact === "1 Main St, 75201, United States");
  const spaces = formatAddress({ ADDRESS: "  12   rue   X  ", CITY: " Marrakech ", ZIP: "", COUNTRY: "" });
  check("adresse: espaces normalisés", spaces === "12 rue X, Marrakech");
  check("adresse: vide", formatAddress({}) === "");
  const noCity = formatAddress({ ADDRESS: "1 Main St", ZIP: "75201", COUNTRY: "United States" });
  check("adresse: pas de virgule orpheline", noCity === "1 Main St, 75201, United States");
  const caseDup = formatAddress({ ADDRESS: "12 Rue X, MARRAKECH", CITY: "marrakech", ZIP: "", COUNTRY: "Maroc" });
  check("adresse: doublon insensible à la casse", caseDup === "12 Rue X, MARRAKECH, Maroc");
}

// ── Téléphone ───────────────────────────────────────────────────────────────
{
  check("tel: US international", formatPhone("+1 469-555-3810") === "+1 (469) 555-3810");
  check("tel: US national", formatPhone("(469) 555-3810", "United States") === "(469) 555-3810");
  check("tel: US chiffres seuls + pays", formatPhone("4695553810", "USA") === "(469) 555-3810");
  check("tel: US chiffres seuls sans pays", formatPhone("4695553810", "") === "4695553810");
  check("tel: Maroc international", formatPhone("+212661234567") === "+212 6 61 23 45 67");
  check("tel: Maroc national", formatPhone("0661234567", "Maroc") === "06 61 23 45 67");
  check("tel: France international", formatPhone("+33 6 12 34 56 78") === "+33 6 12 34 56 78");
  check("tel: France national", formatPhone("0612345678", "France") === "06 12 34 56 78");
  check("tel: Canada via pays", formatPhone("5145551234", "Canada") === "(514) 555-1234");
  check("tel: international générique", formatPhone("+447911123456") === "+447 911 123 456");
  check("tel: trop court inchangé", formatPhone("12345") === "12345");
  check("tel: vide", formatPhone("") === "");
  const sheet = { PHONE: "+212 661 23 45 67", COUNTRY: "Maroc" };
  check("tel: depuis la fiche", formatPhoneFromSheet(sheet) === "+212 6 61 23 45 67");
  check("tel: fiche sans phone", formatPhoneFromSheet({}) === "");
}

console.log(fail ? `\n${fail} échec(s)` : "\nOK");
process.exit(fail ? 1 : 0);
