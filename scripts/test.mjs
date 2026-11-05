// Runner de tests : copie les modules concernés dans tests/_lib en corrigeant
// les imports (extension .ts requise par node --experimental-strip-types),
// neutralise les imports DB des modules purs, puis exécute chaque suite.
// tests/_lib est généré et supprimé à chaque run — jamais commité.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";

const LIB_FILES = ["format.ts", "niches.ts", "mapper.ts", "site-template.ts", "dnc.ts", "llm-coerce.ts"];
const LIB_DIR = "tests/_lib";

rmSync(LIB_DIR, { recursive: true, force: true });
mkdirSync(LIB_DIR, { recursive: true });

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
