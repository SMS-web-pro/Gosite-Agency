import { coerceCopy, sanitizeCopyRaw, type SalesCopy } from "./_lib/offer-copy.ts";

let fail = 0;
const check = (n: string, c: boolean) => {
  if (!c) {
    fail++;
    console.log("FAIL", n);
  } else console.log("ok  ", n);
};

const F: SalesCopy = {
  subject: "Un site prêt pour Étoile",
  hook: "hook FB",
  bullets: ["b1", "b2"],
  offerTitle: "Notre offre",
  cta: "Voir votre site",
  closing: "Répondez à cet email.",
};

// ── sanitizeCopyRaw : aucune invention ne survit ──
check("+30% supprimé", !sanitizeCopyRaw({ bullets: ["Acquisition +30 % de trafic", "b2"] }).bullets!.includes("Acquisition +30 % de trafic"));
check("gratuit supprimé du subject", sanitizeCopyRaw({ subject: "Voir mon site gratuit" }).subject === "");
check("subject sain conservé", sanitizeCopyRaw({ subject: "Un site prêt pour Étoile" }).subject === "Un site prêt pour Étoile");
check("hook pollué supprimé", sanitizeCopyRaw({ hook: "Doublez vos ventes avec 50% de visiteurs" }).hook === "");
check("closing sain conservé", sanitizeCopyRaw({ closing: "Répondez à cet email." }).closing === "Répondez à cet email.");
check("null -> objet vide", sanitizeCopyRaw(null) !== null && sanitizeCopyRaw(null)!.subject === "" && sanitizeCopyRaw(null)!.bullets.length === 0);
check("« free » EN supprimé", sanitizeCopyRaw({ subject: "Get a free website for your gym" }).subject === "" && sanitizeCopyRaw({ bullets: ["A free website", "b2"] }).bullets!.join("|") === "b2");

// ── coerceCopy : valeurs déterministes + replis ──
check("offerTitle LLM ignoré", coerceCopy({ offerTitle: "SUPER PROMO", cta: "ACHTEZ" }, F).offerTitle === "Notre offre");
check("cta LLM ignoré", coerceCopy({ offerTitle: "SUPER PROMO", cta: "ACHTEZ" }, F).cta === "Voir votre site");
check("coerceCopy <2 bullets -> fallback", coerceCopy({ bullets: ["Acquisition +30 % de trafic"] }, F).bullets.join("|") === "b1|b2");
check("coerceCopy null -> fallback complet", JSON.stringify(coerceCopy(null, F)) === JSON.stringify(F));
check("coerceCopy sain repris", coerceCopy({ subject: "Votre site est prêt", hook: "Bonjour,", bullets: ["x", "y"], closing: "À vite." }, F).subject === "Votre site est prêt");

if (fail) {
  console.log(`\n${fail} échec(s) offer-copy`);
  process.exit(1);
}
console.log("\nok  offer-copy — tous verts");
