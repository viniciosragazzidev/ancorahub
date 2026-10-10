// Applies migration 0192: stores supervisor team profiles and broker invitations.
// Simulation by default; --apply writes. Run from the repo root:
//   node scripts/apply-0192-supervisor-teams.mjs [--apply]
import postgres from "postgres";
import fs from "node:fs";

const apply = process.argv.includes("--apply");
const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");
console.log(`Banco: ${new URL(url.replace(/^postgres(ql)?:/, "http:")).host}`);

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
const exists = async (table) => {
  const [row] = await sql`select to_regclass(${`public.${table}`}) is not null as exists`;
  return Boolean(row?.exists);
};

try {
  const before = {
    teams: await exists("supervisor_teams"),
    invites: await exists("supervisor_team_invites"),
  };
  console.log(`Tabela supervisor_teams antes: ${before.teams ? "existe" : "não existe"}.`);
  console.log(`Tabela supervisor_team_invites antes: ${before.invites ? "existe" : "não existe"}.`);

  if (apply) {
    const migration = fs.readFileSync("drizzle/0192_supervisor_teams.sql", "utf8");
    const statements = migration.split(/-->\s*statement-breakpoint\s*/).map((statement) => statement.trim()).filter(Boolean);
    for (const statement of statements) await sql.unsafe(statement);
    console.log("Migration 0192 aplicada.");
  } else {
    console.log("SIMULAÇÃO: nenhuma alteração foi feita. Use --apply para aplicar a migration.");
  }

  console.log(`Tabela supervisor_teams depois: ${(await exists("supervisor_teams")) ? "existe" : "não existe"}.`);
  console.log(`Tabela supervisor_team_invites depois: ${(await exists("supervisor_team_invites")) ? "existe" : "não existe"}.`);
} finally {
  await sql.end();
}
