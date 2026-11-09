import { classifyClick, injectPixel, linkifyEscaped, newEmailToken, trackifyText, wrapLinks } from "./_lib/track.ts";

const base = "https://gosite.digital";
const tok = "a".repeat(32);

let fails = 0;
const eq = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log(`✗ ${label}\n   obtenu : ${JSON.stringify(got)}\n   attendu : ${JSON.stringify(want)}`); }
  else console.log(`✓ ${label}`);
};

// token
{
  const t = newEmailToken();
  eq("token = 32 hex", /^[a-f0-9]{32}$/.test(t), true);
  eq("tokens distincts", newEmailToken() !== t, true);
}

// classification
eq("whop → payment", classifyClick("https://whop.com/checkout/plan_X/"), "payment");
eq("sous-domaine whop → payment", classifyClick("https://whop.com/checkout/ch_ABC/?u=1"), "payment");
eq("site agence → site", classifyClick("https://youssef-plumbing-drain.gosite.digital"), "site");
eq("URL invalide → external", classifyClick("not url"), "external");

// wrapLinks : ancre simple
{
  const html = `<a href="https://whop.com/checkout/plan_1/">Payer</a>`;
  const out = wrapLinks(html, base, tok);
  eq("ancre enveloppée", out.includes(`href="${base}/api/track/click?t=${tok}&u=${encodeURIComponent("https://whop.com/checkout/plan_1/")}"`), true);
  eq("libellé ancre intact", out.includes(">Payer</a>"), true);
}
// wrapLinks : entité &amp; décodée avant encodage
{
  const html = `<a href="https://whop.com/checkout/plan_1/?a=1&amp;b=2">Payer</a>`;
  const out = wrapLinks(html, base, tok);
  eq("entité décodée", out.includes(encodeURIComponent("https://whop.com/checkout/plan_1/?a=1&b=2")), true);
}
// wrapLinks : pas de double enveloppement ni de mailto
{
  const inner = `${base}/api/track/click?t=${tok}&u=x`;
  const html = `<a href="${inner}">déjà tracké</a><a href="mailto:hi@x.com">STOP</a>`;
  const out = wrapLinks(html, base, tok);
  eq("redirection non re-décorée", out.split(`href="${inner}"`).length - 1, 1);
  eq("mailto ignoré", out.includes('href="mailto:hi@x.com"'), true);
}
// wrapLinks : URL relative intacte
{
  const out = wrapLinks(`<a href="/local">rel</a>`, base, tok);
  eq("URL relative inchangée", out, `<a href="/local">rel</a>`);
}

// trackifyText
{
  const txt = "Lien : https://example.com/a, merci.";
  const out = trackifyText(txt, base, tok);
  eq("URL texte enveloppée", out.startsWith(`Lien : ${base}/api/track/click?t=${tok}`), true);
  eq("cible encodée présente", out.includes(encodeURIComponent("https://example.com/a")), true);
}
{
  const out = trackifyText(`déjà ${base}/api/track/click?t=x`, base, tok);
  eq("URL trackée non re-transformée", out, `déjà ${base}/api/track/click?t=x`);
}

// linkifyEscaped : texte DÉJÀ échappé → ancre
{
  const raw = "Voici votre lien : https://whop.com/checkout/plan_1/?a=1&b=2";
  const escaped = raw.replace(/&/g, "&amp;");
  const out = linkifyEscaped(escaped, base, tok);
  const target = encodeURIComponent("https://whop.com/checkout/plan_1/?a=1&b=2");
  eq("ancre insérée", out.includes(`href="${base}/api/track/click?t=${tok}&u=${target}"`), true);
  eq("texte affiché conservé (échappé)", out.includes(`>https://whop.com/checkout/plan_1/?a=1&amp;b=2</a>`), true);
}

// injectPixel
{
  const doc = `<html><body><p>hi</p></body></html>`;
  const out = injectPixel(doc, base, tok);
  eq("pixel avant </body>", out.includes(`<img src="${base}/api/track/open?t=${tok}"`), true);
  eq("un seul pixel", (out.match(/api\/track\/open/g) ?? []).length, 1);
  const out2 = injectPixel(":)", base, tok);
  eq("pixel ajouté en fin sans body", out2.endsWith(`<img src="${base}/api/track/open?t=${tok}" alt="" width="1" height="1" style="opacity:0;border:0" />`), true);
}

console.log(fails === 0 ? "\nsuite track OK" : `\nsuite track : ${fails} échec(s)`);
if (fails > 0) process.exit(1);
