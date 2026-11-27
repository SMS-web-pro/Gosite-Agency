import { generateSiteSpec } from "./_lib/generate-spec.ts";
import { STYLE_GUIDE_IDS } from "./_lib/site-spec.schema.ts";
import { premiumSpecFixture, specFixture, specSheet } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

type Call = { system: string; user: string; maxTokens: number; temperature: number; jsonMode: boolean };
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const premium = () => clone(premiumSpecFixture) as Record<string, any>;
const heroOf = (s: Record<string, any>) => s.homeSections.find((x: Record<string, any>) => x.type === "hero");

const good = JSON.stringify(premiumSpecFixture);
const bad = JSON.stringify({
  ...premiumSpecFixture,
  palette: { ...premiumSpecFixture.palette, primary: "red" },
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
  check("system: 7 guides", STYLE_GUIDE_IDS.every((id) => calls[0]?.system.includes(id)) && calls[0]?.system.includes("paletteMode"));
  check("user contient la fiche client", calls[0]?.user.includes("Nom du business : Test Co") && calls[0]?.user.includes("Ville : Dallas"));
  check("spec retournée = fixture", out.metaTitle === premiumSpecFixture.metaTitle && out.homeSections.length === premiumSpecFixture.homeSections.length && out.servicePages.length === 3);
  check("design accepté", out.design?.styleGuide === "calendly-navy" && out.design.hero === "immersive-full");
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

// 1c) Variété des guides : les styleGuide récents sont rappelés au LLM.
{
  const calls: Call[] = [];
  await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return good; },
    avoidStyles: ["craft-scrapbook", "basis-technical"],
  });
  check("guides récents: bloc présent", calls[0]?.user.includes("STYLE GUIDES RÉCEMMENT UTILISÉS"));
  check("guides récents dans le prompt", calls[0]?.user.includes("craft-scrapbook") && calls[0]?.user.includes("basis-technical"));
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
  check("retry: spec valide retournée", out.metaTitle === premiumSpecFixture.metaTitle);
}

// 3b) Section contact absente : la validation métier déclenche un retry même
//     si le JSON est valide pour Zod (un site sans formulaire est inutilisable).
{
  const faq = premiumSpecFixture.homeSections.find((s) => s.type === "faq")!;
  const noContact = JSON.stringify({
    ...premiumSpecFixture,
    homeSections: [...premiumSpecFixture.homeSections.filter((s) => s.type !== "contact"), faq],
  });
  const calls: Call[] = [];
  const out = await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return calls.length === 1 ? noContact : good; },
  });
  check("contact manquant: retry déclenché", calls.length === 2);
  check("contact manquant: consigne dans le prompt", calls[1]?.user.includes("sections obligatoires manquantes (contact)"));
  check("contact manquant: spec corrigée retournée", out.homeSections.some((s) => s.type === "contact"));
}

// 3c) Design absent : la génération exige un DesignSpec complet.
{
  const s = premium();
  delete s.design;
  const calls: Call[] = [];
  await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return calls.length === 1 ? JSON.stringify(s) : good; },
  });
  check("design manquant: retry", calls.length === 2 && Boolean(calls[1]?.user.includes("design")));
}

// 3d) Hero non immersif : style "split" refusé.
{
  const s = premium();
  heroOf(s).style = "split";
  const calls: Call[] = [];
  await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return calls.length === 1 ? JSON.stringify(s) : good; },
  });
  check("hero non immersif: retry", calls.length === 2 && Boolean(calls[1]?.user.includes("immersive")));
}

// 3e) secondaryCta obligatoire.
{
  const s = premium();
  delete heroOf(s).secondaryCta;
  const calls: Call[] = [];
  await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return calls.length === 1 ? JSON.stringify(s) : good; },
  });
  check("secondaryCta manquant: retry", calls.length === 2 && Boolean(calls[1]?.user.includes("secondaryCta")));
}

// 3f) Combinaison guide/hero non autorisée.
{
  const s = premium();
  s.design.hero = "technical";
  const calls: Call[] = [];
  await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return calls.length === 1 ? JSON.stringify(s) : good; },
  });
  check("hero non autorisé: retry", calls.length === 2 && Boolean(calls[1]?.user.includes("non autorisé")));
}

// 3g) La génération ne peut pas court-circuiter les palettes du guide.
{
  const s = premium();
  s.design.paletteMode = "brand";
  const calls: Call[] = [];
  await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return calls.length === 1 ? JSON.stringify(s) : good; },
  });
  check("paletteMode brand: retry", calls.length === 2 && Boolean(calls[1]?.user.includes("paletteMode")));
}

// 3h) Ancien spec sans design : refusé pour toute nouvelle génération.
{
  const calls: Call[] = [];
  await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return calls.length === 1 ? JSON.stringify(specFixture) : good; },
  });
  check("legacy sans design: retry", calls.length === 2 && Boolean(calls[1]?.user.includes("design")));
}

// 3i) Réparation déterministe des erreurs fréquentes du LLM (meta trop longue, CTA invalide).
{
  const s = premium();
  s.metaDescription = "x".repeat(200);
  s.ogDescription = "y".repeat(250);
  heroOf(s).primaryCta.action = "action-invalide";
  heroOf(s).primaryCta.label = "z".repeat(40);
  const calls: Call[] = [];
  const out = await generateSiteSpec(specSheet, {
    llm: async (p) => { calls.push(p); return JSON.stringify(s); },
  });
  check("réparation: meta/og tronqués", out.metaDescription.length === 160 && out.ogDescription.length === 200);
  check("réparation: CTA invalide -> call", out.homeSections[0].primaryCta.action === "call");
  check("réparation: libellé CTA tronqué", out.homeSections[0].primaryCta.label.length === 30);
  check("réparation: pas de retry", calls.length === 1);
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
