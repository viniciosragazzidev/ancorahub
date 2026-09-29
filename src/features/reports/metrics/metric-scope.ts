import "server-only";

import { eq, inArray, type SQL } from "drizzle-orm";

import { getSupervisedBrokerIds } from "@/features/team/supervisor-service";
import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";

/**
 * Escopo de dados dos relatórios (DEC-090 §6).
 *
 * Deriva EXCLUSIVAMENTE da sessão: o papel define o universo máximo
 * consultável; qualquer filtro de cliente apenas refina dentro deste escopo.
 * Ausência de escopo nunca significa acesso global implícito.
 */
export interface ReportDataScope {
  readonly tenantId: string;
  /** IDs supervisionados (apenas para supervisor; null caso contrário). */
  readonly supervisedBrokerIds: string[] | null;
  /** Filtro sobre `schema.leads` (corretor/unidade). */
  readonly leadScope: SQL | undefined;
  /** Filtro sobre `schema.sales.brokerId` (corretor/supervisor). */
  readonly salesBrokerScope: SQL | undefined;
  /** Gestor/Diretor podem ver agregados por unidade; corretor/supervisor não. */
  readonly canSeeUnits: boolean;
  /** Diretor vê todas as unidades (comparativo); gestor somente a própria. */
  readonly canCompareUnits: boolean;
}

const NO_LEADS_SENTINEL = "__reporting_no_scope__";

export async function resolveReportDataScope(context: TenantContext): Promise<ReportDataScope> {
  if (context.role === "broker") {
    return {
      tenantId: context.tenantId,
      supervisedBrokerIds: null,
      leadScope: eq(schema.leads.corretorId, context.userId),
      salesBrokerScope: eq(schema.sales.brokerId, context.userId),
      canSeeUnits: false,
      canCompareUnits: false,
    };
  }

  if (context.role === "supervisor") {
    const supervised = await getSupervisedBrokerIds(context.tenantId, context.userId);
    return {
      tenantId: context.tenantId,
      supervisedBrokerIds: supervised,
      leadScope: supervised.length
        ? inArray(schema.leads.corretorId, supervised)
        : eq(schema.leads.id, NO_LEADS_SENTINEL),
      salesBrokerScope: supervised.length
        ? inArray(schema.sales.brokerId, supervised)
        : eq(schema.sales.id, NO_LEADS_SENTINEL),
      canSeeUnits: false,
      canCompareUnits: false,
    };
  }

  if (context.role === "manager" && context.branchId) {
    return {
      tenantId: context.tenantId,
      supervisedBrokerIds: null,
      leadScope: eq(schema.leads.branchId, context.branchId),
      salesBrokerScope: undefined,
      canSeeUnits: true,
      canCompareUnits: false,
    };
  }

  // Gestor sem unidade vinculada não recebe dados de unidade alguma —
  // ausência de escopo nunca é acesso global implícito.
  if (context.role === "manager") {
    return {
      tenantId: context.tenantId,
      supervisedBrokerIds: null,
      leadScope: eq(schema.leads.id, NO_LEADS_SENTINEL),
      salesBrokerScope: eq(schema.sales.id, NO_LEADS_SENTINEL),
      canSeeUnits: false,
      canCompareUnits: false,
    };
  }

  return {
    tenantId: context.tenantId,
    supervisedBrokerIds: null,
    leadScope: undefined,
    salesBrokerScope: undefined,
    canSeeUnits: true,
    canCompareUnits: true,
  };
}
