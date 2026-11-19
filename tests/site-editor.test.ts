// Phase 10 (spec 3.1) — édition du SiteSpec par le Support (LLM injecté).

import { editSiteSpec } from "./_lib/site-editor.ts";
import { specFixture } from "./spec-fixture.ts";

let fail = 0;
const check = (n: string, c: boolean) => { if (!c) { fail++; console.log("FAIL", n); } else console.log("ok  ", n); };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const changed = clone(specFixture);
changed.aboutPage.mission = "Une nouvelle mission validée par le client.";

const llmOnce = (payload: unknown, counter?: { n: number }) =>
  async () => {
    if (counter) counter.n++;
    return JSON.stringify(payload);
  };

// ── Modification appliquée ──────────────────────────────────────────────────
{
  const r = await editSiteSpec(specFixture, "Change la mission à « Une nouvelle mission validée par le client. »", {
    llm: llmOnce({ updated: true, summary: "Mission mise à jour", spec: changed }),
  });
  check("edit: updated=true", r.updated === true);
  check("edit: spec modifié", r.spec.aboutPage.mission === changed.aboutPage.mission);
  check("edit: reste valide (metaTitle)", r.spec.metaTitle === specFixture.metaTitle);
  check("edit: summary", r.summary === "Mission mise à jour");
}

// ── Demande hors périmètre : aucun changement ───────────────────────────────
{
  const r = await editSiteSpec(specFixture, "Merci beaucoup, à bientôt !", {
    llm: llmOnce({ updated: false, summary: "Pas une modification", spec: specFixture }),
  });
  check("edit: updated=false", r.updated === false);
  check("edit: spec inchangé", r.spec.aboutPage.mission === specFixture.aboutPage.mission);
}

// ── updated=false sans spec renvoyé : on garde le spec courant ──────────────
{
  const r = await editSiteSpec(specFixture, "Quel est le prix ?", {
    llm: llmOnce({ updated: false, summary: "Question" }),
  });
  check("edit: updated=false sans spec → spec courant", r.updated === false && r.spec.metaTitle === specFixture.metaTitle);
}

// ── Spec invalide puis retry valide ─────────────────────────────────────────
{
  const counter = { n: 0 };
  const r = await editSiteSpec(specFixture, "Change le téléphone", {
    llm: async () => {
      counter.n++;
      return counter.n === 1
        ? JSON.stringify({ updated: true, summary: "brouillon", spec: { lang: "fr" } })
        : JSON.stringify({ updated: true, summary: "Téléphone mis à jour", spec: changed });
    },
  });
  check("edit: retry déclenché", counter.n === 2);
  check("edit: retry valide", r.updated && r.spec.aboutPage.mission === changed.aboutPage.mission);
}

// ── Échecs ──────────────────────────────────────────────────────────────────
{
  let calls = 0;
  let rejected = false;
  try {
    await editSiteSpec(specFixture, "Change tout", {
      llm: async () => {
        calls++;
        return JSON.stringify({ updated: true, spec: { invalid: true } });
      },
    });
  } catch {
    rejected = true;
  }
  check("edit: spec invalide 2x → throw", rejected && calls === 2);

  let rejectedNull = false;
  try {
    await editSiteSpec(specFixture, "Change le téléphone", { llm: async () => null });
  } catch {
    rejectedNull = true;
  }
  check("edit: LLM null → throw", rejectedNull);

  let called = 0;
  const empty = await editSiteSpec(specFixture, "   ", {
    llm: async () => {
      called++;
      return null;
    },
  });
  check("edit: demande vide → aucun appel LLM", called === 0 && empty.updated === false && empty.spec.metaTitle === specFixture.metaTitle);
}

console.log(fail ? `\n${fail} échec(s)` : "\nOK");
process.exit(fail ? 1 : 0);
