// Read-only, no personal data (id prefixes only): why a plantão presence invite did (not) go out on WhatsApp today.
//   node scripts/inspect-duty-presence.mjs
import postgres from "postgres";
import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado no .env.local.");
const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
try {
  const flags = await sql`select key, value from system_settings where key in ('feature_duty_presence_confirmation_enabled')`;
  console.log("Flag confirmação de presença:", flags.map((row) => `${row.key}=${row.value}`).join(", ") || "não gravada (padrão false)");
  const confirmations = await sql`
    select left(c.id::text, 8) as id, s.name as plantao, s.attendance_mode as modo, c.shift_starts_at, c.status, c.notification_status, c.notification_error_code,
           c.photo_storage_key is not null as foto, c.release_note is not null as com_motivo, c.created_at, c.updated_at
    from duty_presence_confirmations c join unit_duty_schedules s on s.id = c.schedule_id
    where c.created_at > now() - interval '24 hours' or c.shift_ends_at > now()
    order by c.shift_starts_at desc limit 20`;
  console.log(confirmations.length ? "Confirmações (24h / em aberto):" : "Nenhuma confirmação criada nas últimas 24h.");
  for (const row of confirmations) console.log(`- ${row.id} · ${row.plantao} (${row.modo}) · início ${row.shift_starts_at.toISOString()} · ${row.status} · envio ${row.notification_status}${row.notification_error_code ? ` (${row.notification_error_code})` : ""}${row.foto ? " · com foto" : ""}${row.com_motivo ? " · liberado com motivo" : ""} · criada ${row.created_at.toISOString()}`);
  const outbound = await sql`
    select left(id, 8) as id, status, template_name, provider_error_code, left(provider_error_message, 120) as error, created_at, updated_at
    from whatsapp_outbound_messages where purpose = 'dutyPresenceConfirmation' and created_at > now() - interval '48 hours'
    order by created_at desc limit 15`;
  console.log(outbound.length ? "Mensagens de convite na fila do WhatsApp (48h):" : "Nenhuma mensagem de convite na fila do WhatsApp nas últimas 48h.");
  for (const row of outbound) console.log(`- ${row.id} · ${row.status} · ${row.template_name ?? "-"}${row.provider_error_code ? ` · erro ${row.provider_error_code}: ${row.error}` : ""} · ${row.created_at.toISOString()}`);
  const schedules = await sql`
    select s.name, s.attendance_mode as modo, s.starts_at, s.ends_at, s.day_of_week
    from unit_duty_schedules s where s.status = 'active' order by s.name limit 30`;
  console.log("Plantões ativos:");
  for (const row of schedules) console.log(`- ${row.name} · ${row.modo} · dia ${row.day_of_week} · ${row.starts_at}-${row.ends_at}`);
} finally {
  await sql.end();
}
