// Leads de WhatsApp de uma fila que chegaram como quente/morno sem o cliente
// responder passam a frio (regra do Vinicios, 13/10/2026: só é quente ou morno
// quem respondeu). "Respondeu" = mandou qualquer mensagem depois da primeira
// (a que abriu a conversa). Padrão: só mostra o que mudaria.
//
//   node scripts/fix-whatsapp-no-reply-temperature.mjs "FILA TATIANA"            -> prévia
//   node scripts/fix-whatsapp-no-reply-temperature.mjs "FILA TATIANA" --apply    -> grava
//   node scripts/fix-whatsapp-no-reply-temperature.mjs --restore <backup.json>   -> desfaz
//
// Ao gravar, salva antes um backup (id e temperatura antiga) em scripts/backups/
// e registra a mudança em lead_interactions de cada lead. Leads já em cotação,
// negociação ou venda ficam como estão.
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const queueName = process.argv[2];
const apply = process.argv.includes("--apply");
const restoreIndex = process.argv.indexOf("--restore");
const NOTE = "Temperatura ajustada de %para frio: o cliente do WhatsApp não respondeu a qualificação.";

if (restoreIndex > -1) {
  // Undo: back to the temperature in the backup (only leads still cold) and remove the notes.
  const backup = JSON.parse(fs.readFileSync(process.argv[restoreIndex + 1], "utf8"));
  const envText = fs.readFileSync(".env.local", "utf8");
  const db = postgres(envText.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1], { prepare: false, max: 1 });
  try {
    await db.begin(async (tx) => {
      for (const entry of backup) {
        await tx`update leads set qualification_status = ${entry.qualification_status}, updated_at = now() where id = ${entry.id} and qualification_status = 'cold'`;
      }
      await tx`delete from lead_interactions where lead_id in ${tx(backup.map((entry) => entry.id))} and tipo = 'system_alert' and conteudo like ${NOTE}`;
    });
    console.log(`Restaurados ${backup.length} leads a partir de ${process.argv[restoreIndex + 1]}.`);
  } finally {
    await db.end();
  }
  process.exit(0);
}
if (!queueName) {
  console.error('Informe o nome da fila, ex.: node scripts/fix-whatsapp-no-reply-temperature.mjs "FILA TATIANA"');
  process.exit(1);
}

const env = fs.readFileSync(".env.local", "utf8");
const sql = postgres(env.match(/^SUPABASE_DB_URL="?([^"\n]+)"?/m)?.[1], { prepare: false, max: 1 });

try {
  const queues = await sql`select id, tenant_id, name from lead_queues where name = ${queueName} and deleted_at is null`;
  if (queues.length !== 1) throw new Error(`Fila "${queueName}" encontrada ${queues.length} vezes; esperado 1.`);
  const queue = queues[0];
  const [author] = await sql`select u.id from "user" u join tenant_memberships m on m.user_id = u.id and m.tenant_id = ${queue.tenant_id} where u.name = 'Vinicios Ragazzi' and m.role = 'director' limit 1`;
  if (!author) throw new Error("Autor (Vinicios Ragazzi, diretor) não encontrado.");

  const leads = await sql`
    select l.id, l.nome, l.qualification_status, l.status, l.corretor_id is not null as com_corretor, l.created_at
    from leads l
    where l.tenant_id = ${queue.tenant_id}
      and l.queue_id = ${queue.id}
      and l.deleted_at is null
      and l.source_channel = 'meta_lead_ads'
      and l.source_metadata->>'entry' = 'whatsapp'
      and l.qualification_status in ('hot', 'warm')
      -- Leads the broker already moved forward (quote, negotiation, sale) stay as they are.
      and l.status not in ('quote_sent', 'negotiation', 'documentation_pending', 'under_analysis', 'converted')
      and not exists (
        select 1 from whatsapp_messages m
        where m.lead_id = l.id and m.direction = 'incoming' and m.sent_at > l.created_at + interval '5 seconds'
      )
    order by l.created_at`;

  const by = (key) => leads.reduce((acc, lead) => ({ ...acc, [lead[key]]: (acc[lead[key]] ?? 0) + 1 }), {});
  console.log(`Fila: ${queue.name}`);
  console.log(`Leads de WhatsApp quente/morno sem resposta à qualificação: ${leads.length}`);
  console.log("  por temperatura atual:", by("qualification_status"));
  console.log("  por etapa:", by("status"));
  console.log("  com corretor:", leads.filter((lead) => lead.com_corretor).length, "| sem corretor:", leads.filter((lead) => !lead.com_corretor).length);
  if (leads.length) console.log(`  do mais antigo (${leads[0].created_at.toISOString().slice(0, 10)}) ao mais recente (${leads.at(-1).created_at.toISOString().slice(0, 10)})`);

  if (!apply) {
    console.log("\nPrévia apenas. Para gravar, rode de novo com --apply.");
  } else if (leads.length) {
    const backupDir = path.join("scripts", "backups");
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `temperatura-whatsapp-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(leads.map((lead) => ({ id: lead.id, qualification_status: lead.qualification_status })), null, 1));
    console.log(`\nBackup salvo em ${backupFile}`);

    await sql.begin(async (tx) => {
      const ids = leads.map((lead) => lead.id);
      // Same conditions again inside the transaction: a client who replied after the preview stays as is.
      const changed = await tx`update leads l set qualification_status = 'cold', updated_at = now()
        where l.id in ${tx(ids)} and l.qualification_status in ('hot', 'warm')
          and not exists (select 1 from whatsapp_messages m where m.lead_id = l.id and m.direction = 'incoming' and m.sent_at > l.created_at + interval '5 seconds')
        returning l.id`;
      const changedIds = new Set(changed.map((row) => row.id));
      leads.splice(0, leads.length, ...leads.filter((lead) => changedIds.has(lead.id)));
      for (const lead of leads) {
        await tx`insert into lead_interactions (id, lead_id, user_id, tipo, conteudo, created_at)
          values (${randomUUID()}, ${lead.id}, ${author.id}, 'system_alert', ${`Temperatura ajustada de ${lead.qualification_status === "hot" ? "quente" : "morno"} para frio: o cliente do WhatsApp não respondeu a qualificação.`}, now())`;
      }
    });
    console.log(`Gravado: ${leads.length} leads agora estão como frios.`);
  }
} catch (error) {
  console.error("ERRO:", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
