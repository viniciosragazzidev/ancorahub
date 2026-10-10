// Read-only: lists supervisors and the checks that send them to /access-denied
// (inactive user/tenant, no unit, inactive unit, more than one active membership).
//   node scripts/inspect-supervisors.mjs
import postgres from "postgres";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");
console.log(`Banco: ${new URL(url.replace(/^postgres(ql)?:/, "http:")).host} (somente leitura)`);

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
try {
  const rows = await sql`
    select u.email, m.role, m.job_title, m.status as membership, m.branch_id is not null as tem_unidade,
      b.status as unidade, t.status as empresa,
      (select count(*) from tenant_memberships x where x.user_id = m.user_id and x.status = 'active')::int as vinculos_ativos,
      (select count(*) from tenant_memberships x where x.supervisor_id = m.user_id and x.status = 'active')::int as equipe
    from tenant_memberships m
    join "user" u on u.id = m.user_id
    join tenants t on t.id = m.tenant_id
    left join branches b on b.id = m.branch_id
    where m.role = 'supervisor' or m.job_title = 'supervisor'
    order by u.email`;
  console.table(rows);
} finally {
  await sql.end();
}
