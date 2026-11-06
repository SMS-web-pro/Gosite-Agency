import {
  extractNewText,
  stripHtml,
  isAutoReply,
  isDeliveryStatus,
  isOwnAddress,
  normalizeMessageIds,
  coerceInboundDecision,
  sanitizeReplyUrls,
  shouldIgnoreShortUnmatched,
} from "./_lib/inbound.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

// Extraction du texte nouveau : couper citations et signatures
const fresh = extractNewText("Question sur le site\n\n> Répondez STOP pour ne plus être contacté\n\nLe 1 nov, X a écrit :");
check("extrait: coupe citation + header FR", fresh.includes("Question sur le site") && !fresh.includes("STOP") && !fresh.includes("a écrit"));
const fresh2 = extractNewText("Oui je suis intéressé\n\n-----Original Message-----\nDe: Saler\n");
check("extrait: separateur original message", fresh2.includes("intéressé") && !fresh2.includes("Saler"));
const fresh3 = extractNewText("Prix ?\n\nFrom: x@y.z\nSent: today\n");
check("extrait: From: coupe", fresh3.includes("Prix ?") && !fresh3.includes("x@y.z"));
const fresh4 = extractNewText("Interessé par la démo\n\nOn Mon, 2 Nov 2026, GoSite wrote:\n> Hello\n");
check("extrait: wrote: coupe", fresh4.includes("démo") && !fresh4.includes("wrote"));
check("extrait: corps vide", extractNewText("   \n\n  ") === "");

// Fallback html-only
const stripped = stripHtml("<p>Bonjour <b>max</b></p>");
check("stripHtml: texte conserve", stripped.includes("Bonjour max") && !stripped.includes("<"));
check("stripHtml: entites decodees", stripHtml("A &amp; B &lt;c&gt;").includes("A & B <c>"));

// Auto-réponses
check("auto: Auto-Submitted", isAutoReply({ autoSubmitted: "auto-generated" }, "a@b.c"));
check("auto: Precedence bulk", isAutoReply({ precedence: "bulk" }, "a@b.c"));
check("auto: X-Auto-Response-Suppress", isAutoReply({ autoReplySuppressed: "DR" }, "a@b.c"));
check("auto: X-Autorespond", isAutoReply({ autorespond: "yes" }, "a@b.c"));
check("auto: List-Id", isAutoReply({ listId: "<x.list>" }, "a@b.c"));
check("auto: mailer-daemon local", isAutoReply({}, "mailer-daemon@mf.sendgrid.net"));
check("auto: postmaster insensible casse", isAutoReply({}, "POSTMASTER@x.com"));
check("auto: noreply", isAutoReply({}, "no-reply@whop.com"));
check("auto: client normal", !isAutoReply({ autoSubmitted: "no" }, "client@x.com"));
check("auto: client sans headers", !isAutoReply({}, "jean.dupont@gmail.com"));

// DSN / bounces
check("dsn: multipart/report", isDeliveryStatus({ contentType: "multipart/report; report-type=delivery-status" }, "x"));
check("dsn: X-Failed-Recipients", isDeliveryStatus({ xFailedRecipients: "dead@x.com" }, "x"));
check("dsn: objet Undelivered", isDeliveryStatus({}, "Undelivered Mail Returned to Sender"));
check("dsn: objet FR", isDeliveryStatus({}, "Échec de remise : boîte pleine"));
check("dsn: message normal", !isDeliveryStatus({}, "Bonjour"));

// Boucle : notre propre adresse
check("boucle: propre adresse insensible casse", isOwnAddress("CONTACT@Gosite.Digital", ["contact@gosite.digital"]));
check("boucle: autre adresse", !isOwnAddress("jean@gmail.com", ["contact@gosite.digital"]));

// Normalisation des message-ids (References multiples)
check("ids: plusieurs references", JSON.stringify(normalizeMessageIds("<A@x> <b@y>")) === '["a@x","b@y"]');
check("ids: null", normalizeMessageIds(null).length === 0);
check("ids: sans chevrons", JSON.stringify(normalizeMessageIds("abc@x")) === '["abc@x"]');

// Coercition de la décision LLM
const dec = coerceInboundDecision({ agent: "paymer", reply: "Voici le lien.", needsHuman: false });
check("coerce: decision valide", dec !== null && dec.agent === "paymer" && dec.reply === "Voici le lien." && dec.needsHuman === false);
check("coerce: agent inconnu", coerceInboundDecision({ agent: "banque", reply: "x" }) === null);
check("coerce: reply vide", coerceInboundDecision({ agent: "saler", reply: "  " }) === null);
check("coerce: null", coerceInboundDecision(null) === null);
const dec2 = coerceInboundDecision({ agent: "support", reply: "C'est réglé." });
check("coerce: needsHuman defaut false", dec2 !== null && dec2.needsHuman === false);

// Whitelist d'URL (anti prompt-injection)
const san = sanitizeReplyUrls("Voir https://evil.com/x et https://whop.com/pay/abc", ["https://whop.com/pay/abc"]);
check("sanitize: url hors whitelist retiree", !san.includes("evil.com"));
check("sanitize: url whitelist conservee", san.includes("https://whop.com/pay/abc"));
check("sanitize: cap 2000", sanitizeReplyUrls("x".repeat(3000), []).length <= 2000);

// Seuil de longueur : un client matché n'est jamais ignoré
check("seuil: client matche court", !shouldIgnoreShortUnmatched("Oui", true));
check("seuil: client matche vide", !shouldIgnoreShortUnmatched("", true));
check("seuil: inconnu court", shouldIgnoreShortUnmatched("ok", false));
check("seuil: inconnu long", !shouldIgnoreShortUnmatched("Message complet au-dela du seuil", false));

process.exit(fail ? 1 : 0);
