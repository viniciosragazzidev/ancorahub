// Read-only: AI calls of the last 48h by purpose and model (success x failure), to spot retired models.
//   node scripts/inspect-ai-health.mjs
import postgres from "postgres";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
try {
  const rows = await sql`
    select provider as purpose, model_used, status, count(*)::int as n, max(created_at) as last, min(error_message) as error
    from ai_attendance_logs where created_at > now() - interval '48 hours'
    group by 1, 2, 3 order by 1, 2, 3`;
  for (const row of rows) console.log(`${row.purpose} · ${row.model_used} · ${row.status} · ${row.n} · último ${row.last.toISOString()}${row.error ? ` · ${row.error}` : ""}`);
  if (!rows.length) console.log("Nenhuma chamada de IA nas últimas 48h.");
} finally {
  await sql.end();
}
