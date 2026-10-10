// node scripts/apply-0193-engagement-journey.mjs [--apply]
// Dry run is offline. Only --apply opens a database connection.
import fs from "node:fs";
import postgres from "postgres";

const apply = process.argv.includes("--apply");
const env = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
const configured = (key) => process.env[key] ?? env.match(new RegExp(`^${key}=["']?([^"'\\r\\n]+)`, "m"))?.[1];
const url = configured("SUPABASE_DB_URL") ?? configured("DATABASE_URL");
if (!url) throw new Error("Configure SUPABASE_DB_URL ou DATABASE_URL antes de continuar.");
console.log(`Banco: ${new URL(url).host}`);
const migration = fs.readFileSync("drizzle/0193_engagement_journey.sql", "utf8");
const statements = migration.split(/-->\s*statement-breakpoint\s*/).map((statement) => statement.trim()).filter(Boolean);
if (!apply) {
  console.log(`SIMULAÇÃO: ${statements.length} instruções preparadas. Nenhuma conexão ou alteração no banco. Use --apply para aplicar.`);
} else {
  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
  const tables = ["engagement_missions", "engagement_mission_progress", "engagement_achievements", "engagement_celebrations"];
  const showTables = async (phase) => {
    for (const table of tables) {
      const [row] = await sql`select to_regclass(${`public.${table}`}) is not null as exists`;
      console.log(`${table} ${phase}: ${row?.exists ? "existe" : "não existe"}.`);
    }
  };
  try {
    await showTables("antes");
    // Build the index of the existing ledger without blocking its writers.
    const liveIndexes = statements.filter((statement) => ['ON "engagement_point_events"', 'ON "lead_offers"', 'ON "lead_interactions"'].some((name) => statement.includes(name)));
    await sql.unsafe("SET lock_timeout = '10s'");
    for (const statement of liveIndexes) {
      const name = statement.match(/CREATE INDEX IF NOT EXISTS "([a-z0-9_]+)"/)?.[1];
      if (!name) throw new Error("Nome de índice inválido na migration 0193.");
      const [state] = await sql`select i.indisvalid as valid from pg_class c join pg_index i on i.indexrelid=c.oid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${name}`;
      console.log(`${name}: ${state ? state.valid ? "existe" : "inválido" : "não existe"}.`);
      if (state?.valid) continue;
      // An interrupted concurrent build can leave an invalid index with this name.
      if (state) await sql.unsafe(`DROP INDEX CONCURRENTLY IF EXISTS "${name}"`);
      await sql.unsafe(statement.replace("CREATE INDEX IF NOT EXISTS", "CREATE INDEX CONCURRENTLY IF NOT EXISTS"));
    }
    await sql.begin(async (tx) => {
      for (const statement of statements) if (!liveIndexes.includes(statement)) await tx.unsafe(statement);
    });
    console.log("Migration 0193 aplicada.");
    await showTables("depois");
  } finally {
    await sql.end();
  }
}
