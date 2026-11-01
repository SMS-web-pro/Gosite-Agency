import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL?.trim();

// SSL automatique pour les bases hébergées (Neon, Supabase, Vercel Postgres…)
// et désactivé en local.
function needsSsl(url: string): boolean {
  if (/localhost|127\.0\.0\.1/.test(url)) return false;
  if (/sslmode=disable/.test(url)) return false;
  return true;
}

const globalForDb = globalThis as typeof globalThis & {
  __gositePgPool?: Pool;
  __gositePGlite?: PGlite;
};

type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

let runDdl: (sql: string) => Promise<void>;
let db: Db;

if (databaseUrl) {
  const pool =
    globalForDb.__gositePgPool ??
    new Pool({
      connectionString: databaseUrl,
      ssl: needsSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
      max: 5, // serverless-friendly
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });
  globalForDb.__gositePgPool = pool;
  db = drizzleNodePg(pool, { schema });
  runDdl = async (sql) => {
    await pool.query(sql);
  };
} else {
  const dataDir =
    process.env.PGLITE_DATA_DIR?.trim() || join(process.cwd(), ".local-data", "postgres");
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    throw new Error(
      `Impossible de créer le dossier de données PGlite « ${dataDir} » ` +
        `(vérifiez le chemin et les permissions, ou définissez PGLITE_DATA_DIR) : ` +
        (err instanceof Error ? err.message : String(err)),
    );
  }
  const pglite = globalForDb.__gositePGlite ?? new PGlite(dataDir);
  globalForDb.__gositePGlite = pglite;
  db = drizzlePglite({ client: pglite, schema });
  runDdl = async (sql) => {
    await pglite.exec(sql);
  };
}

export { db };

export function execDdl(sql: string): Promise<void> {
  return runDdl(sql);
}
