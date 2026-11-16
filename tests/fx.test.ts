import {
  OFFER_BASE_CURRENCY,
  convertUsd,
  displayOffer,
  formatMoney,
  resolveDisplayCurrency,
  roundMarketing,
} from "./_lib/fx.ts";

let fail = 0;
const check = (n: string, c: boolean) => {
  if (!c) {
    fail++;
    console.log("FAIL", n);
  } else console.log("ok  ", n);
};

// ── Base de prix : TOUJOURS USD (constante, jamais un setting) ──
check("base USD", OFFER_BASE_CURRENCY === "USD");

// ── resolveDisplayCurrency : fiche prioritaire, géo en repli ──
check("fiche CURRENCY prioritaire", resolveDisplayCurrency({ clientData: { CURRENCY: "MAD" }, country: "France" }) === "MAD");
check("CURRENCY invalide -> géo Maroc", resolveDisplayCurrency({ clientData: { CURRENCY: "XAF" }, country: "Maroc" }) === "MAD");
check("CURRENCY absente -> géo US", resolveDisplayCurrency({ country: "United States" }) === "USD");
check("géo GB", resolveDisplayCurrency({ country: "United Kingdom" }) === "GBP");
check("géo France", resolveDisplayCurrency({ country: "France" }) === "EUR");
check("géo inconnue non-francophone -> USD", resolveDisplayCurrency({ country: "Japan" }) === "USD");

// ── convertUsd ──
check("convertUsd", Math.abs(convertUsd(259, "MAD", { MAD: 9.94 })! - 2574.46) < 0.01);
check("convertUsd USD = identité", convertUsd(259, "USD", {}) === 259);
check("convertUsd taux manquant -> null", convertUsd(259, "CNY", { MAD: 9.94 }) === null);

// ── roundMarketing (toujours vers le bas) ──
check("roundMarketing <10k -> multiple de 10", roundMarketing(2574.46) === 2570);
check("roundMarketing <100k -> multiple de 100", roundMarketing(25746) === 25700);
check("roundMarketing >=100k -> multiple de 1000", roundMarketing(257464) === 257000);

// ── formatMoney ──
check("formatMoney USD", formatMoney(259, "USD") === "$259");
check("formatMoney GBP", formatMoney(210, "GBP") === "£210");
check("formatMoney MAD", /2[\s\u00A0\u202F]570/.test(formatMoney(2570, "MAD")) && formatMoney(2570, "MAD").endsWith("MAD"));

// ── displayOffer ──
{
  const d = displayOffer(259, "MAD", { MAD: 9.94 });
  check("displayOffer converti + approx", /2[\s\u00A0\u202F]570/.test(d.main) && d.main.endsWith("MAD") && d.approx === "≈ $259");
}
{
  const d = displayOffer(259, "MAD", null);
  check("displayOffer sans taux -> USD", d.main === "$259" && d.approx === null);
}
check("displayOffer USD -> pas d'approx", displayOffer(259, "USD", { MAD: 9.94 }).approx === null);

if (fail) {
  console.log(`\n${fail} échec(s) fx`);
  process.exit(1);
}
console.log("\nok  fx — tous verts");
