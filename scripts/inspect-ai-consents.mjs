// Read-only, no personal data printed (user id prefix only): checks that ai_consents (0194) exists and lists the latest AI consent decisions.
//   node scripts/inspect-ai-consents.mjs
import postgres from "postgres";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");
console.log(`Banco: ${new URL(url.replace(/^postgres(ql)?:/, "http:")).host} (somente leitura)`);
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
try {
  const [table] = await sql`select to_regclass('public.ai_consents') as name`;
  if (!table.name) {
    console.log("A tabela ai_consents NÃO existe: aplicar drizzle/0194_ai_consents.sql.");
  } else {
    const rows = await sql`
      select c.created_at, c.decision, c.terms_version, left(c.user_id, 6) as who
      from ai_consents c
      order by c.created_at desc limit 10`;
    console.log(`Tabela ai_consents existe. ${rows.length ? "Últimas decisões:" : "Nenhuma decisão gravada ainda."}`);
    for (const row of rows) console.log(`- ${row.created_at.toISOString()} · usuário ${row.who}… · ${row.decision} · termo ${row.terms_version}`);
  }
  // Why the assistants' AI failed: the latest gateway attempts (no message content is logged).
  const attempts = await sql`
    select created_at, provider as purpose, model_used, status, left(error_message, 40) as error_message, latency_ms
    from ai_attendance_logs where provider like 'broker_assistant:%'
    order by created_at desc limit 12`;
  console.log(attempts.length ? "Últimas tentativas da IA dos assistentes:" : "Nenhuma tentativa da IA dos assistentes registrada.");
  for (const row of attempts) console.log(`- ${row.created_at.toISOString()} · ${row.purpose} · ${row.model_used} · ${row.status}${row.error_message ? ` · ${row.error_message}` : ""} · ${row.latency_ms}ms`);
  // Which provider keys exist in system settings (only yes/no; never the value).
  const keys = await sql`select key, length(coalesce(value, '')) > 0 as filled from system_settings where key like 'ai\\_%\\_api\\_key'`;
  console.log(`Chaves no Super-admin: ${keys.map((row) => `${row.key}=${row.filled ? "sim" : "vazia"}`).join(", ") || "nenhuma"} (as do Coolify não aparecem aqui)`);
} finally {
  await sql.end();
}
