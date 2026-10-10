// Applies migration 0189: adds 'supervisor' to the tenant_role enum (it was
// only in the code). ADD VALUE runs outside a transaction; it does not touch rows.
// Simulation by default; --apply writes. Run from the repo root:
//   node scripts/apply-0189-tenant-role-supervisor.mjs [--apply]
import postgres from "postgres";
import fs from "node:fs";

const apply = process.argv.includes("--apply");
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");
console.log(`Banco: ${new URL(url.replace(/^postgres(ql)?:/, "http:")).host}`);

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
const values = async () => (await sql`select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'tenant_role' order by e.enumsortorder`).map((row) => row.enumlabel);
try {
  const before = await values();
  console.log(`tenant_role hoje: ${before.join(", ")}`);
  if (before.includes("supervisor")) { console.log("Já tem 'supervisor'. Nada a fazer."); process.exit(0); }
  if (!apply) { console.log("SIMULAÇÃO: rodaria ALTER TYPE tenant_role ADD VALUE 'supervisor' (use --apply)."); process.exit(0); }
  await sql.unsafe(`ALTER TYPE "public"."tenant_role" ADD VALUE IF NOT EXISTS 'supervisor' BEFORE 'broker'`);
  console.log(`Pronto. tenant_role agora: ${(await values()).join(", ")}`);
} finally {
  await sql.end();
}
