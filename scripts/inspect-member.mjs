// Read-only: shows how a member is stored (membership, profile, invitation,
// team) and the latest audit entries about them. Writes nothing.
//   node scripts/inspect-member.mjs <email>
import postgres from "postgres";
import fs from "node:fs";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) throw new Error("Informe o e-mail: node scripts/inspect-member.mjs <email>");
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");
console.log(`Banco: ${new URL(url.replace(/^postgres(ql)?:/, "http:")).host} (somente leitura)`);

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
try {
  const column = await sql`select column_name from information_schema.columns where table_name = 'tenant_memberships' and column_name = 'supervisor_id'`;
  console.log(`
Coluna tenant_memberships.supervisor_id: ${column.length ? "EXISTE" : "NÃO EXISTE (migração 0112 não aplicada)"}`);
  console.log("Regras (check/trigger) da tabela:", await sql`
    select conname as nome, pg_get_constraintdef(oid) as regra from pg_constraint
    where conrelid = 'tenant_memberships'::regclass and contype in ('c','f')`);
  console.log("Triggers:", await sql`select tgname from pg_trigger where tgrelid = 'tenant_memberships'::regclass and not tgisinternal`);
  if (!column.length) process.exit(0);
  console.log("Índices:", (await sql`select indexdef from pg_indexes where tablename = 'tenant_memberships'`).map((row) => row.indexdef));
  console.log("Função do gatilho:", (await sql`
    select pg_get_functiondef(p.oid) as def from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgrelid = 'tenant_memberships'::regclass and not t.tgisinternal`).map((row) => row.def).join(String.fromCharCode(10)));
  // --probe <membershipId>: try the same change the screen makes and ROLL IT BACK, only to read the real error.
  const probeIndex = process.argv.indexOf("--probe");
  if (probeIndex > 0) {
    const membershipId = process.argv[probeIndex + 1];
    try {
      await sql.begin(async (tx) => {
        await tx`update tenant_memberships set role = 'supervisor', job_title = 'supervisor', supervisor_id = null, updated_at = now() where id = ${membershipId}`;
        throw new Error("__rollback__");
      });
    } catch (error) {
      console.log(error.message === "__rollback__" ? "PROBE: a alteração passa no banco (desfeita)." : `PROBE: erro real do banco: ${error.message} (${error.code ?? ""}) ${error.detail ?? ""}`);
    }
  }
  const users = await sql`select id, name, email, status, active from "user" where lower(email) = ${email}`;
  console.log("\nUsuário:", users);
  for (const user of users) {
    console.log("\nVínculos (tenant_memberships):", await sql`
      select m.id, m.role, m.job_title, m.status, m.branch_id, b.name as branch, m.supervisor_id, m.updated_at
      from tenant_memberships m left join branches b on b.id = m.branch_id where m.user_id = ${user.id}`);
    console.log("\nPerfil (broker_profiles):", await sql`
      select id, branch_id, lifecycle_status, invited_email from broker_profiles where user_id = ${user.id}`);
    console.log("\nCorretores que ele supervisiona:", await sql`
      select u.name, m.branch_id from tenant_memberships m join "user" u on u.id = m.user_id where m.supervisor_id = ${user.id}`);
    console.log("\nÚltimas auditorias:", await sql`
      select a.created_at, a.entidade, a.acao from audit_logs a
      where a.entidade_id in (select id from tenant_memberships where user_id = ${user.id}) or a.entidade_id = ${user.id}
      order by a.created_at desc limit 8`);
  }
} finally {
  await sql.end();
}
