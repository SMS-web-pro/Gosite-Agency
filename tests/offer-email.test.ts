import { sendSalesEmail } from "./_lib/emailer.ts";

let fail = 0;
const check = (n: string, c: boolean) => {
  if (!c) {
    fail++;
    console.log("FAIL", n);
  } else console.log("ok  ", n);
};

// Prospect factice (gym marocain, fiche avec devise) — copie fallback (le stub
// agent-brain renvoie null : aucun LLM en test). Devise attendue : MAD, taux
// figé 9.94 -> 259 USD = 2 574,46 -> arrondi bas 2 570 ; 45 USD = 447,3 -> 440.
const p = {
  id: 2084,
  businessName: "DEEP FITNESS",
  businessType: "salle de sport",
  city: "Marrakech",
  country: "Maroc",
  rating: "4.8",
  reviewCount: 25,
  email: "deepfitness@example.com",
  deployedUrl: "https://deep-fitness.gosite.digital",
  aiInsight: "Salle très bien notée, aucun site.",
  clientData: {
    CURRENCY: "MAD",
    BUSINESS_NAME: "DEEP FITNESS",
    BUSINESS_TYPE: "salle de sport",
    CITY: "Marrakech",
    COUNTRY: "Maroc",
    PHONE: "+212600000000",
    SELLING_ANGLE: "Coaching personnalisé en petit groupe",
    TAGLINE: "Le fitness sans compromis",
  },
} as unknown as Parameters<typeof sendSalesEmail>[0];

const res = await sendSalesEmail(p, "https://deep-fitness.gosite.digital");
const html = res.bodyHtml ?? "";

check("envoi simulé ok (subject présent)", res.ok === true && res.simulated === true && typeof res.subject === "string" && res.subject.length > 0);
check("prix converti en devise du lead", /2[\s\u00A0\u202F]570\s?MAD/.test(html));
check("base USD discrète (≈ $259)", html.includes("≈ $259"));
check("renouvellement converti (440 MAD)", html.includes("440 MAD"));
check("section inclusions présente", /inclut déjà|already includes/i.test(html));
check("section comment ça marche présente", /Comment ça marche|How it works/i.test(html));
check("3 étapes numérotées", html.includes("48 h") || html.includes("48h") || /48 hours/i.test(html));
check("domaine 1 an inclus", /domaine/i.test(html) && /1 an|1 year/i.test(html));
check("hébergement 1 an inclus", /hébergement|hosting/i.test(html));
check("support 3 mois", /3 mois|3 months/i.test(html));
check("un seul paiement (pas d'abonnement)", /une seule fois|one-time|sans abonnement|no subscription/i.test(html));
check("CTA voir le site", /Voir votre site|View your site/.test(html));
check("pas de chantier", !/chantier/i.test(html));
check("pas de +30%", !/\+\s?30\s?%/i.test(html));
check("pas de « gratuit » (hors template)", !/gratuit/i.test(html));
const visibleText = html.replace(/<[^>]+>/g, " ");
check("pas de pourcentage dans le texte visible", !/%/.test(visibleText));
check("preuve Google 4.8", html.includes("4.8"));
check("footer STOP présent", /STOP/.test(html));
check("lien de prévisualisation présent", html.includes("https://deep-fitness.gosite.digital"));

if (fail) {
  console.log(`\n${fail} échec(s) offer-email`);
  process.exit(1);
}
console.log("\nok  offer-email — tous verts");
