import { getDatabase, schema } from "@/shared/db";
import { and, eq, inArray, count, sql } from "drizzle-orm";

export type SlaLossMetrics = {
  totalLost: number;
  unattendedSlaLost: number;
  responseDelayLost: number;
  otherReasonsLost: number;
  unattendedSlaPercentage: number;
};

/**
 * Calcula métricas de leads perdidos e estouro de SLA para um escopo de corretores/unidade.
 */
export async function getSlaLossMetricsForScope(
  tenantId: string,
  filter: {
    brokerIds?: string[];
    branchId?: string;
  }
): Promise<SlaLossMetrics> {
  const db = getDatabase();
  const conditions = [
    eq(schema.leads.tenantId, tenantId),
    eq(schema.leads.status, "lost"),
  ];

  if (filter.brokerIds && filter.brokerIds.length > 0) {
    conditions.push(inArray(schema.leads.corretorId, filter.brokerIds));
  } else if (filter.branchId) {
    conditions.push(eq(schema.leads.branchId, filter.branchId));
  }

  const [row] = await db
    .select({
      totalLost: count(),
      unattendedSlaLost: count(
        sql`CASE WHEN ${schema.leads.lossCategory} = 'unattended_sla' THEN 1 END`
      ),
      responseDelayLost: count(
        sql`CASE WHEN ${schema.leads.lossCategory} = 'response_delay' THEN 1 END`
      ),
      otherReasonsLost: count(
        sql`CASE WHEN ${schema.leads.lossCategory} IS NULL OR ${schema.leads.lossCategory} NOT IN ('unattended_sla', 'response_delay') THEN 1 END`
      ),
    })
    .from(schema.leads)
    .where(and(...conditions));

  const totalLost = Number(row?.totalLost ?? 0);
  const unattendedSlaLost = Number(row?.unattendedSlaLost ?? 0);
  const responseDelayLost = Number(row?.responseDelayLost ?? 0);
  const otherReasonsLost = Number(row?.otherReasonsLost ?? 0);
  const unattendedSlaPercentage = totalLost > 0 ? Math.round(((unattendedSlaLost + responseDelayLost) / totalLost) * 100) : 0;

  return {
    totalLost,
    unattendedSlaLost,
    responseDelayLost,
    otherReasonsLost,
    unattendedSlaPercentage,
  };
}
