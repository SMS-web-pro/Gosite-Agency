import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

const dataDir =
  process.env.PGLITE_DATA_DIR?.trim() || join(process.cwd(), ".local-data", "postgres");

mkdirSync(dataDir, { recursive: true });

const globalForDb = globalThis as typeof globalThis & {
  __gositePGlite?: PGlite;
};

export const pool =
  globalForDb.__gositePGlite ??
  new PGlite(dataDir);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__gositePGlite = pool;
}

export const db = drizzle({ client: pool, schema });
