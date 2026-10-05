// One-off: Andre Pedrosa and Sebastiana Dos Santos came in with no queue (their
// campaign pointed to the deactivated "Plantão 18"). Puts them in FILA PF - RENAN,
// the campaign's queue now. Broker and status do not change.
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8").split(/\r?\n/);
const get = (k: string) => env.find((l) => l.startsWith(k + "="))?.slice(k.length + 1).replace(/^["']|["']$/g, "") ?? "";
const sql = postgres(get("SUPABASE_DB_URL") || get("DATABASE_URL"), { prepare: false, max: 1 });
const leadIds = ["07cfc26f-30ce-4290-adce-ef943d78f601", "a8622994-3598-426a-b4e9-b03a0e2fbd0a"];
await sql.begin(async (tx) => {
  const [queue] = await tx`select id, tenant_id from lead_queues where name = 'FILA PF - RENAN' and status = 'active'`;
  if (!queue) throw new Error("FILA PF - RENAN não encontrada");
  const moved = await tx`update leads set queue_id = ${queue.id}, updated_at = now() where id in ${tx(leadIds)} and queue_id is null returning id, nome, branch_id`;
  for (const lead of moved) {
    await tx`insert into lead_distribution_events (id, tenant_id, lead_id, from_branch_id, to_branch_id, from_queue_id, to_queue_id, action, source, strategy, reason, actor_id, created_at)
      values (${randomUUID()}, ${queue.tenant_id}, ${lead.id}, ${lead.branch_id}, ${lead.branch_id}, null, ${queue.id}, 'queue_assigned_manually', 'manual_director', 'manual', 'Campanha estava na fila desativada "Plantão 18"; lead colocado na FILA PF - RENAN.', 'f078e581-21fc-4ce2-b4fe-c7c74574e1ba', now())`;
  }
  console.log(`${moved.length} lead(s) na FILA PF - RENAN:`, moved.map((l) => l.nome).join(", "));
});
await sql.end();
