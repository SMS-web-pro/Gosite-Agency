import { looksLikeOptOut, normalizeEmail } from "./_lib/dnc.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

check("STOP", looksLikeOptOut("STOP"));
check("stop svp", looksLikeOptOut("Stop svp"));
check("unsubscribe", looksLikeOptOut("Please unsubscribe me"));
check("un-subscribe", looksLikeOptOut("Please un-subscribe me"));
check("désinscription", looksLikeOptOut("Merci de prendre note de ma désinscription"));
check("désinscrire (infinitif)", looksLikeOptOut("Merci, veuillez me désinscrire de vos emails."));
check("désabonnement", looksLikeOptOut("Je confirme mon désabonnement"));
check("ne plus me contacter", looksLikeOptOut("Je veux que vous ne plus me contacter"));
check("faux positif: question", !looksLikeOptOut("Quel est le prix du site ?"));
check("faux positif: stopped", !looksLikeOptOut("Ma vitrine stopped working"));
check("faux positif: subscribe", !looksLikeOptOut("Je veux subscribe à votre newsletter"));
check("normalize", normalizeEmail("  Jean@EX.com ") === "jean@ex.com");

process.exit(fail ? 1 : 0);
