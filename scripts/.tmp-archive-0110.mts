// One-off: archives every lead with no broker created on 01/10/2026 until
// 18:00 (Brasília), the same way "Arquivar leads sem distribuição" does:
// archived (restorable in /leads/arquivados), its pending distribution jobs
// superseded, one audit entry. Leads that got a broker meanwhile are skipped.
//   npx tsx scripts/.tmp-archive-0110.mts          (shows what would be archived)
//   npx tsx scripts/.tmp-archive-0110.mts --apply  (archives)
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8").split(/\r?\n/);
const get = (k: string) => env.find((l) => l.startsWith(k + "="))?.slice(k.length + 1).replace(/^["']|["']$/g, "") ?? "";
const sql = postgres(get("SUPABASE_DB_URL") || get("DATABASE_URL"), { prepare: false, max: 1 });

const FROM = "2026-10-01T03:00:00Z"; // 01/10 00:00 Brasília
const UNTIL = "2026-10-01T21:00:00Z"; // 01/10 18:00 Brasília
const apply = process.argv.includes("--apply");

await sql.begin(async (tx) => {
  const leads = await tx`
    select l.id, l.tenant_id, l.nome, q.name fila from leads l left join lead_queues q on q.id = l.queue_id
    where l.created_at >= ${FROM} and l.created_at < ${UNTIL}
      and l.corretor_id is null and l.archived_at is null and l.deleted_at is null`;
  console.log(`${leads.length} lead(s) sem corretor de 01/10 até 18h:`);
  const byQueue = new Map<string, number>();
  for (const lead of leads) byQueue.set(lead.fila ?? "Sem fila", (byQueue.get(lead.fila ?? "Sem fila") ?? 0) + 1);
  for (const [queue, n] of byQueue) console.log(`  ${n} · ${queue}`);
  if (!apply) {
    console.log("\nNada foi alterado. Rode com --apply para arquivar.");
    return;
  }
  const byTenant = new Map<string, string[]>();
  for (const lead of leads) byTenant.set(lead.tenant_id, [...(byTenant.get(lead.tenant_id) ?? []), lead.id]);
  for (const [tenantId, ids] of byTenant) {
    const [director] = await tx`select user_id from tenant_memberships where tenant_id = ${tenantId} and role = 'director' and status = 'active' limit 1`;
    const archived = await tx`
      update leads set archived_at = now(), archived_by = ${director.user_id}, updated_at = now()
      where tenant_id = ${tenantId} and id in ${tx(ids)} and corretor_id is null and archived_at is null and deleted_at is null
      returning id`;
    const archivedIds = archived.map((row) => row.id);
    if (!archivedIds.length) continue;
    await tx`
      update lead_distribution_jobs set status = 'superseded', completed_at = now(), locked_at = null, locked_by = null, lease_expires_at = null,
        last_error_code = 'LEAD_ARCHIVED', last_error_message = 'Lead arquivado pelo Diretor; removido da distribuição.', updated_at = now()
      where tenant_id = ${tenantId} and lead_id in ${tx(archivedIds)} and status in ('pending', 'retrying')`;
    await tx`insert into audit_logs (id, user_id, entidade, entidade_id, acao, created_at)
      values (${randomUUID()}, ${director.user_id}, 'lead_distribution', ${tenantId}, ${`lead.bulk_archived:${archivedIds.length}`}, now())`;
    console.log(`\n${archivedIds.length} lead(s) arquivados.`);
  }
});
await sql.end();
