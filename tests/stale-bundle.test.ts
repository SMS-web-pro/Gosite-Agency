import { isStaleSiteBundle } from "./_lib/bundle.ts";
import { buildSiteBundle } from "./_lib/coder.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

// Fixture "conforme" = le VRAI chemin de production : buildSiteBundle avec
// Gemini stubé (null) → fallback déterministe v6 (les 14 sections).
const sheet: Record<string, string> = {
  BUSINESS_NAME: "Boulangerie Atlas", BUSINESS_TYPE: "boulangerie", TAGLINE: "Le pain au levain, rien que ça",
  DESCRIPTION: "Pain au levain", PHONE: "05 20 30 40 50", PHONE_LINK: "+33520304050", EMAIL: "none",
  ADDRESS: "1 rue du Marché", CITY: "Dallas", ZIP: "75201", COUNTRY: "United States",
  LANG: "en", GOOGLE_RATING: "4.7", REVIEW_COUNT: "120",
};
const noFetch = (async () => new Response("no", { status: 403 })) as unknown as typeof fetch;
const build = await buildSiteBundle(sheet, 9999, undefined, noFetch);

check("build production: html porte TOUS les marqueurs v6", !isStaleSiteBundle(null, build.html));
check("build production: bundle conforme", !isStaleSiteBundle(build.bundle, null));

// Bundle pré-v6 (généré avant le spec complet) : SANS les marqueurs v6.
const v5Html = '<html><body><section class="sec"><div class="t-card"><h2>Avis</h2><p>4,8/5</p></div></section></body></html>';
check("v5 sans marqueurs v6 → obsolète", isStaleSiteBundle(null, v5Html) === true);
check("html vide → obsolète", isStaleSiteBundle(null, "") === true);
check("html null → obsolète", isStaleSiteBundle(null, null) === true);
check("bundle v6 (index conforme) → conforme", isStaleSiteBundle({ "/index.html": build.html, "/services/a.html": "<html></html>" }, v5Html) === false);
check("bundle v5 → obsolète", isStaleSiteBundle({ "/index.html": v5Html, "/services/a.html": v5Html }, null) === true);
check("bundle vide + html conforme → conforme", isStaleSiteBundle({}, build.html) === false);
check("bundle + html v5 → obsolète", isStaleSiteBundle({ "/index.html": v5Html }, v5Html) === true);

console.log(fail === 0 ? "stale-bundle OK" : `stale-bundle : ${fail} échec(s)`);
if (fail) process.exit(1);
