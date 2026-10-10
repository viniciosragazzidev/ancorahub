// Applies migration 0188 (Central de relacionamento + jornada do corretor).
// 1) Builds the 5 collector/ranking indexes on existing tables with CREATE INDEX
//    CONCURRENTLY (production keeps writing while they build).
// 2) Runs the statements of drizzle/0188_broker_engagement_relationship.sql
//    (all IF NOT EXISTS, so the indexes from step 1 are skipped).
// Never run `npm run db:migrate` from Windows (CRLF changes the file hashes).
// Simulation by default; --apply writes. Run from the repo root:
//   node scripts/apply-0188-engagement-relationship.mjs [--apply]
import postgres from "postgres";
import fs from "node:fs";

const apply = process.argv.includes("--apply");
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");

const INDEXES = [
  { name: "lead_offers_tenant_offered_at_idx", table: "lead_offers", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_offers_tenant_offered_at_idx ON lead_offers (tenant_id, offered_at)" },
  { name: "lead_offers_tenant_accepted_at_partial_idx", table: "lead_offers", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_offers_tenant_accepted_at_partial_idx ON lead_offers (tenant_id, accepted_at) WHERE accepted_at IS NOT NULL" },
  { name: "lead_tasks_tenant_completed_at_partial_idx", table: "lead_tasks", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_tasks_tenant_completed_at_partial_idx ON lead_tasks (tenant_id, completed_at) WHERE completed_at IS NOT NULL" },
  { name: "lead_interactions_note_created_idx", table: "lead_interactions", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_interactions_note_created_idx ON lead_interactions (created_at) WHERE tipo = 'note'" },
  { name: "duty_presence_tenant_confirmed_at_partial_idx", table: "duty_presence_confirmations", sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS duty_presence_tenant_confirmed_at_partial_idx ON duty_presence_confirmations (tenant_id, confirmed_at) WHERE confirmed_at IS NOT NULL" },
];
const NEW_TABLES = ["engagement_point_events", "engagement_watermarks", "engagement_settings", "relationship_broadcasts", "relationship_broadcast_recipients"];

// One connection, no transaction (CONCURRENTLY cannot run inside one).
console.log(`Banco: ${new URL(url.replace(/^postgres(ql)?:/, "http:")).host}`);
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });

async function indexState(name) {
  const [row] = await sql`select i.indisvalid as valid from pg_class c join pg_index i on i.indexrelid = c.oid where c.relname = ${name}`;
  return row ? (row.valid ? "existe" : "INVÁLIDO") : "não existe";
}

try {
  console.log(apply ? "APLICANDO 0188" : "SIMULAÇÃO (nada é criado; use --apply)");

  console.log("\n1) Índices em tabelas existentes (CONCURRENTLY)");
  for (const index of INDEXES) {
    const before = await indexState(index.name);
    const [{ rows }] = await sql`select reltuples::bigint as rows from pg_class where relname = ${index.table}`;
    console.log(`\n${index.name} (${index.table}, ~${rows} linhas): ${before}`);
    if (before === "existe") { console.log("  já existe, nada a fazer"); continue; }
    if (before === "INVÁLIDO") {
      console.log("  sobrou de uma tentativa anterior que falhou: vou recriar");
      if (apply) await sql.unsafe(`DROP INDEX CONCURRENTLY IF EXISTS ${index.name}`);
    }
    if (!apply) continue;
    await sql.unsafe("SET statement_timeout = 0");
    await sql.unsafe("SET lock_timeout = '10s'");
    const started = Date.now();
    await sql.unsafe(index.sql);
    console.log(`  criado em ${((Date.now() - started) / 1000).toFixed(1)}s · agora: ${await indexState(index.name)}`);
  }

  console.log("\n2) Tabelas novas");
  for (const table of NEW_TABLES) {
    const [row] = await sql`select to_regclass(${`public.${table}`}) as id`;
    console.log(`  ${table}: ${row.id ? "existe" : "não existe"}`);
  }
  if (apply) {
    await sql.unsafe("SET lock_timeout = '10s'");
    const file = fs.readFileSync("drizzle/0188_broker_engagement_relationship.sql", "utf8");
    const statements = file.split("--> statement-breakpoint").map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await sql.unsafe(statement);
    console.log(`  ${statements.length} comandos aplicados`);
    for (const table of NEW_TABLES) {
      const [row] = await sql`select to_regclass(${`public.${table}`}) as id`;
      console.log(`  ${table}: ${row.id ? "OK" : "FALTANDO"}`);
    }
  }
} finally {
  await sql.end();
}
