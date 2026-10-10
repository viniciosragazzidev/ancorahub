// Read-only: lists goals with scope 'team'. Since 2026-10-10 a team goal counts
// only the brokers of the supervisor in scope_id (before, sales_count counted the
// whole company). Run before the deploy and warn whoever owns these goals.
//   node scripts/inspect-team-goals.mjs
import postgres from "postgres";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");
console.log(`Banco: ${new URL(url.replace(/^postgres(ql)?:/, "http:")).host} (somente leitura)`);
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
try {
  const rows = await sql`
    select g.name, g.target_type, g.target_value, g.start_date, g.end_date, g.active,
           u.name as alvo, m.role as papel_do_alvo
    from goals g
    left join "user" u on u.id = g.scope_id
    left join tenant_memberships m on m.user_id = g.scope_id and m.tenant_id = g.tenant_id
    where g.scope = 'team'
    order by g.active desc, g.end_date desc`;
  if (!rows.length) console.log("Nenhuma meta de equipe. Nada muda para ninguém.");
  for (const row of rows) {
    const aviso = row.papel_do_alvo === "supervisor" ? "ok (alvo é supervisor)" : "ATENÇÃO: alvo não é supervisor, a meta vai zerar";
    console.log(`- ${row.name} (${row.target_type} ${row.target_value}) · ${row.active ? "ativa" : "inativa"} · alvo: ${row.alvo ?? "sem alvo"} · ${aviso}`);
  }
} finally {
  await sql.end();
}
