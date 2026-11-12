import "server-only";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/shared/db";

export type CorretorSemWhatsapp = { corretorId: string; nome: string; plantoes: string[] };

/**
 * Corretores escalados no plantão de uma data (São Paulo) que não estão com WhatsApp `ready`.
 * Usa a mesma regra da escala de plantão: escala ativa, dia da semana e vigência.
 * Quando o corretor tem mais de uma conexão, vale a que estiver `ready`, senão a mais recente.
 */
export async function escaladosSemWhatsapp(tenantId: string, dataPlantao: string): Promise<CorretorSemWhatsapp[]> {
  const db = getDatabase();
  const linhas = (await db.execute(sql`
    with escalados as (
      select distinct a.broker_id, s.name as plantao
      from duty_roster_assignments a
      join unit_duty_schedules s on s.id = a.schedule_id
      where a.tenant_id = ${tenantId}
        and a.status = 'active'
        and s.status = 'active'
        and a.day_of_week = extract(dow from ${dataPlantao}::date)
        and (a.duty_date is null or a.duty_date = ${dataPlantao}::date)
        and (a.valid_from is null or a.valid_from <= (${dataPlantao}::date + interval '1 day'))
        and (a.valid_until is null or a.valid_until > ${dataPlantao}::date)
        and (s.valid_until is null or s.valid_until > ${dataPlantao}::date)
    ),
    conexao as (
      select distinct on (user_id) user_id, status
      from whatsapp_connections
      where tenant_id = ${tenantId}
      order by user_id, (status = 'ready') desc, updated_at desc
    )
    select e.broker_id as "corretorId", u.name as nome, string_agg(distinct e.plantao, ', ') as plantoes
    from escalados e
    join "user" u on u.id = e.broker_id
    left join conexao c on c.user_id = e.broker_id
    where coalesce(c.status, '') <> 'ready'
    group by e.broker_id, u.name
    order by u.name
  `)) as unknown as { corretorId: string; nome: string; plantoes: string | null }[];

  return linhas.map((linha) => ({
    corretorId: linha.corretorId,
    nome: linha.nome,
    plantoes: linha.plantoes ? linha.plantoes.split(", ") : [],
  }));
}
