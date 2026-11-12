import { validateFormSubmission } from "./_lib/form-receive.ts";

let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`ok   ${name}`);
  else {
    console.log(`FAIL ${name}`);
    fail++;
  }
}

const good = { name: "John Smith", phone: "+1 469-555-3810", email: "j@example.com", zip: "75201", service: "Leak Repair", message: "Kitchen sink is leaking badly.", consent: true };

// 1. Valide → ok:true + valeurs trimées
{
  const r = validateFormSubmission({ ...good, name: "  John Smith  ", message: "  Kitchen sink is leaking badly.  " });
  check("valide: ok", r.ok === true && r.errors.length === 0);
  check("valide: values trims", r.values?.name === "John Smith" && r.values?.message === "Kitchen sink is leaking badly.");
  check("valide: email présent", r.values?.email === "j@example.com");
}

// 2. Nom trop court
check("nom 1 car -> erreur", validateFormSubmission({ ...good, name: "J" }).ok === false);

// 3. Message trop court
check("message 5 car -> erreur", validateFormSubmission({ ...good, message: "help" }).ok === false);

// 4. Consent false
check("consent false -> erreur", validateFormSubmission({ ...good, consent: false }).ok === false);

// 5. Téléphone invalide
check("phone sans chiffres -> erreur", validateFormSubmission({ ...good, phone: "abc???" }).ok === false);

// 6. Email optionnel : absent ok, invalide rejeté
check("email absent -> ok", validateFormSubmission({ ...good, email: "" }).ok === true && validateFormSubmission({ ...good, email: "" }).values?.email === null);
check("email invalide -> erreur", validateFormSubmission({ ...good, email: "pas-un-email" }).ok === false);

// 7. Service inconnu (liste fournie) / connu
check("service inconnu -> erreur", validateFormSubmission({ ...good, service: "Widget" }, ["Leak Repair", "Repiping"]).ok === false);
check("service connu -> ok", validateFormSubmission({ ...good, service: "Repiping" }, ["Leak Repair", "Repiping"]).ok === true);

// 8. Champs manquants / body non-objet
check("body null -> erreur", validateFormSubmission(null).ok === false);
check("champs absents -> erreurs multiples", (() => { const r = validateFormSubmission({}); return r.ok === false && r.errors.length >= 4; })());
check("zip manquant -> erreur", validateFormSubmission({ ...good, zip: "" }).ok === false);

process.exit(fail ? 1 : 0);
