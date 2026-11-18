// Runner de tests : copie les modules concernés dans tests/_lib en corrigeant
// les imports (extension .ts requise par node --experimental-strip-types),
// neutralise les imports DB des modules purs, puis exécute chaque suite.
// tests/_lib est généré à chaque run — jamais commité (.gitignore:13).
// PAS de rmSync : deux runs concurrents (agent + opérateur sur ce dépôt)
// écrivent exactement le même contenu dans le même dossier — la course ne
// peut plus casser les imports des suites déjà en cours.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";

const LIB_FILES = ["format.ts", "auth.ts", "llm-fetch.ts", "niches.ts", "images.ts", "images-search.ts", "mapper.ts", "site-template.ts", "dnc.ts", "llm-coerce.ts", "inbound.ts", "mime.ts", "gemini-keys.ts", "track.ts", "site-config.ts", "bundle.ts", "bundle-images.ts", "coder.ts", "form-receive.ts", "telegram-health.ts", "fx.ts", "offer-copy.ts", "emailer.ts"];
const LIB_DIR = "tests/_lib";

mkdirSync(LIB_DIR, { recursive: true });

// Stubs des modules DB/API pour coder.ts (testé uniquement via buildSiteBundle
// avec geminiImpl/fetchImpl injectés — zéro appel réseau).
const CODER_STUBS = {
  "coder-llm-stub.ts": `export async function chatCompletion(): Promise<string | null> { return null; }\nexport function extractHtml(raw: string): string | null { const m = /<!DOCTYPE html[\\s\\S]*<\\/html>/i.exec(raw); return m ? m[0] : null; }\nexport async function llmConfigured(): Promise<boolean> { return false; }\n`,
  "coder-gemini-stub.ts": `export async function geminiCompleteStep(_opts: unknown): Promise<string | null> { return null; }\nexport async function geminiKeysConfigured(): Promise<boolean> { return false; }\n`,
};

// Stubs emailer : settings figés (taux FX connus, Brevo absent -> chemin
// simulé), LLM absent -> copy fallback. Zéro réseau, zéro base.
const EMAILER_STUBS = {
  "settings-emailer-stub.ts": `export const STUB_SETTINGS: Record<string, string> = {\n  OFFER_PRICE: "259",\n  RENEWAL_PRICE: "45",\n  OFFER_CURRENCY: "USD",\n  FX_RATES: JSON.stringify({ rates: { MAD: 9.94, EUR: 0.92, GBP: 0.79 }, fetchedAt: new Date().toISOString() }),\n  BREVO_API_KEY: "",\n  BREVO_SENDER_EMAIL: "hello@gosite.digital",\n  BREVO_SENDER_NAME: "GoSite Digital",\n  AGENCY_ADDRESS: "",\n  APP_BASE_URL: "https://gosite.digital",\n  ALLOW_SIMULATION: "true",\n};\nexport async function getSetting(key: string): Promise<string> { return STUB_SETTINGS[key] ?? ""; }\nexport async function setSetting(key: string, value: string): Promise<void> { STUB_SETTINGS[key] = value; }\nexport async function allowSimulation(): Promise<boolean> { return true; }\n`,
  "agent-brain-stub.ts": `export async function agentThinkJson<T>(_opts: unknown): Promise<T | null> { return null; }\n`,
  "dnc-emailer-stub.ts": `export async function isDoNotContact(_e: string | null): Promise<boolean> { return false; }\nexport async function addDoNotContact(_e: string): Promise<void> {}\n`,
};

for (const f of LIB_FILES) {
  let src = readFileSync(`src/lib/${f}`, "utf8");
  // imports relatifs sans extension -> avec extension (exigence type-stripping)
  src = src.replace(/from "\.\/([a-z-]+)"/g, 'from "./$1.ts"');
  if (f === "dnc.ts") {
    // les fonctions testées sont pures : on retire les imports DB/drizzle
    src = src
      .split("\n")
      .filter((l) => !l.includes('"@/db"') && !l.includes('"@/db/schema"') && !l.includes('"drizzle-orm"'))
      .join("\n");
  }
  if (f === "coder.ts") {
    src = src.replace(/from "\.\/llm\.ts"/g, 'from "./coder-llm-stub.ts"').replace(/from "\.\/gemini\.ts"/g, 'from "./coder-gemini-stub.ts"');
    for (const [name, content] of Object.entries(CODER_STUBS)) writeFileSync(`${LIB_DIR}/${name}`, content);
  }
  if (f === "emailer.ts") {
    // Réécrire AUSSI les imports dynamiques (import("./x")) : site-config et
    // bundle sont appelés dynamiquement par emailer. Puis settings/agent-brain/
    // dnc -> stubs (copie pure ou neutralisés).
    src = src
      .replace(/import\("\.\/([a-z-]+)"\)/g, 'import("./$1.ts")')
      .replace(/import\("\.\/settings\.ts"\)/g, 'import("./settings-emailer-stub.ts")')
      .replace(/import\("\.\/agent-brain\.ts"\)/g, 'import("./agent-brain-stub.ts")')
      .replace(/import\("\.\/dnc\.ts"\)/g, 'import("./dnc-emailer-stub.ts")')
      .replace(/from "\.\/settings\.ts"/g, 'from "./settings-emailer-stub.ts"');
    for (const [name, content] of Object.entries(EMAILER_STUBS)) writeFileSync(`${LIB_DIR}/${name}`, content);
  }
  writeFileSync(`${LIB_DIR}/${f}`, src);
}

// site-engine (refonte 2.1/2.2/2.3) : copie à plat + réécriture des imports
// vers les stubs (gemini) et le parseLooseJson neutralisé (agent-brain sans DB).
// Tous les modules du moteur sont aplatis dans tests/_lib : les imports relatifs
// (types, utils, composants, css) sont ramenés au basename + extension .ts.
{
  // agent-brain.ts copié sans ses imports DB/réseau : parseLooseJson est pur.
  const brain = readFileSync("src/lib/agent-brain.ts", "utf8")
    .split("\n")
    .filter((l) => !l.startsWith("import "))
    .join("\n");
  writeFileSync(`${LIB_DIR}/agent-brain.ts`, brain);
  writeFileSync(
    `${LIB_DIR}/gemini-spec-stub.ts`,
    `export async function geminiCompleteStep(_opts: unknown): Promise<string | null> { return null; }\n`,
  );

  const files = [
    ["site-spec.schema.ts", "site-spec.schema.ts"],
    ["types.ts", "types.ts"],
    ["generate-spec.ts", "generate-spec.ts"],
    ["css/generate-theme.ts", "generate-theme.ts"],
    ["css/base.ts", "base.ts"],
    ["css/components.ts", "site-components.ts"],
    ["utils/escape.ts", "escape.ts"],
    ["utils/labels.ts", "labels.ts"],
    ["components/common/ui.ts", "ui.ts"],
    ["components/common/header.ts", "header.ts"],
    ["components/common/footer.ts", "footer.ts"],
    ["components/common/mobile-bar.ts", "mobile-bar.ts"],
    ["components/common/seo-head.ts", "seo-head.ts"],
    ["components/hero/hero-split.ts", "hero-split.ts"],
    ["components/hero/hero-centered.ts", "hero-centered.ts"],
    ["components/hero/hero-fullwidth.ts", "hero-fullwidth.ts"],
    ["components/hero/hero-minimal.ts", "hero-minimal.ts"],
    ["components/services/services-grid3.ts", "services-grid3.ts"],
    ["components/services/services-grid2.ts", "services-grid2.ts"],
    ["components/services/services-list.ts", "services-list.ts"],
    ["components/services/services-cards-h.ts", "services-cards-h.ts"],
    ["components/process/process-timeline.ts", "process-timeline.ts"],
    ["components/process/process-numbered.ts", "process-numbered.ts"],
    ["components/process/process-icons.ts", "process-icons.ts"],
    ["components/about/about-highlights.ts", "about-highlights.ts"],
    ["components/faq/faq-accordion.ts", "faq-accordion.ts"],
    ["components/testimonials/testimonials-cards.ts", "testimonials-cards.ts"],
    ["components/gallery/gallery-masonry.ts", "gallery-masonry.ts"],
    ["components/gallery/gallery-grid.ts", "gallery-grid.ts"],
    ["components/contact/contact-form-map.ts", "contact-form-map.ts"],
    ["components/trust/trust-bar.ts", "trust-bar.ts"],
    ["components/registry.ts", "registry.ts"],
  ];
  for (const [from, to] of files) {
    let src = readFileSync(`src/site-engine/${from}`, "utf8");
    src = src
      .replace(/from "\.\.\/lib\/agent-brain"/g, 'from "./agent-brain.ts"')
      .replace(/from "\.\.\/lib\/gemini"/g, 'from "./gemini-spec-stub.ts"')
      .replace(/from "((?:\.\.?\/)+)([A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)"/g, (_m, _up, p) => {
        const base = p.split("/").pop() ?? p;
        return `from "./${base.endsWith(".ts") ? base : `${base}.ts`}"`;
      });
    writeFileSync(`${LIB_DIR}/${to}`, src);
  }
}

const tests = globSync("tests/*.test.ts");
let failures = 0;
for (const t of tests) {
  console.log(`\n── ${t}`);
  try {
    execFileSync("node", ["--experimental-strip-types", t], { stdio: "inherit" });
  } catch {
    failures++;
  }
}

console.log(`\n${tests.length - failures}/${tests.length} suites OK`);
process.exit(failures ? 1 : 0);
