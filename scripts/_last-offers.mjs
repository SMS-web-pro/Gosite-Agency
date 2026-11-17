import dotenv from "dotenv";
import { Pool } from "pg";
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL?.trim(), ssl: { rejectUnauthorized: false } });
const { rows } = await pool.query(
  "select id, prospect_id, to_email, subject, created_at, body_html from emails where subject is not null order by created_at desc limit 4",
);
for (const r of rows) {
  console.log("=".repeat(100));
  console.log(`#${r.prospect_id} -> ${r.to_email} | ${r.created_at.toISOString()} | ${r.subject}`);
  const text = String(r.body_html ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|table|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
  console.log(text);
}
await pool.end();
