// One-off: Mônica said "Plano empresa Ltda para 44 e 46 anos" (two people, aged 44 and 46): the
// AI registered 44 lives. Corrects the lead and the conversation to 2 lives,
// ages 44 and 46 (average 45), and leaves a note for the broker.
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8").split(/\r?\n/);
const get = (k: string) => env.find((l) => l.startsWith(k + "="))?.slice(k.length + 1).replace(/^["']|["']$/g, "") ?? "";
const sql = postgres(get("SUPABASE_DB_URL") || get("DATABASE_URL"), { prepare: false, max: 1 });
const leadId = "1e30ceeb-c46f-4a57-9f1a-526b0f9a3708";
await sql.begin(async (tx) => {
  const [lead] = await tx`select qualification_details from leads where id = ${leadId}`;
  if (!lead) throw new Error("Lead da Mônica não encontrado");
  const details = { ...(lead.qualification_details ?? {}), numberOfLives: "2", averageAge: "45", individualAges: "44, 46" };
  await tx`update leads set qualification_details = ${tx.json(details)}, updated_at = now() where id = ${leadId}`;
  const [conv] = await tx`select id, memory from ai_conversations where lead_id = ${leadId}`;
  if (conv) {
    const memory = { ...(conv.memory ?? {}), numberOfLives: { value: "2", confidence: 1 }, age: { value: "44, 46", confidence: 1 }, averageAge: { value: "45", confidence: 1 } };
    await tx`update ai_conversations set memory = ${tx.json(memory)}, updated_at = now() where id = ${conv.id}`;
  }
  const [director] = await tx`select m.user_id from tenant_memberships m join leads l on l.tenant_id = m.tenant_id where l.id = ${leadId} and m.role = 'director' and m.status = 'active' limit 1`;
  await tx`insert into lead_interactions (id, lead_id, user_id, tipo, conteudo, created_at) values (${randomUUID()}, ${leadId}, ${director.user_id}, 'note', ${"📝 Dados corrigidos: a cliente informou 2 vidas, com 44 e 46 anos (média 45). A IA tinha registrado 44 vidas por engano."}, now())`;
  console.log("Mônica corrigida: 2 vidas, idades 44 e 46 (média 45).");
});
await sql.end();
