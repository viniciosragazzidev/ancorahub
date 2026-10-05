// One-off: contacts who wrote to the 7276 (coex) and got no lead, because the
// message came as "unsupported" (dropped) or they had talked to the number
// before the connection. Creates their leads like the number's intake does:
// FILA TATIANA, origin "Anúncios CA1 - Ancora Corretora", AI off. A contact
// that has a lead by now is skipped. Their messages already in the CRM are
// linked to the new lead.
//   npx tsx scripts/.tmp-recover-coex-leads.mts
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8").split(/\r?\n/);
const get = (k: string) => env.find((l) => l.startsWith(k + "="))?.slice(k.length + 1).replace(/^["']|["']$/g, "") ?? "";
const sql = postgres(get("SUPABASE_DB_URL") || get("DATABASE_URL"), { prepare: false, max: 1 });

const CHANNEL_ID = "425dbb96-2ce6-456e-bc98-81597608b644";
const PHONES = [
  "5524993338228", "5522997192689", "5521973106873", "5521999691326", "5522998319932", "5521990886453",
  "5521992763315", "5521980079254", "5521989051528", "5521998149944", "5521967133496", "5521983493354",
];

await sql.begin(async (tx) => {
  const [setting] = await tx`select value from system_settings where key = ${"channel_lead_intake_" + CHANNEL_ID}`;
  const intake = JSON.parse(setting.value) as { queueId: string; label: string };
  const [queue] = await tx`select id, tenant_id, branch_id, name from lead_queues where id = ${intake.queueId}`;
  // Same intake source as the number's other leads (webhook credential, unit, author).
  const [model] = await tx`select webhook_credential_id, branch_id from leads where tenant_id = ${queue.tenant_id} and source_metadata->>'entry' = 'whatsapp' and webhook_credential_id is not null order by created_at desc limit 1`;
  const [director] = await tx`select user_id from tenant_memberships where tenant_id = ${queue.tenant_id} and role = 'director' and status = 'active' limit 1`;
  const branchId = queue.branch_id ?? model.branch_id;
  let created = 0;
  for (const phone of PHONES) {
    const suffix = phone.slice(-8);
    const [existing] = await tx`select id, nome from leads where tenant_id = ${queue.tenant_id} and deleted_at is null and right(regexp_replace(telefone,'[^0-9]','','g'),8) = ${suffix} limit 1`;
    if (existing) { console.log(`- ${phone}: já tem lead (${existing.nome}), pulado`); continue; }
    const [firstMessage] = await tx`select min(sent_at) at from whatsapp_messages where communication_channel_id = ${CHANNEL_ID} and right(regexp_replace(phone,'[^0-9]','','g'),8) = ${suffix}`;
    const leadId = randomUUID();
    const now = new Date();
    await tx`insert into leads (id, tenant_id, branch_id, queue_id, nome, telefone, email, qualification_status, origem, distribution_origin, status, distribution_status, consentimento_lgpd, webhook_credential_id, external_id, source_channel, source_metadata, captured_at, created_at)
      values (${leadId}, ${queue.tenant_id}, ${branchId}, ${queue.id}, ${"Contato WhatsApp " + phone.slice(-4)}, ${"+" + phone}, ${""}, 'ia_disabled', 'webhook', 'landing-page', 'new', 'queued', false, ${model.webhook_credential_id}, ${"wa:recovered:" + phone},
        'meta_lead_ads', ${tx.json({ entry: "whatsapp", adsLabel: intake.label, withoutReferral: true, recovered: true, tipoPlanoStatus: "not_provided" })}, ${firstMessage?.at ?? now}, ${now})`;
    await tx`insert into lead_distribution_events (id, tenant_id, lead_id, to_branch_id, to_queue_id, action, source, strategy, reason, actor_id, created_at)
      values (${randomUUID()}, ${queue.tenant_id}, ${leadId}, ${branchId}, ${queue.id}, 'queued', 'webhook', 'outbox', 'Lead recuperado: a mensagem do contato no WhatsApp 7276 não tinha virado lead.', ${director.user_id}, ${now})`;
    await tx`insert into lead_interactions (id, lead_id, user_id, tipo, conteudo, created_at)
      values (${randomUUID()}, ${leadId}, ${director.user_id}, 'note', ${"📝 Lead recuperado: este contato escreveu no WhatsApp 7276 (anúncios), mas a mensagem chegou como \"não suportada\" pela Meta ou foi ignorada como contato antigo, e não virou lead. O conteúdo está no celular do número."}, ${now})`;
    await tx`update whatsapp_messages set lead_id = ${leadId} where tenant_id = ${queue.tenant_id} and lead_id is null and right(regexp_replace(phone,'[^0-9]','','g'),8) = ${suffix}`;
    console.log(`+ ${phone}: lead criado na ${queue.name}`);
    created += 1;
  }
  console.log(`\n${created} lead(s) criados.`);
});
await sql.end();
