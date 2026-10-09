// Applies migration 0186 (2 performance indexes of the broker workspace) with
// CREATE INDEX CONCURRENTLY: production keeps writing leads while they build.
// Never run `npm run db:migrate` from Windows (CRLF changes the file hashes).
// Simulation by default; --apply creates. Run from the repo root:
//   node scripts/apply-0186-indexes-concurrently.mjs [--apply]
import postgres from "postgres";
import fs from "node:fs";

const apply = process.argv.includes("--apply");
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");

const INDEXES = [
  {
    name: "lead_offers_broker_accepted_at_partial_idx",
    table: "lead_offers",
    sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS lead_offers_broker_accepted_at_partial_idx ON lead_offers (broker_id, accepted_at) WHERE accepted_at IS NOT NULL",
  },
  {
    name: "leads_corretor_assigned_at_live_idx",
    table: "leads",
    sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS leads_corretor_assigned_at_live_idx ON leads (corretor_id, assigned_at) WHERE deleted_at IS NULL",
  },
];

// One connection, no transaction (CONCURRENTLY cannot run inside one).
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });

async function state(name) {
  const [row] = await sql`
    select i.indisvalid as valid from pg_class c join pg_index i on i.indexrelid = c.oid where c.relname = ${name}`;
  return row ? (row.valid ? "existe" : "INVÁLIDO") : "não existe";
}

try {
  console.log(apply ? "APLICANDO (CONCURRENTLY, sem travar gravações)" : "SIMULAÇÃO (nada é criado; use --apply)");
  for (const index of INDEXES) {
    const before = await state(index.name);
    const [{ rows }] = await sql`select reltuples::bigint as rows from pg_class where relname = ${index.table}`;
    console.log(`\n${index.name} (${index.table}, ~${rows} linhas): ${before}`);
    if (before === "existe") { console.log("  já existe, nada a fazer"); continue; }
    if (before === "INVÁLIDO") {
      // A CONCURRENTLY build that failed leaves an invalid index: drop it and rebuild.
      console.log("  sobrou de uma tentativa anterior que falhou: vou recriar");
      if (apply) await sql.unsafe(`DROP INDEX CONCURRENTLY IF EXISTS ${index.name}`);
    }
    console.log(`  ${index.sql}`);
    if (!apply) continue;
    // No statement timeout for the build; give up quickly if a lock is held, so it never blocks production.
    await sql.unsafe("SET statement_timeout = 0");
    await sql.unsafe("SET lock_timeout = '10s'");
    const started = Date.now();
    await sql.unsafe(index.sql);
    console.log(`  criado em ${((Date.now() - started) / 1000).toFixed(1)}s · agora: ${await state(index.name)}`);
  }
} finally {
  await sql.end();
}
