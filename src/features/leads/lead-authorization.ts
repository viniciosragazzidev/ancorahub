import "server-only";

import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { AccessContext } from "@/shared/auth/access-context";
import { AuthorizationService } from "@/shared/auth/authorization-service";
import type { ResourceScopeDescriptor, TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";

export type LeadResourceInput = {
  tenantId: string;
  branchId?: string | null;
  corretorId?: string | null;
};

/**
 * Normaliza AccessContext ou TenantContext para contexto de autorização seguro.
 */
export function toEffectiveLeadAccessContext(context: AccessContext | TenantContext): AccessContext {
  if ("permissions" in context && "scope" in context) {
    return context as AccessContext;
  }
  const isDirector = context.role === "director";
  const isBroker = context.role === "broker";
  const allowedUnits = isDirector
    ? []
    : context.branchId
      ? [context.branchId]
      : [];

  return {
    ...context,
    permissions: new Set(["acessar_leads"]),
    scopeType: isDirector ? "GLOBAL" : isBroker ? "SELF" : "UNITS",
    canAccessAllUnits: isDirector,
    allowedUnitIds: allowedUnits,
    scope: {
      tenantWide: isDirector,
      unitIds: allowedUnits,
      teamIds: [],
      ownership: isDirector ? "ANY" : isBroker ? "SELF" : "SCOPED",
      provenance: {
        units: isDirector ? "TENANT_WIDE" : isBroker ? "SELF_BROKER" : "LEGACY_MEMBERSHIP_BRANCH",
      },
    },
  };
}

/**
 * Converte metadados mínimos do Lead para o descritor de escopo canônico.
 * O core de Auth nunca importa schema de Lead.
 */
export function buildLeadResourceScope(lead: LeadResourceInput): ResourceScopeDescriptor {
  return {
    tenantId: lead.tenantId,
    unitId: lead.branchId ?? null,
    ownerUserId: lead.corretorId ?? null,
  };
}

/**
 * Constrói a cláusula SQL WHERE segura para consultas de Lead no Drizzle ORM.
 *
 * Invariantes invioláveis:
 * 1. Isolamento multi-tenant absoluto (tenantId = context.tenantId)
 * 2. Fail-closed se o usuário não tiver a permissão 'acessar_leads' ou escopo NONE
 * 3. Tenant-wide para diretores / cargos globais (com filtro opcional por filial solicitada)
 * 4. Escopo próprio (SELF) para corretores (corretorId = context.userId)
 * 5. Multi-unidade para gestores (branchId IN allowedUnits) com interseção de filtros da UI
 */
export function buildLeadScopeWhere(
  rawContext: AccessContext | TenantContext,
  options?: {
    requestedBranchId?: string | null;
    leadsTable?: typeof schema.leads;
  },
): SQL {
  const context = toEffectiveLeadAccessContext(rawContext);
  const table = options?.leadsTable ?? schema.leads;
  const constraints = AuthorizationService.getQueryScopeConstraints(context);

  // Invariante 1: Tenant Isolation
  const conditions: SQL[] = [eq(table.tenantId, constraints.tenantId)];

  // Invariante 2: Capacidade e Fail-closed
  if (!context.permissions.has("acessar_leads") || constraints.ownerMode === "NONE" || context.scopeType === "NONE") {
    conditions.push(sql`false`);
    return and(...conditions)!;
  }

  // 1. Tenant-wide (Diretores)
  if (constraints.tenantWide) {
    if (options?.requestedBranchId) {
      conditions.push(eq(table.branchId, options.requestedBranchId));
    }
    return and(...conditions)!;
  }

  // 2. Corretor / Titularidade própria (SELF)
  if (constraints.ownerMode === "SELF" || context.scopeType === "SELF") {
    conditions.push(eq(table.corretorId, context.userId));
    return and(...conditions)!;
  }

  // 3. Gestores Multi-Unidade (UNITS / SCOPED)
  const allowedUnits = constraints.allowedUnitIds;
  if (!allowedUnits || allowedUnits.length === 0) {
    conditions.push(sql`false`);
    return and(...conditions)!;
  }

  // Interseção estrita: requestedScope ∩ allowedScope
  if (options?.requestedBranchId) {
    if (allowedUnits.includes(options.requestedBranchId)) {
      conditions.push(eq(table.branchId, options.requestedBranchId));
    } else {
      // Filial solicitada não autorizada para o gestor -> nega retorno
      conditions.push(sql`false`);
    }
  } else {
    // Retorna todas as filiais autorizadas
    conditions.push(inArray(table.branchId, [...allowedUnits]));
  }

  return and(...conditions)!;
}
