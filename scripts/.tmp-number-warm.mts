// One-off: the company WhatsApp (WAHA) number has been used with the brokers
// for about a year, so the 7-day warm-up (15 reminders/hour) does not apply.
// Moves its "connected at" a year back; the regular limits stay (40/hour,
// 250/day for reminders; urgent notices keep only the 3s spacing).
//   npx tsx scripts/.tmp-number-warm.mts
import postgres from "postgres";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8").split(/\r?\n/);
const get = (k: string) => env.find((l) => l.startsWith(k + "="))?.slice(k.length + 1).replace(/^["']|["']$/g, "") ?? "";
const sql = postgres(get("SUPABASE_DB_URL") || get("DATABASE_URL"), { prepare: false, max: 1 });
const rows = await sql`
  update waha_numbers set connected_at = now() - interval '365 days', updated_at = now()
  where scope = 'tenant' and display_phone_number like '%70034925'
  returning display_phone_number, connected_at`;
console.log(rows.length ? `Número ${rows[0].display_phone_number}: aquecimento desligado (conectado desde ${rows[0].connected_at.toISOString().slice(0, 10)}).` : "Número da empresa não encontrado.");
await sql.end();
