import { coerceQualify, coerceEnrich, coerceStringArray } from "./_lib/llm-coerce.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

check("score string -> number", coerceQualify({ score: "85", insight: "ok", verdict: "go" })?.score === 85);
check("score non numérique -> null", coerceQualify({ score: "85 pts", insight: "x", verdict: "go" }) === null);
check("score clampé 105 -> 100", coerceQualify({ score: 105, insight: "x", verdict: "go" })?.score === 100);
check("verdict invalide + score<30 -> no-go", coerceQualify({ score: 15, insight: "x", verdict: "bizarre" })?.verdict === "no-go");
check("verdict invalide + score>=30 -> go", coerceQualify({ score: 72, insight: "x", verdict: "bizarre" })?.verdict === "go");
check("insight non-string -> « — »", coerceQualify({ score: 72, insight: 42, verdict: "go" })?.insight === "—");
check("raw null -> null", coerceQualify(null) === null);
check("raw sans score -> null", coerceQualify({ insight: "x", verdict: "go" }) === null);

const e = coerceEnrich({ tagline: 123, description: "desc", style: "warm", angle: "a" });
check("tagline numérique rejeté", e && !("tagline" in e));
check("description string gardée", e?.description === "desc");
check("style valide gardé", e?.style === "warm");
check("style invalide rejeté", !("style" in (coerceEnrich({ style: "futuriste" }) ?? {})));
check("tagline vide rejeté", !("tagline" in (coerceEnrich({ tagline: "   " }) ?? {})));
check("raw null -> {}", JSON.stringify(coerceEnrich(null)) === "{}");

// Services v5 : coercition des services dérivés de la description réelle
const es = coerceEnrich({ services: [
  { title: " Deep Clean ", desc: "Full-home clean with real checklists." },
  { title: 42, desc: "no" },
  { title: "Move Out", desc: "" },
  { title: "Office Cleaning", desc: "Nightly service for offices of any size." },
  { title: "Pet Hair Removal", desc: "Special tools for homes with pets." },
]});
check("services valables gardés (3)", (es?.services ?? []).length === 3);
check("services titre tronqué/nettoyé", es?.services?.[0]?.title === "Deep Clean");
check("services desc max 160", (es?.services ?? []).every((s) => s.desc.length <= 160));
check("services absents -> undefined", !("services" in (coerceEnrich({}) ?? {})));
check("services non-array -> undefined", !("services" in (coerceEnrich({ services: "x" }) ?? {})));

// servicesFull v6 : pages services (slug/short/paras/bullets)
const ef = coerceEnrich({ servicesFull: [
  { slug: "leak-repair", title: "Leak Repair", short: " Fast leak detection ", paras: ["Para one.", "Para two."], bullets: ["Same-day", "Upfront"] },
  { slug: "drain-cleaning", title: "Drain Cleaning", short: "Clogs cleared.", paras: ["Only one para."], bullets: [] },
]});
check("servicesFull valide gardé", (ef?.servicesFull ?? []).length === 1);
check("servicesFull trims", ef?.servicesFull?.[0]?.short === "Fast leak detection");
check("servicesFull paras<2 rejeté", (ef?.servicesFull ?? []).length === 1);
check("servicesFull non-array -> undefined", !("servicesFull" in (coerceEnrich({ servicesFull: "x" }) ?? {})));

check("mélange -> strings", JSON.stringify(coerceStringArray(["a", 42, "b"])) === '["a","b"]');
check("string -> []", JSON.stringify(coerceStringArray("abc")) === "[]");
check("null -> []", JSON.stringify(coerceStringArray(null)) === "[]");

process.exit(fail ? 1 : 0);
