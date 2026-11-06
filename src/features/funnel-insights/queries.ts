import "server-only";

import { sql } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase } from "@/shared/db";

import { campaignRow, QUESTION_LABELS, rankCounts, STAGE_LABELS, type CampaignRow, type CountRow } from "./insights-core";

export type FunnelInsights = {
  /** Leads que pararam na qualificação, pela primeira pergunta que faltou. */
  stoppedAt: CountRow[];
  stoppedTotal: number;
  /** Perdas por etapa em que o lead estava ao ser perdido. */
  lostAtStage: CountRow[];
  /** Motivos de perda mais comuns. */
  lossReasons: CountRow[];
  campaigns: CampaignRow[];
};

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

const LOSS_LABELS: Record<string, string> = {
  preco: "Preço",
  "carência": "Carência",
  encontrou_mais_barato: "Achou mais barato",
  ja_contratou: "Já contratou",
  desistiu: "Desistiu",
  problema_saude: "Saúde não coberta",
  nao_qualificado: "Não qualificado",
  sem_interesse: "Sem interesse",
  sem_contato: "Sem contato",
  outro: "Outro",
};

/**
 * Os três recortes do funil profissional para o período (mesmo grupo do funil de chegada: leads criados desde
 * `since`). Gerente vê só a unidade dele.
 */
export async function getFunnelInsights(context: TenantContext, since: Date, requestedBranchId?: string | null): Promise<FunnelInsights> {
  const branchId = context.role === "manager" ? context.branchId ?? "__none__" : requestedBranchId ?? null;
  const sinceIso = since.toISOString();
  const branchFilter = branchId ? sql`and l.branch_id = ${branchId}` : sql``;
  const db = getDatabase();

  const [stoppedResult, lostResult, campaignResult] = await Promise.all([
    // Parou na qualificação: terminou sem qualificar (parcial, frio, sem interesse) ou está parado há mais de 24 h.
    db.execute(sql`
      select coalesce(l.qualification_details->'missingFields'->>0, '_unknown') as question, count(*)::int as count
      from leads l
      where l.tenant_id = ${context.tenantId} and l.created_at >= ${sinceIso}::timestamptz and l.deleted_at is null ${branchFilter}
        and jsonb_typeof(l.qualification_details->'missingFields') = 'array'
        and jsonb_array_length(l.qualification_details->'missingFields') > 0
        and (l.qualification_state in ('PARTIAL', 'NOT_INTERESTED')
          or (l.qualification_state = 'IN_PROGRESS' and l.created_at < now() - interval '24 hours'))
      group by 1
    `),
    // Onde perdemos: a etapa de onde o lead saiu para Perdido (histórico); sem histórico, conta como "Antes do corretor"
    // se nunca teve corretor.
    db.execute(sql`
      select coalesce(h.from_status::text, case when l.corretor_id is null then 'new' else 'in_contact' end) as stage,
        coalesce(h.loss_code, l.motivo_perda, 'outro') as reason, count(*)::int as count
      from leads l
      left join lateral (
        select hh.from_status, hh.loss_code from lead_stage_history hh
        where hh.lead_id = l.id and hh.to_status = 'lost' order by hh.changed_at desc limit 1
      ) h on true
      where l.tenant_id = ${context.tenantId} and l.created_at >= ${sinceIso}::timestamptz and l.deleted_at is null ${branchFilter}
        and l.status = 'lost'
      group by 1, 2
    `),
    // Qualidade por campanha: leads, qualificados (quente ou morno) e vendas.
    db.execute(sql`
      select coalesce(l.meta_campaign_id, l.source_campaign, '_none') as key,
        max(c.name) as name,
        count(*)::int as leads,
        count(*) filter (where l.qualification_status in ('hot', 'warm', 'qualified') or l.qualification_state = 'QUALIFIED')::int as qualified,
        count(*) filter (where l.status = 'converted')::int as sales
      from leads l
      left join meta_campaigns c on c.tenant_id = l.tenant_id and c.campaign_id = l.meta_campaign_id
      where l.tenant_id = ${context.tenantId} and l.created_at >= ${sinceIso}::timestamptz and l.deleted_at is null ${branchFilter}
      group by 1
      order by 3 desc
      limit 25
    `),
  ]);

  const stopped = new Map<string, number>();
  for (const row of rowsOf<{ question: string; count: number }>(stoppedResult)) stopped.set(row.question, Number(row.count));
  const lostStages = new Map<string, number>();
  const lossReasons = new Map<string, number>();
  for (const row of rowsOf<{ stage: string; reason: string; count: number }>(lostResult)) {
    lostStages.set(row.stage, (lostStages.get(row.stage) ?? 0) + Number(row.count));
    lossReasons.set(row.reason, (lossReasons.get(row.reason) ?? 0) + Number(row.count));
  }
  const stoppedRows = rankCounts(stopped, { ...QUESTION_LABELS, _unknown: "Outra pergunta" });
  return {
    stoppedAt: stoppedRows,
    stoppedTotal: stoppedRows.reduce((sum, row) => sum + row.count, 0),
    lostAtStage: rankCounts(lostStages, STAGE_LABELS),
    lossReasons: rankCounts(lossReasons, LOSS_LABELS),
    campaigns: rowsOf<{ key: string; name: string | null; leads: number; qualified: number; sales: number }>(campaignResult)
      .map((row) => campaignRow({ key: row.key, name: row.name, leads: Number(row.leads), qualified: Number(row.qualified), sales: Number(row.sales) })),
  };
}
