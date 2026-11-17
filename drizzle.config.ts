import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Source de vérité : src/db/schema.ts. Les migrations vivent dans ./drizzle.
// DATABASE_URL est lu depuis .env.local (Next.js le charge, drizzle-kit non).
const envFile = (() => {
  try {
    return readFileSync(".env.local", "utf8");
  } catch {
    return "";
  }
})();
const url =
  process.env.DATABASE_URL?.trim() ||
  /DATABASE_URL="([^"]+)"/.exec(envFile)?.[1] ||
  "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
