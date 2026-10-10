// Applies migration 0191: stores approval requests for broker team transfers.
// Simulation by default; --apply writes. Run from the repo root:
//   node scripts/apply-0191-supervisor-transfer-requests.mjs [--apply]
import postgres from "postgres";
import fs from "node:fs";

const apply = process.argv.includes("--apply");
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");
console.log(`Banco: ${new URL(url.replace(/^postgres(ql)?:/, "http:")).host}`);

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
const exists = async () => {
  const [row] = await sql`select to_regclass('public.supervisor_transfer_requests') is not null as exists`;
  return Boolean(row?.exists);
};

try {
  const before = await exists();
  console.log(`Tabela supervisor_transfer_requests antes: ${before ? "existe" : "não existe"}.`);

  if (apply) {
    const migration = fs.readFileSync("drizzle/0191_supervisor_transfer_requests.sql", "utf8");
    const statements = migration.split(/-->\s*statement-breakpoint\s*/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await sql.unsafe(statement);
    console.log("Migration 0191 aplicada.");
  } else {
    console.log("SIMULAÇÃO: nenhuma alteração foi feita. Use --apply para aplicar a migration.");
  }

  const after = await exists();
  console.log(`Tabela supervisor_transfer_requests depois: ${after ? "existe" : "não existe"}.`);
} finally {
  await sql.end();
}
