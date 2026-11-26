// Phase 10 (spec 3.1) — édition du SiteSpec par le Support (LLM injecté).

import { editSiteSpec } from "./_lib/site-editor.ts";
import type { SiteSpec } from "./_lib/site-spec.schema.ts";
import { premiumSpecFixture, specFixture } from "./spec-fixture.ts";

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

// ── DesignSpec : jamais de downgrade silencieux vers legacy ─────────────────
{
  const premium = clone(premiumSpecFixture) as SiteSpec;
  const noDesign = clone(premium) as SiteSpec;
  delete (noDesign as { design?: unknown }).design;
  const r = await editSiteSpec(premium, "Change la mission.", {
    llm: llmOnce({ updated: true, summary: "Mission", spec: noDesign }),
  });
  check("edit: design restauré", r.spec.design?.styleGuide === "calendly-navy" && r.spec.design?.motion === "balanced");
}

// ── Demande de couleur explicite : paletteMode brand conservé ───────────────
{
  const premium = clone(premiumSpecFixture) as SiteSpec;
  const brand = clone(premium) as SiteSpec;
  brand.design = { ...brand.design!, paletteMode: "brand" };
  brand.palette.primary = "#123456";
  const rb = await editSiteSpec(premium, "Utilise la couleur #123456.", {
    llm: llmOnce({ updated: true, summary: "Couleur", spec: brand }),
  });
  check("edit: palette brand conservée", rb.spec.design?.paletteMode === "brand" && rb.spec.palette.primary === "#123456");
}

// ── Palette modifiée sans mode brand : jamais de no-op silencieux ───────────
{
  const premium = clone(premiumSpecFixture) as SiteSpec;
  const noDesign = clone(premium) as SiteSpec;
  delete (noDesign as { design?: unknown }).design;
  noDesign.palette.primary = "#123456";
  const r = await editSiteSpec(premium, "Utilise la couleur #123456.", {
    llm: llmOnce({ updated: true, summary: "Couleur", spec: noDesign }),
  });
  check("edit: palette changée sans design → brand", r.spec.design?.paletteMode === "brand" && r.spec.palette.primary === "#123456");
}

{
  const premium = clone(premiumSpecFixture) as SiteSpec;
  const guideMode = clone(premium) as SiteSpec;
  guideMode.palette.accent = "#654321";
  const r = await editSiteSpec(premium, "Utilise la couleur #654321 en accent.", {
    llm: llmOnce({ updated: true, summary: "Couleur", spec: guideMode }),
  });
  check("edit: palette changée en mode guide → brand", r.spec.design?.paletteMode === "brand" && r.spec.palette.accent === "#654321");
}

// ── Spec legacy : le comportement reste inchangé ────────────────────────────
{
  const legacyChanged = clone(specFixture);
  legacyChanged.aboutPage.mission = "Mission legacy mise à jour.";
  const r = await editSiteSpec(specFixture, "Change la mission legacy.", {
    llm: llmOnce({ updated: true, summary: "Mission legacy", spec: legacyChanged }),
  });
  check("edit: legacy sans design reste legacy", r.spec.design === undefined && r.spec.aboutPage.mission === "Mission legacy mise à jour.");
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
