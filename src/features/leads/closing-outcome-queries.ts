import "server-only";

import { sql } from "drizzle-orm";

import { getDatabase } from "@/shared/db";

import {
  pendingClosingOutcome,
  summarizeClosingOutcomes,
  type ClosingOutcomesSummary,
  type ClosingTransitionRow,
  type OpenClosingLead,
} from "./closing-outcome-core";

export const CLOSING_OUTCOMES_DEFAULT_DAYS = 30;

function rowsOf<T>(result: unknown): T[] {
  return (Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows ?? []) as T[];
}

const toDate = (value: unknown) => (value ? new Date(value as string) : null);

/**
 * Desfechos do fechamento para a direção (09/11): entradas, fechou, perdeu e voltou no período (histórico de
 * etapas, só mudanças de pessoas) e quem está no fechamento agora, com os pendentes. A venda antiga gravava a
 * etapa de origem vazia: nesse caso vale a etapa da linha anterior do mesmo lead.
 */
export async function getClosingOutcomesSummary(input: {
  tenantId: string;
  branchId?: string | null;
  periodDays?: number;
  now?: Date;
}): Promise<ClosingOutcomesSummary> {
  const now = input.now ?? new Date();
  const periodDays = input.periodDays ?? CLOSING_OUTCOMES_DEFAULT_DAYS;
  const since = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const branchFilter = input.branchId ? sql`and l.branch_id = ${input.branchId}` : sql``;
  const db = getDatabase();

  const [transitionsResult, openResult] = await Promise.all([
    db.execute(sql`
      with history as (
        select h.lead_id, h.from_status::text as from_status, h.to_status::text as to_status, h.actor_type, h.changed_at,
          lag(h.to_status::text) over (partition by h.lead_id order by h.changed_at, h.id) as previous_to_status
        from lead_stage_history h
        where h.tenant_id = ${input.tenantId}
      )
      select history.lead_id, coalesce(history.from_status, history.previous_to_status) as from_status,
        history.to_status, history.actor_type, l.corretor_id, u.name as broker_name
      from history
      join leads l on l.id = history.lead_id and l.tenant_id = ${input.tenantId}
      left join "user" u on u.id = l.corretor_id
      where history.changed_at >= ${since.toISOString()}
        and l.deleted_at is null
        ${branchFilter}
    `),
    db.execute(sql`
      select l.corretor_id, u.name as broker_name, l.status::text as status, l.stage_entered_at, l.stage_hold_until
      from leads l
      left join "user" u on u.id = l.corretor_id
      where l.tenant_id = ${input.tenantId}
        and l.status in ('documentation_pending', 'under_analysis')
        and l.deleted_at is null
        and l.archived_at is null
        ${branchFilter}
    `),
  ]);

  const transitions: ClosingTransitionRow[] = rowsOf<Record<string, unknown>>(transitionsResult).map((row) => ({
    leadId: String(row.lead_id),
    brokerId: (row.corretor_id as string | null) ?? null,
    brokerName: (row.broker_name as string | null) ?? null,
    fromStatus: (row.from_status as string | null) ?? null,
    toStatus: String(row.to_status),
    actorType: String(row.actor_type),
  }));
  const openLeads: OpenClosingLead[] = rowsOf<Record<string, unknown>>(openResult).map((row) => ({
    brokerId: (row.corretor_id as string | null) ?? null,
    brokerName: (row.broker_name as string | null) ?? null,
    pending: pendingClosingOutcome({
      status: String(row.status),
      stageEnteredAt: toDate(row.stage_entered_at),
      holdUntil: toDate(row.stage_hold_until),
      now,
    }).pending,
  }));
  return summarizeClosingOutcomes({ periodDays, transitions, openLeads });
}
