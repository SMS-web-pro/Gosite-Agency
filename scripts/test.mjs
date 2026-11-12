// Runner de tests : copie les modules concernés dans tests/_lib en corrigeant
// les imports (extension .ts requise par node --experimental-strip-types),
// neutralise les imports DB des modules purs, puis exécute chaque suite.
// tests/_lib est généré et supprimé à chaque run — jamais commité.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";

const LIB_FILES = ["format.ts", "niches.ts", "images.ts", "images-search.ts", "mapper.ts", "site-template.ts", "dnc.ts", "llm-coerce.ts", "inbound.ts", "mime.ts", "gemini-keys.ts", "track.ts", "site-config.ts", "bundle.ts", "bundle-images.ts", "coder.ts"];
const LIB_DIR = "tests/_lib";

rmSync(LIB_DIR, { recursive: true, force: true });
mkdirSync(LIB_DIR, { recursive: true });

// Stubs des modules DB/API pour coder.ts (testé uniquement via buildSiteBundle
// avec geminiImpl/fetchImpl injectés — zéro appel réseau).
const CODER_STUBS = {
  "coder-llm-stub.ts": `export async function chatCompletion(): Promise<string | null> { return null; }\nexport function extractHtml(raw: string): string | null { const m = /<!DOCTYPE html[\\s\\S]*<\\/html>/i.exec(raw); return m ? m[0] : null; }\nexport async function llmConfigured(): Promise<boolean> { return false; }\n`,
  "coder-gemini-stub.ts": `export async function geminiCompleteStep(_opts: unknown): Promise<string | null> { return null; }\nexport async function geminiKeysConfigured(): Promise<boolean> { return false; }\n`,
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
  writeFileSync(`${LIB_DIR}/${f}`, src);
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

rmSync(LIB_DIR, { recursive: true, force: true });
console.log(`\n${tests.length - failures}/${tests.length} suites OK`);
process.exit(failures ? 1 : 0);
