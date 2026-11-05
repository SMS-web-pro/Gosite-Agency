import { markdownToHtml, markdownToTelegram } from "./_lib/format.ts";

let fail = 0;
const check = (n, c) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const DQ = String.fromCharCode(38, 113, 117, 111, 116, 59); // entite HTML quot;
const LT = String.fromCharCode(38, 108, 116, 59); // entite HTML lt;
const Q = String.fromCharCode(34); // guillemet droit (delimiteur d attribut)
const E = String.fromCharCode(233); // e accent grave

// 1. Breakout d attribut via une URL piegee (href)
const href = markdownToHtml("voir http://x.com/" + DQ + "onmouseover=" + DQ + "alert(1)");
check("href: pas de quote brute", !href.includes("href=" + Q + "http://x.com/" + Q));

// 2. Quotes echappees dans le texte
const q = markdownToHtml("<img src=" + Q + "x" + Q + " onerror=" + Q + "alert(1)" + Q + ">");
check("img: echappement complet", q.includes(LT + "img") && q.includes(DQ));

// 3. Rendu normal intact
check("gras fonctionne", markdownToHtml("**gras**").includes("<b>gras</b>"));
check("lien fonctionne", markdownToHtml("va https://a.b").includes("<a href=" + Q + "https://a.b" + Q));

// 4. Telegram pareil
const tg = markdownToTelegram("texte " + Q + "cit" + E + Q + " et <b>");
check("telegram: quotes echappees", tg.includes(DQ + "cit" + E + DQ) && tg.includes(LT + "b" + String.fromCharCode(38, 103, 116, 59)));

process.exit(fail ? 1 : 0);
