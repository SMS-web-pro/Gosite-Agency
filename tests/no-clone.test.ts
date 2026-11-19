// Phase 12 (spec 5.4) — deux sites de la même niche/ville ne doivent pas être
// des clones : headlines, FAQ et meta descriptions différentes.

import { generateSiteSpec } from "./_lib/generate-spec.ts";
import { renderFullSite } from "./_lib/render.ts";
import { specFixture, specSheet } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function gymLlm(variant: 1 | 2) {
  return async (p: { user: string }): Promise<string> => {
    const name = /Nom du business : (.+)/.exec(p.user)?.[1]?.trim() ?? "Gym";
    const city = /Ville : (.+)/.exec(p.user)?.[1]?.trim() ?? "Ville";
    const s = clone(specFixture);
    s.businessModel = "membership";
    s.metaTitle = `${name} — ${city}`.slice(0, 60);
    s.metaDescription = variant === 1
      ? `${name} à ${city} : musculation, coaching et cours collectifs pour progresser vite.`
      : `${name} à ${city} : cardio, cross-training et bien-être dans une ambiance conviviale.`;
    s.ogDescription = variant === 1
      ? `La salle de référence à ${city} pour la musculation et le coaching.`
      : `Bougez autrement à ${city} avec le cardio et le cross-training.`;
    const hero = s.homeSections[0];
    if (hero.type === "hero") {
      hero.headline = variant === 1 ? `${name} : la force à ${city}` : `${name} : bougez autrement à ${city}`;
      hero.subheadline = variant === 1
        ? "Un plateau de musculation complet et des coachs présents à chaque séance."
        : "Des cours dynamiques et un suivi personnalisé pour atteindre vos objectifs.";
    }
    const faq = s.homeSections.find((x) => x.type === "faq");
    if (faq && faq.type === "faq") {
      faq.items[0] = variant === 1
        ? { question: "Peut-on essayer avant de s'abonner ?", answer: "Oui, une séance d'essai gratuite est offerte sur simple demande." }
        : { question: "Quels équipements sont disponibles ?", answer: "Cardio, cross-training, haltérophilie et espace mobilité." };
    }
    s.servicePages[0].metaDescription = variant === 1
      ? `Musculation à ${city} avec coach et programme personnalisé.`
      : `Cardio et cross-training à ${city} pour tous les niveaux.`;
    return JSON.stringify(s);
  };
}

const sheetA = { ...specSheet, BUSINESS_NAME: "Atlas Force", BUSINESS_TYPE: "gym", CITY: "Marrakech", LANG: "fr" };
const sheetB = { ...sheetA, BUSINESS_NAME: "Iron Oasis" };

const a = await generateSiteSpec(sheetA, { llm: gymLlm(1) });
const b = await generateSiteSpec(sheetB, { llm: gymLlm(2) });

const heroA = a.homeSections.find((s) => s.type === "hero");
const heroB = b.homeSections.find((s) => s.type === "hero");
check("no-clone: headlines différentes", heroA?.type === "hero" && heroB?.type === "hero" && heroA.headline !== heroB.headline);
check("no-clone: headlines personnalisées", (heroA?.type === "hero" && heroA.headline.includes("Atlas Force")) && (heroB?.type === "hero" && heroB.headline.includes("Iron Oasis")));

const faqA = a.homeSections.find((s) => s.type === "faq");
const faqB = b.homeSections.find((s) => s.type === "faq");
check("no-clone: FAQ différentes", faqA?.type === "faq" && faqB?.type === "faq" && faqA.items[0].question !== faqB.items[0].question);

check("no-clone: meta descriptions différentes", a.metaDescription !== b.metaDescription);
check("no-clone: meta pages service différentes", a.servicePages[0].metaDescription !== b.servicePages[0].metaDescription);

const htmlA = renderFullSite(a, sheetA);
const htmlB = renderFullSite(b, sheetB);
check("no-clone: rendu A contient sa headline", (htmlA["index.html"] ?? "").includes("Atlas Force : la force à Marrakech"));
check("no-clone: rendu B contient sa headline", (htmlB["index.html"] ?? "").includes("Iron Oasis : bougez autrement à Marrakech"));
check("no-clone: rendus différents", (htmlA["index.html"] ?? "") !== (htmlB["index.html"] ?? ""));

process.exit(fail ? 1 : 0);
