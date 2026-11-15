import { isStaleSiteBundle } from "./_lib/bundle.ts";
import { generateSiteHtml } from "./_lib/site-template.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

// Bundle pré-v6 (généré avant le commit section avis animée) : SANS t-star.
const v5Html = '<html><body><section class="sec"><div class="t-card"><h2>Avis</h2><p>4,8/5</p></div></section></body></html>';
const v6Html = generateSiteHtml({
  BUSINESS_NAME: "Boulangerie Atlas", BUSINESS_TYPE: "boulangerie", PHONE: "05 20 30 40 50", PHONE_LINK: "+33520304050",
  CITY: "Dallas", COUNTRY: "United States", LANG: "en", LANG_DIR: "ltr",
  HERO_IMAGE_URL: "", ABOUT_IMAGE_URL: "",
});

check("v5 sans t-star → obsolète", isStaleSiteBundle(null, v5Html) === true);
check("html vide → obsolète", isStaleSiteBundle(null, "") === true);
check("html null → obsolète", isStaleSiteBundle(null, null) === true);
check("v6 déterministe → conforme", isStaleSiteBundle(null, v6Html) === false);
check("bundle v6 (un fichier porte t-star) → conforme", isStaleSiteBundle({ "/index.html": v6Html, "/services/a.html": "<html></html>" }, v5Html) === false);
check("bundle v5 → obsolète", isStaleSiteBundle({ "/index.html": v5Html, "/services/a.html": v5Html }, null) === true);
check("bundle vide + html v6 → conforme", isStaleSiteBundle({}, v6Html) === false);
check("bundle + html v5 → obsolète", isStaleSiteBundle({ "/index.html": v5Html }, v5Html) === true);

console.log(fail === 0 ? "stale-bundle OK" : `stale-bundle : ${fail} échec(s)`);
if (fail) process.exit(1);
