import "server-only";

import { and, desc, inArray, sql, type SQL } from "drizzle-orm";

import { buildBrokerWalletLeadWhere } from "@/features/customers/broker-wallet-leads";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { QUICK_SALE_LIMIT, QUICK_SALE_STAGES, type QuickSaleLead, type QuickSaleStage } from "./quick-sale";

type QuickSaleContext = Pick<TenantContext, "tenantId" | "userId" | "role" | "branchId" | "jobTitle"> & Partial<TenantContext>;

/**
 * O predicado da lista: o mesmo da Minha carteira em negociação (tenant, escopo canônico e corretor da sessão como
 * responsável, sem excluídos, arquivados nem conversa sem nome), só com as etapas que registram venda.
 */
export function buildQuickSaleLeadWhere(context: QuickSaleContext, query: string): SQL {
  return and(
    buildBrokerWalletLeadWhere(context, { view: "negotiating", ...(query ? { query } : {}) }),
    inArray(schema.leads.status, [...QUICK_SALE_STAGES]),
  )!;
}

/** Mais adiantado no funil primeiro. As posições vão literais (inteiros fixos) para a ordem ser numérica. */
export function quickSaleStageOrder(): SQL {
  const cases = QUICK_SALE_STAGES.map((stage, index) => sql`when ${stage} then ${sql.raw(String(index))}`);
  return sql`case ${schema.leads.status} ${sql.join(cases, sql` `)} else ${sql.raw(String(QUICK_SALE_STAGES.length))} end`;
}

/** Leads do corretor que podem ir ao registro de venda, com busca e limite no servidor. Leitura: sem auditoria. */
export async function listQuickSaleLeads(context: QuickSaleContext, query: string): Promise<QuickSaleLead[]> {
  if (context.role !== "broker") return [];
  const rows = await getDatabase()
    .select({ id: schema.leads.id, name: schema.leads.nome, status: schema.leads.status })
    .from(schema.leads)
    .where(buildQuickSaleLeadWhere(context, query))
    .orderBy(quickSaleStageOrder(), desc(schema.leads.updatedAt), desc(schema.leads.id))
    .limit(QUICK_SALE_LIMIT);
  return rows.map((row) => ({ id: row.id, name: row.name, status: row.status as QuickSaleStage }));
}
