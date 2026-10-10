// Turns an existing login into a platform administrator (access to /super-dev).
// Simulation by default; --apply writes. Run from the repo root:
//   node scripts/grant-platform-admin.mjs <email> [--apply]
import postgres from "postgres";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const apply = process.argv.includes("--apply");
const email = process.argv.slice(2).find((arg) => !arg.startsWith("--"))?.trim().toLowerCase();
if (!email || !email.includes("@")) throw new Error("Informe o e-mail: node scripts/grant-platform-admin.mjs <email> [--apply]");

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");

console.log(`Banco: ${new URL(url.replace(/^postgres(ql)?:/, "http:")).host}`);
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
try {
  console.log(apply ? "APLICANDO" : "SIMULAÇÃO (nada é gravado; use --apply)");
  const users = await sql`select id, name, email, active, is_platform_admin from "user" where lower(email) = ${email}`;
  if (users.length !== 1) throw new Error(`Esperava 1 usuário com ${email}, achei ${users.length}.`);
  const [user] = users;
  console.log(`Usuário: ${user.name} <${user.email}> · ativo: ${user.active} · superdev hoje: ${user.is_platform_admin}`);
  if (!user.active) console.log("ATENÇÃO: o usuário está inativo; a área /super-dev exige usuário ativo.");
  if (user.is_platform_admin) { console.log("Já é superdev. Nada a fazer."); process.exit(0); }
  if (!apply) { console.log("Rodaria: is_platform_admin = true"); process.exit(0); }

  await sql.begin(async (tx) => {
    await tx`update "user" set is_platform_admin = true, updated_at = now() where id = ${user.id}`;
    await tx`insert into audit_logs (id, user_id, entidade, entidade_id, acao, created_at) values (${randomUUID()}, ${user.id}, 'user', ${user.id}, 'virou superdev (is_platform_admin) via script', now())`;
  });
  const [after] = await sql`select is_platform_admin from "user" where id = ${user.id}`;
  console.log(`Pronto. superdev agora: ${after.is_platform_admin}. Saia e entre de novo para valer.`);
} finally {
  await sql.end();
}
