/**
 * Encerra os trabalhos de distribuição de leads que a distribuição automática nunca vai pegar
 * (03/11): espera manual, apagados ou arquivados, perdidos, desqualificados, bloqueados pela Meta,
 * frios sem dados e removidos da distribuição sem corretor. A fila tinha 581 trabalhos ativos, quase
 * todos assim, e cada rodada varria todos eles. Os retidos por regra (fila manual, plantão, outra
 * unidade, lead anterior a uma data) ficam: a fila voltaria a criá-los na rodada seguinte.
 *
 * Simulação (padrão, não grava nada):
 *   npx tsx --conditions=react-server scripts/close-dead-distribution-jobs.ts
 * Aplicar:
 *   npx tsx --conditions=react-server scripts/close-dead-distribution-jobs.ts --apply
 *
 * Precisa de DATABASE_URL (ou SUPABASE_DB_URL). Idempotente: só toca trabalho ainda ativo e marca
 * `last_error_code = 'CLOSED_NOT_DISTRIBUTABLE'` para ficar rastreável.
 */
import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";

import { getDatabase } from "../src/shared/db/client";

loadEnvConfig(process.cwd());

const DEAD_JOBS = sql`
  from lead_distribution_jobs j
  join leads l on l.id = j.lead_id
  where j.status in ('pending', 'retrying')
    and (
      l.distribution_status = 'manual_hold'
      or l.deleted_at is not null
      or l.archived_at is not null
      or l.status = 'lost'
      or l.qualification_status in ('disqualified', 'not_qualified', 'meta_blocked')
      or (l.qualification_status = 'cold' and l.qualification_state = 'PARTIAL')
      or (l.distribution_removed_at is not null and l.corretor_id is null)
    )`;

async function main() {
  const apply = process.argv.includes("--apply");
  const db = getDatabase();
  const summary = await db.execute(sql`
    select case
             when l.deleted_at is not null or l.archived_at is not null then 'apagado/arquivado'
             when l.status = 'lost' then 'perdido'
             when l.distribution_status = 'manual_hold' then 'espera manual'
             when l.qualification_status in ('disqualified', 'not_qualified') then 'desqualificado'
             when l.qualification_status = 'meta_blocked' then 'bloqueado pela Meta'
             when l.qualification_status = 'cold' then 'frio sem dados'
             else 'removido da distribuição'
           end as motivo,
           count(*)::int as total
    ${DEAD_JOBS}
    group by 1 order by 2 desc`);
  const rows = (summary as unknown as { rows?: Array<{ motivo: string; total: number }> }).rows ?? (summary as unknown as Array<{ motivo: string; total: number }>);
  let total = 0;
  for (const row of rows) {
    total += Number(row.total);
    console.log(`- ${row.motivo}: ${row.total}`);
  }
  if (!apply) {
    console.log(`A encerrar: ${total} trabalho(s). Simulação: rode de novo com --apply para gravar.`);
    process.exit(0);
  }
  const closed = await db.execute(sql`
    update lead_distribution_jobs set status = 'completed', completed_at = now(), updated_at = now(),
      locked_at = null, locked_by = null, lease_expires_at = null,
      last_error_code = 'CLOSED_NOT_DISTRIBUTABLE', last_error_message = 'Encerrado: lead fora da distribuição automática.'
    where id in (select j.id ${DEAD_JOBS})
    returning id`);
  const closedRows = (closed as unknown as { rows?: unknown[] }).rows ?? (closed as unknown as unknown[]);
  console.log(`Encerrados: ${closedRows.length} trabalho(s).`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
