// niches.ts — variantes EN : chaque niche expose servicesEn/faqEn exploitables
// pour les sites anglophones (repli quand la description du lead est pauvre).
import assert from "node:assert";
import { DEFAULT_NICHE, NICHES } from "./_lib/niches.ts";

let fails = 0;
const ok = (label: string, cond: boolean, extra = "") => {
  if (!cond) fails++;
  console.log(`${cond ? "✔" : "✖"} ${label}${!cond ? ` ${extra}` : ""}`);
};

for (const n of [...NICHES, DEFAULT_NICHE]) {
  ok(`servicesEn >= 5 — ${n.label}`, (n.servicesEn ?? []).length >= 5, `${(n.servicesEn ?? []).length}`);
  ok(`faqEn >= 5 — ${n.label}`, (n.faqEn ?? []).length >= 5, `${(n.faqEn ?? []).length}`);
  const complete = (n.servicesEn ?? []).every((s) => s.title && s.desc && s.icon);
  ok(`servicesEn complets — ${n.label}`, complete);
  const faqOk = (n.faqEn ?? []).every((f) => f.q && f.a);
  ok(`faqEn complètes — ${n.label}`, faqOk);
}

console.log(fails === 0 ? "SUITE OK" : `SUITE KO (${fails})`);
if (fails) process.exit(1);
