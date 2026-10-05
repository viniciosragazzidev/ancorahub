// One-off, run by the user: the leads marked "disqualified" only because the
// AI's first WhatsApp message was not delivered (last 7 days, no broker yet)
// become "Sem contato no WhatsApp" and go back to the distribution queue.
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8").split(/\r?\n/);
const get = (k: string) => env.find((l) => l.startsWith(k + "="))?.slice(k.length + 1).replace(/^["']|["']$/g, "") ?? "";
const sql = postgres(get("SUPABASE_DB_URL") || get("DATABASE_URL"), { prepare: false, max: 1 });

const leads = await sql`
  select l.id, l.nome, l.created_at
  from leads l
  where l.qualification_status = 'disqualified'
    and l.created_at > now() - interval '7 days'
    and l.deleted_at is null and l.archived_at is null and l.distribution_removed_at is null
    and l.corretor_id is null
    and exists (select 1 from audit_logs a where a.entidade_id = l.id and a.acao like 'lead.initial_message_failed_distributed%')
  order by l.created_at`;
console.log(`Leads to release: ${leads.length}`);
for (const l of leads) console.log(` ${l.created_at.toISOString()} | ${l.nome}`);

await sql.begin(async (tx) => {
  for (const l of leads) {
    const [note] = await tx`select user_id from lead_interactions where lead_id = ${l.id} and conteudo like '%Falha no envio da mensagem via WhatsApp%' limit 1`;
    await tx`update leads set qualification_status = 'no_whatsapp_contact', distribution_status = 'queued', updated_at = now()
             where id = ${l.id} and qualification_status = 'disqualified' and corretor_id is null`;
    if (note?.user_id) {
      await tx`insert into lead_interactions (id, lead_id, user_id, tipo, conteudo, created_at)
               values (${randomUUID()}, ${l.id}, ${note.user_id}, 'note',
                       ${"Correção: o lead não foi desqualificado — a primeira mensagem do atendimento virtual não chegou ao WhatsApp dele. Status alterado para \"Sem contato no WhatsApp\" e lead devolvido à distribuição para um corretor entrar em contato."}, now())`;
      await tx`insert into audit_logs (id, user_id, entidade, entidade_id, acao, created_at)
               values (${randomUUID()}, ${note.user_id}, 'lead', ${l.id}, 'lead.undelivered_first_message_released', now())`;
    }
  }
});
const after = leads.length ? await sql`select qualification_status, distribution_status, count(*)::int n from leads where id in ${sql(leads.map((l) => l.id))} group by 1, 2` : [];
console.log("after:", after);
await sql.end();
