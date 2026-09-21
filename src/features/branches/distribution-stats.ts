/**
 * Métricas de distribuição por filial — parte pura (sem banco), usada pela
 * consulta de /filiais e coberta por teste.
 */

/** Status de lead que contam como "em andamento" na carteira de uma filial. */
export const ACTIVE_LEAD_STATUSES = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
] as const;

export type BranchDistributionStats = {
  /** Corretores ativos com disponibilidade "available". */
  availableBrokers: number;
  /** Leads em andamento (ver ACTIVE_LEAD_STATUSES). */
  activeLeads: number;
  /** Leads ainda com status "new". */
  newLeads: number;
};

type BrokerStatRow = { branchId: string | null; availabilityStatus: string; count: number | string };
type LeadStatRow = { branchId: string | null; status: string; count: number | string };

/** Agregação pura das linhas agrupadas do banco; separada da consulta para ser testável. */
export function aggregateBranchDistributionStats(
  brokerRows: BrokerStatRow[],
  leadRows: LeadStatRow[],
): Map<string, BranchDistributionStats> {
  const stats = new Map<string, BranchDistributionStats>();
  const entry = (branchId: string) => {
    let current = stats.get(branchId);
    if (!current) {
      current = { availableBrokers: 0, activeLeads: 0, newLeads: 0 };
      stats.set(branchId, current);
    }
    return current;
  };

  for (const row of brokerRows) {
    if (!row.branchId || row.availabilityStatus !== "available") continue;
    entry(row.branchId).availableBrokers += Number(row.count);
  }
  for (const row of leadRows) {
    if (!row.branchId) continue;
    if ((ACTIVE_LEAD_STATUSES as readonly string[]).includes(row.status)) entry(row.branchId).activeLeads += Number(row.count);
    if (row.status === "new") entry(row.branchId).newLeads += Number(row.count);
  }
  return stats;
}
