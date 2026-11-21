import { generateSiteSpec } from "./_lib/generate-spec.ts";
import { specFixture, specSheet } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

type Call = { system: string; user: string; maxTokens: number; temperature: number; jsonMode: boolean };

const good = JSON.stringify(specFixture);
const bad = JSON.stringify({
  ...specFixture,
  palette: { ...specFixture.palette, primary: "red" },
});

// 1) Succès direct : 1 appel, JSON mode, température créative, schéma injecté.
{
  const calls: Call[] = [];
  const out = await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return good; },
  });
  check("succès direct: 1 appel LLM", calls.length === 1);
  check("succès direct: jsonMode actif", calls[0]?.jsonMode === true);
  check("succès direct: température 0.7", calls[0]?.temperature === 0.7);
  check("succès direct: maxTokens 12000", calls[0]?.maxTokens === 12000);
  check("system = directeur artistique", calls[0]?.system.includes("directeur artistique senior"));
  check("system contient le schéma JSON", calls[0]?.system.includes("SCHÉMA JSON SITESPEC") && calls[0]?.system.includes('"homeSections"'));
  check("user contient la fiche client", calls[0]?.user.includes("Nom du business : Test Co") && calls[0]?.user.includes("Ville : Dallas"));
  check("spec retournée = fixture", out.metaTitle === specFixture.metaTitle && out.homeSections.length === specFixture.homeSections.length && out.servicePages.length === 3);
}

// 1b) Anti-clone : les accroches déjà publiées sont injectées dans le prompt.
{
  const calls: Call[] = [];
  await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return good; },
    avoid: ["Chicago's finest barber experience", "Do I need an appointment?"],
  });
  check("anti-clone: bloc interdit présent", calls[0]?.user.includes("CONTENU DÉJÀ PUBLIÉ — INTERDIT DE RÉUTILISER"));
  check("anti-clone: headline rappelée", calls[0]?.user.includes("Chicago's finest barber experience"));
  check("anti-clone: FAQ rappelée", calls[0]?.user.includes("Do I need an appointment?"));
}

// 2) JSON entouré de markdown (fences) : le parse loose prend le relais.
{
  const out = await generateSiteSpec(specSheet, {
    llm: async () => "Voici le résultat :\n```json\n" + good + "\n```",
  });
  check("JSON avec fences accepté", out.businessModel === "contractor");
}

// 3) Validation échouée puis retry corrigé : 2 appels, température 0.3,
//    le prompt de correction rappelle la fiche, l'erreur ET le JSON fautif.
{
  const calls: Call[] = [];
  const out = await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return calls.length === 1 ? bad : good; },
  });
  check("retry: 2 appels LLM", calls.length === 2);
  check("retry: température 0.3", calls[1]?.temperature === 0.3);
  check("retry: erreur zod dans le prompt", calls[1]?.user.includes("palette.primary"));
  check("retry: JSON fautif rappelé", calls[1]?.user.includes('"primary":"red"'));
  check("retry: fiche rappelée", calls[1]?.user.includes("Nom du business : Test Co"));
  check("retry: spec valide retournée", out.metaTitle === specFixture.metaTitle);
}

// 3b) Section contact absente : la validation métier déclenche un retry même
//     si le JSON est valide pour Zod (un site sans formulaire est inutilisable).
{
  const faq = specFixture.homeSections.find((s) => s.type === "faq")!;
  const noContact = JSON.stringify({
    ...specFixture,
    homeSections: [...specFixture.homeSections.filter((s) => s.type !== "contact"), faq],
  });
  const calls: Call[] = [];
  const out = await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return calls.length === 1 ? noContact : good; },
  });
  check("contact manquant: retry déclenché", calls.length === 2);
  check("contact manquant: consigne dans le prompt", calls[1]?.user.includes("sections obligatoires manquantes (contact)"));
  check("contact manquant: spec corrigée retournée", out.homeSections.some((s) => s.type === "contact"));
}

// 4) Toujours invalide après retry -> throw avec les erreurs.
{
  let threw = false;
  try {
    await generateSiteSpec(specSheet, { llm: async () => bad });
  } catch (e) {
    threw = /validation failed after retry/.test(e instanceof Error ? e.message : String(e));
  }
  check("2 échecs -> throw explicite", threw);
}

// 5) LLM indisponible (null) -> throw explicite, pas de retry.
{
  let calls = 0;
  let msg = "";
  try {
    await generateSiteSpec(specSheet, { llm: async () => { calls++; return null; } });
  } catch (e) {
    msg = e instanceof Error ? e.message : String(e);
  }
  check("LLM null -> throw 'indisponible'", /LLM indisponible/.test(msg));
  check("LLM null -> pas de retry", calls === 1);
}

process.exit(fail ? 1 : 0);
