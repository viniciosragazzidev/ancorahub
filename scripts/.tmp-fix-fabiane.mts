// One-off: Fabiane said "Para 12 , 42 anos" (two people, aged 12 and 42) and the
// AI registered 12 lives. Corrects the lead and the conversation to 2 lives,
// ages 12 and 42 (average 27), and leaves a note for the broker.
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8").split(/\r?\n/);
const get = (k: string) => env.find((l) => l.startsWith(k + "="))?.slice(k.length + 1).replace(/^["']|["']$/g, "") ?? "";
const sql = postgres(get("SUPABASE_DB_URL") || get("DATABASE_URL"), { prepare: false, max: 1 });
const leadId = "1e7db56b-db92-406a-b307-3fa342bf04bd";
await sql.begin(async (tx) => {
  const [lead] = await tx`select qualification_details from leads where id = ${leadId}`;
  if (!lead) throw new Error("Lead da Fabiane não encontrado");
  const details = { ...(lead.qualification_details ?? {}), numberOfLives: "2", averageAge: "27", individualAges: "12, 42" };
  await tx`update leads set qualification_details = ${tx.json(details)}, updated_at = now() where id = ${leadId}`;
  const [conv] = await tx`select id, memory from ai_conversations where lead_id = ${leadId}`;
  if (conv) {
    const memory = { ...(conv.memory ?? {}), numberOfLives: { value: "2", confidence: 1 }, age: { value: "12, 42", confidence: 1 }, averageAge: { value: "27", confidence: 1 } };
    await tx`update ai_conversations set memory = ${tx.json(memory)}, updated_at = now() where id = ${conv.id}`;
  }
  const [director] = await tx`select m.user_id from tenant_memberships m join leads l on l.tenant_id = m.tenant_id where l.id = ${leadId} and m.role = 'director' and m.status = 'active' limit 1`;
  await tx`insert into lead_interactions (id, lead_id, user_id, tipo, conteudo, created_at) values (${randomUUID()}, ${leadId}, ${director.user_id}, 'note', ${"📝 Dados corrigidos: a cliente informou 2 vidas, com 12 e 42 anos (média 27). A IA tinha registrado 12 vidas por engano."}, now())`;
  console.log("Fabiane corrigida: 2 vidas, idades 12 e 42 (média 27).");
});
await sql.end();
