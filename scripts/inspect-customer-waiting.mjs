// Read-only diagnosis for "cliente aguardando o corretor" (plan 2026-11-04). Writes nothing.
//   node scripts/inspect-customer-waiting.mjs <telefone do cliente> [--env <caminho do .env.local>]
// Part 1: how the given lead became "Em Atendimento" (lead fields, distribution events,
// assignment attempts, audit, interactions and messages after the assignment).
// Part 2: active leads whose customer's last message is unanswered for more than 2h.
import postgres from "postgres";
import fs from "node:fs";

const phone = process.argv[2]?.replace(/\D/g, "");
if (!phone) throw new Error("Informe o telefone: node scripts/inspect-customer-waiting.mjs <telefone>");
const envIndex = process.argv.indexOf("--env");
const env = fs.readFileSync(envIndex > 0 ? process.argv[envIndex + 1] : ".env.local", "utf8");
const url = env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1] ?? env.match(/^DATABASE_URL="?([^"\n]+)"?/m)?.[1];
if (!url) throw new Error("SUPABASE_DB_URL ou DATABASE_URL não encontrado.");
console.log(`Banco: ${new URL(url.replace(/^postgres(ql)?:/, "http:")).host} (somente leitura)`);

const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });
const show = (title, rows) => { console.log(`\n## ${title} (${rows.length})`); console.table(rows); };
const ACTIVE = ["distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"];

try {
  const leads = await sql`
    select l.id, l.tenant_id, l.nome, l.status, l.distribution_status, l.assignment_source, l.assignment_strategy,
      l.assigned_at, l.first_contact_at, l.service_started_at, u.name as service_started_by, l.stage_entered_at,
      l.qualification_state, l.redistribution_count, c.name as corretor
    from leads l left join "user" c on c.id = l.corretor_id left join "user" u on u.id = l.service_started_by
    where regexp_replace(l.telefone, '\\D', '', 'g') like ${"%" + phone.slice(-11)} and l.deleted_at is null
    order by l.created_at desc limit 3`;
  show("Lead", leads);
  for (const lead of leads.slice(0, 1)) {
    show("Eventos de distribuição", await sql`
      select e.created_at, e.action, e.source, e.strategy, e.reason, p.name as de, n.name as para, e.metadata
      from lead_distribution_events e left join "user" p on p.id = e.previous_owner_id left join "user" n on n.id = e.new_owner_id
      where e.lead_id = ${lead.id} order by e.created_at`);
    show("Tentativas de atribuição", await sql`
      select a.sequence, a.assigned_at, a.first_contact_at, a.feedback_due_at, a.status, a.released_at, a.release_reason, b.name as corretor
      from lead_assignment_attempts a left join "user" b on b.id = a.broker_id where a.lead_id = ${lead.id} order by a.sequence`);
    show("Auditoria", await sql`
      select a.created_at, a.acao, u.name as autor, left(a.metadata::text, 160) as dados
      from audit_logs a left join "user" u on u.id = a.user_id
      where a.entidade = 'lead' and a.entidade_id = ${lead.id} order by a.created_at`.catch((error) => [{ erro: error.message }]));
    show("Interações", await sql`
      select i.created_at, i.tipo, u.name as autor, left(i.conteudo, 120) as conteudo
      from lead_interactions i left join "user" u on u.id = i.user_id where i.lead_id = ${lead.id} order by i.created_at`);
    show("Mensagens", await sql`
      select sent_at, direction, sender_role, provider, left(body, 70) as texto
      from whatsapp_messages where lead_id = ${lead.id} order by sent_at`);
  }

  // Part 2: per active lead with a broker, the customer's last message ('incoming') vs the last message
  // a person sent ('outgoing', official number or the broker's WAHA). The AI writes 'outbound'.
  const waiting = await sql`
    with last_in as (
      select lead_id, max(sent_at) as at from whatsapp_messages where direction = 'incoming' group by lead_id
    ), last_human_out as (
      select lead_id, max(sent_at) as at from whatsapp_messages
      where direction = 'outgoing' group by lead_id
    )
    select t.name as empresa, l.status, count(*)::int as leads,
      count(*) filter (where i.at < now() - interval '24 hours')::int as mais_de_24h,
      count(*) filter (where i.at > now() - interval '24 hours')::int as janela_meta_aberta,
      count(*) filter (where o.at is null or o.at < l.assigned_at)::int as corretor_nunca_escreveu
    from leads l
    join tenants t on t.id = l.tenant_id
    join last_in i on i.lead_id = l.id
    left join last_human_out o on o.lead_id = l.id
    where l.deleted_at is null and l.archived_at is null and l.corretor_id is not null
      and l.status = any(${ACTIVE}) and i.at > coalesce(l.assigned_at, 'epoch') and (o.at is null or o.at < i.at)
      and i.at < now() - interval '2 hours' and i.at > now() - interval '30 days'
    group by t.name, l.status order by t.name, leads desc`;
  show("Clientes esperando o corretor há mais de 2h (últimos 30 dias de mensagem)", waiting);
  show("Como os leads 'Em Atendimento' sem mensagem humana chegaram lá", await sql`
    with human_out as (
      select distinct lead_id from whatsapp_messages
      where direction = 'outgoing'
    )
    select l.assignment_source, (l.service_started_at is not null) as service_started, (l.first_contact_at is not null) as first_contact,
      count(*)::int as leads
    from leads l left join human_out h on h.lead_id = l.id
    where l.deleted_at is null and l.archived_at is null and l.status = 'in_contact' and h.lead_id is null
      and l.assigned_at > now() - interval '30 days'
    group by 1, 2, 3 order by leads desc`);
  // Part 3: a broker who sends nothing through the CRM (official number or WAHA) in 30 days
  // probably talks from a phone the CRM does not see: their "waiting" leads are not reliable.
  show("Esperando há mais de 2h, pelo uso do canal do CRM pelo corretor", await sql`
    with li as (select lead_id, max(sent_at) as at from whatsapp_messages where direction = 'incoming' group by lead_id),
    lo as (select lead_id, max(sent_at) as at from whatsapp_messages where direction = 'outgoing' group by lead_id),
    uses as (
      select l.corretor_id from leads l join whatsapp_messages w on w.lead_id = l.id
      where w.direction = 'outgoing' and w.sent_at > now() - interval '30 days' group by 1
    ),
    waiting as (
      select l.id, l.corretor_id, li.at from leads l join li on li.lead_id = l.id left join lo on lo.lead_id = l.id
      where l.deleted_at is null and l.archived_at is null and l.corretor_id is not null and l.status = any(${ACTIVE})
        and li.at > coalesce(l.assigned_at, 'epoch') and (lo.at is null or lo.at < li.at)
        and li.at < now() - interval '2 hours' and li.at > now() - interval '30 days'
    )
    select (u.corretor_id is not null) as corretor_usa_canal_do_crm, count(*)::int as leads,
      count(distinct w.corretor_id)::int as corretores, count(*) filter (where w.at > now() - interval '7 days')::int as ultimos_7_dias
    from waiting w left join uses u on u.corretor_id = w.corretor_id group by 1`);
} finally {
  await sql.end();
}
