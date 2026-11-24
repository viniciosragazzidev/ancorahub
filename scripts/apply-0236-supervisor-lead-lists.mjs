// node scripts/apply-0236-supervisor-lead-lists.mjs [--apply]
// Aplica só a migration 0236 (listas de importação do supervisor, DEC-191), sem tocar nas outras pendentes.
// Sem --apply: só lê o banco e mostra o que vai acontecer. Com --apply: uma transação para tabela, coluna e
// backfill; o índice em `leads` é criado depois com CONCURRENTLY, para não travar gravações. Registra o hash em
// drizzle.__drizzle_migrations para o `npm run db:migrate` não repetir.
import { createHash } from "node:crypto";
import fs from "node:fs";
import postgres from "postgres";

const apply = process.argv.includes("--apply");
const env = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
const configured = (key) => process.env[key] ?? env.match(new RegExp(`^${key}=["']?([^"'\\r\\n]+)`, "m"))?.[1];
const url = configured("SUPABASE_DB_URL") ?? configured("DATABASE_URL");
if (!url) throw new Error("Configure SUPABASE_DB_URL ou DATABASE_URL antes de continuar.");
console.log(`Banco: ${new URL(url).host}`);

const file = new URL("../drizzle/0236_supervisor_lead_lists.sql", import.meta.url);
const migration = fs.readFileSync(file, "utf8");
const hash = createHash("sha256").update(migration).digest("hex");
const WHEN = 1794800300000;
const statements = migration.split(/-->\s*statement-breakpoint\s*/).map((statement) => statement.trim()).filter(Boolean);
const leadsIndex = statements.find((statement) => statement.includes("leads_import_list_idx"));
if (!leadsIndex) throw new Error("Índice leads_import_list_idx não encontrado na 0236.");

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
try {
  const [state] = await sql`select
    to_regclass('public.supervisor_lead_lists') is not null as table_ok,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'leads' and column_name = 'import_list_id') as column_ok,
    exists (select 1 from drizzle.__drizzle_migrations where hash = ${hash}) as recorded`;
  const [leads] = await sql`select count(*)::int as total,
    count(distinct source_metadata->>'importId')::int as imports,
    count(*) filter (where source_metadata->>'importId' is null)::int as without_import
    from leads where source_channel = 'supervisor_import'`;
  console.log(`Antes: tabela ${state.table_ok ? "existe" : "não existe"}, coluna ${state.column_ok ? "existe" : "não existe"}, registro ${state.recorded ? "feito" : "não feito"}.`);
  console.log(`Leads importados pelo supervisor: ${leads.total} em ${leads.imports} importações; sem importId: ${leads.without_import}.`);
  if (!apply) {
    console.log(`SIMULAÇÃO: ${statements.length} instruções preparadas. Nada foi alterado. Use --apply para aplicar.`);
  } else {
    await sql.begin(async (tx) => {
      await tx.unsafe("SET LOCAL lock_timeout = '10s'");
      for (const statement of statements) if (statement !== leadsIndex) await tx.unsafe(statement);
      const [done] = await tx`select 1 from drizzle.__drizzle_migrations where hash = ${hash}`;
      if (!done) await tx`insert into drizzle.__drizzle_migrations (hash, created_at) values (${hash}, ${WHEN})`;
    });
    await sql.unsafe(leadsIndex.replace("CREATE INDEX IF NOT EXISTS", "CREATE INDEX CONCURRENTLY IF NOT EXISTS"));
    const [after] = await sql`select
      (select count(*)::int from supervisor_lead_lists) as lists,
      (select count(*)::int from supervisor_lead_lists where legacy) as legacy,
      (select count(*)::int from leads where source_channel = 'supervisor_import' and import_list_id is not null) as linked,
      (select count(*)::int from leads where source_channel = 'supervisor_import' and import_list_id is null) as unlinked,
      (select i.indisvalid from pg_class c join pg_index i on i.indexrelid = c.oid where c.relname = 'leads_import_list_idx') as index_ok`;
    console.log(`Migration 0236 aplicada: ${after.lists} listas (${after.legacy} de importações anteriores), ${after.linked} leads ligados, ${after.unlinked} sem lista, índice ${after.index_ok ? "válido" : "com problema"}.`);
  }
} finally {
  await sql.end();
}
