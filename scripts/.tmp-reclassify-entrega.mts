// One-off: leads marked "Sem contato no WhatsApp" (first message not delivered)
// get the current rule: Meta blocked (130472, 131049) -> "Envio bloqueado pela
// Meta"; any other undelivered -> disqualified. Only the qualification status changes.
import postgres from "postgres";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8").split(/\r?\n/);
const get = (k: string) => env.find((l) => l.startsWith(k + "="))?.slice(k.length + 1).replace(/^["']|["']$/g, "") ?? "";
const sql = postgres(get("SUPABASE_DB_URL") || get("DATABASE_URL"), { prepare: false, max: 1 });
const blocked = await sql`
  update leads l set qualification_status = 'meta_blocked', updated_at = now()
  where l.qualification_status = 'no_whatsapp_contact'
    and exists (
      select 1 from whatsapp_messages m
      join whatsapp_outbound_messages o on o.provider_message_id = m.message_id and o.tenant_id = m.tenant_id
      where m.lead_id = l.id and m.tenant_id = l.tenant_id and o.provider_error_code in ('130472', '131049')
    )
  returning l.nome`;
console.log(`${blocked.length} -> Envio bloqueado pela Meta:`, blocked.map((r) => r.nome).join(", "));
const disqualified = await sql`
  update leads set qualification_status = 'disqualified', updated_at = now()
  where qualification_status = 'no_whatsapp_contact'
  returning nome`;
console.log(`${disqualified.length} -> Desqualificado:`, disqualified.map((r) => r.nome).join(", "));
await sql.end();
