import "server-only";

import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { PermissionKey } from "./permissions";
import type { AccessContext } from "./access-context";
import type {
  AuthorizationDecision,
  QueryScopeConstraints,
  ResourceScopeDescriptor,
} from "./types";
import { AuthorizationError } from "./errors";

export class AuthorizationService {
  /**
   * Avalia a decisão canônica de autorização (Capacidade "O QUE" + Escopo "ONDE").
   *
   * Regras inegociáveis:
   * 1. Tenant Isolation absoluto: resource.tenantId !== context.tenantId sempre nega (TENANT_MISMATCH).
   * 2. Capacidade: se o usuário não possui a permissão no context.permissions, nega (MISSING_CAPABILITY).
   * 3. Escopo: valida se a unidade/posse do recurso está dentro do AccessScope autorizado.
   */
  static evaluate(
    context: AccessContext,
    capability: PermissionKey,
    resource?: ResourceScopeDescriptor | null,
    options?: { allowUnassignedUnit?: boolean },
  ): AuthorizationDecision {
    // 1. INVARIANTE ABSOLUTA: Tenant Isolation
    if (resource && resource.tenantId !== context.tenantId) {
      return {
        allowed: false,
        capability,
        reason: "TENANT_MISMATCH",
        details: "Tentativa de acesso a recurso de outro tenant.",
        matchedScope: "NONE",
      };
    }

    // 2. CAPACIDADE (O QUE)
    if (!context.permissions.has(capability)) {
      return {
        allowed: false,
        capability,
        reason: "MISSING_CAPABILITY",
        details: `Permissão negada para a capacidade: ${capability}`,
        matchedScope: "NONE",
      };
    }

    // Se nenhum recurso específico foi informado, a validação de capacidade pura é suficiente
    if (!resource) {
      return {
        allowed: true,
        capability,
        matchedScope: context.scope?.tenantWide || context.canAccessAllUnits ? "TENANT_WIDE" : "UNIT",
      };
    }

    // 3. ESCOPO (ONDE)
    const scope = context.scope;

    // 3.1 Tenant-Wide (Diretor ou Custom Role com escopo tenant)
    if (scope?.tenantWide || context.canAccessAllUnits || context.scopeType === "GLOBAL") {
      return {
        allowed: true,
        capability,
        matchedScope: "TENANT_WIDE",
      };
    }

    // 3.2 Escopo NONE / Fail Closed
    if (scope?.ownership === "NONE" || context.scopeType === "NONE") {
      return {
        allowed: false,
        capability,
        reason: "SCOPE_EMPTY",
        details: "Usuário com escopo operacional vazio ou inativo.",
        matchedScope: "NONE",
      };
    }

    // 3.3 Escopo SELF (Corretor ou Custom Role com escopo próprio)
    if (scope?.ownership === "SELF" || context.scopeType === "SELF") {
      if (resource.ownerUserId && resource.ownerUserId === context.userId) {
        return {
          allowed: true,
          capability,
          matchedScope: "SELF",
        };
      }
      return {
        allowed: false,
        capability,
        reason: "NOT_RESOURCE_OWNER",
        details: "Acesso restrito aos próprios recursos do corretor.",
        matchedScope: "NONE",
      };
    }

    // 3.4 Escopo UNITS / SCOPED (Gestor, Supervisor ou Custom Role com escopo de filiais)
    const allowedUnits = scope?.unitIds ?? context.allowedUnitIds ?? [];

    if (allowedUnits.length === 0) {
      return {
        allowed: false,
        capability,
        reason: "SCOPE_EMPTY",
        details: "Gestor sem unidades autorizadas vinculadas.",
        matchedScope: "NONE",
      };
    }

    if (resource.unitId) {
      if (allowedUnits.includes(resource.unitId)) {
        return {
          allowed: true,
          capability,
          matchedScope: "UNIT",
        };
      }
      return {
        allowed: false,
        capability,
        reason: "UNIT_OUT_OF_SCOPE",
        details: "Unidade do recurso fora do escopo autorizado.",
        matchedScope: "NONE",
      };
    }

    // Recurso sem unitId explícito
    if (options?.allowUnassignedUnit) {
      return {
        allowed: true,
        capability,
        matchedScope: "UNIT",
      };
    }

    if (resource.ownerUserId && resource.ownerUserId === context.userId) {
      return {
        allowed: true,
        capability,
        matchedScope: "SELF",
      };
    }

    return {
      allowed: false,
      capability,
      reason: "UNIT_OUT_OF_SCOPE",
      details: "Recurso sem filial associada fora do escopo do gestor.",
      matchedScope: "NONE",
    };
  }

  /**
   * Valida se a permissão (O QUE) e opcionalmente o escopo do recurso (ONDE) estão autorizados.
   */
  static can(
    context: AccessContext,
    capability: PermissionKey,
    resource?: ResourceScopeDescriptor | null,
    options?: { allowUnassignedUnit?: boolean },
  ): boolean {
    return this.evaluate(context, capability, resource, options).allowed;
  }

  /**
   * Exige que a capacidade e o escopo do recurso estejam autorizados.
   * Lança AuthorizationError estruturado caso negado.
   */
  static require(
    context: AccessContext,
    capability: PermissionKey,
    resource?: ResourceScopeDescriptor | null,
    options?: { allowUnassignedUnit?: boolean },
  ): AccessContext {
    const decision = this.evaluate(context, capability, resource, options);
    if (!decision.allowed) {
      throw new AuthorizationError(
        decision.details ?? `Permissão negada para a capacidade: ${capability}`,
        decision.reason,
      );
    }
    return context;
  }

  /**
   * Alias de compatibilidade com o método requirePermission anterior.
   */
  static requirePermission(context: AccessContext, permission: PermissionKey): AccessContext {
    return this.require(context, permission);
  }

  /**
   * Valida se uma unidade específica (ONDE) está dentro do escopo permitido do usuário.
   */
  static canAccessUnit(context: AccessContext, unitId: string | null | undefined): boolean {
    if (context.canAccessAllUnits || context.scope?.tenantWide || context.scopeType === "GLOBAL") {
      return true;
    }
    if (context.scope?.ownership === "NONE" || context.scopeType === "NONE") {
      return false;
    }
    if (!unitId) return false;
    const allowed = context.scope?.unitIds ?? context.allowedUnitIds ?? [];
    return allowed.includes(unitId);
  }

  /**
   * Retorna os descritores puros de restrição de escopo para construção de consultas seguras.
   * Não depende de Drizzle ou SQL diretamente.
   */
  static getQueryScopeConstraints(context: AccessContext): QueryScopeConstraints {
    const isTenantWide = context.scope?.tenantWide || context.canAccessAllUnits || context.scopeType === "GLOBAL";
    const allowedUnitIds = context.scope?.unitIds ?? context.allowedUnitIds ?? [];
    const allowedTeamIds = context.scope?.teamIds ?? [];
    const ownerMode = context.scope?.ownership ?? (isTenantWide ? "ANY" : context.scopeType === "SELF" ? "SELF" : "SCOPED");

    return {
      tenantId: context.tenantId,
      tenantWide: isTenantWide,
      allowedUnitIds,
      allowedTeamIds,
      ownerMode,
      effectiveOwnerUserId: ownerMode === "SELF" ? context.userId : undefined,
    };
  }

  /**
   * Interseção estrita entre o escopo solicitado pelo frontend e o escopo permitido no servidor.
   * Regra de ouro: effectiveScope = requestedScope ∩ allowedScope
   */
  static intersectUnitScope(
    context: AccessContext,
    requestedUnitIds?: string[] | null,
  ): string[] | undefined {
    const allowedUnits = context.scope?.unitIds ?? context.allowedUnitIds ?? [];
    const isTenantWide = context.canAccessAllUnits || context.scope?.tenantWide || context.scopeType === "GLOBAL";

    if (!requestedUnitIds || requestedUnitIds.length === 0) {
      return isTenantWide ? undefined : [...allowedUnits];
    }

    if (isTenantWide) {
      return requestedUnitIds;
    }

    return requestedUnitIds.filter((id) => allowedUnits.includes(id));
  }

  /**
   * Gera uma cláusula SQL do Drizzle ORM para filtrar a tabela pelo escopo seguro (ONDE).
   */
  static scopeQuery<T extends { tenantId: any; branchId?: any; corretorId?: any }>(
    context: AccessContext,
    table: T,
    options?: {
      corretorColumn?: any;
      allowUnassignedBranch?: boolean;
    },
  ): SQL {
    const conditions: SQL[] = [eq(table.tenantId, context.tenantId)];
    const isTenantWide = context.canAccessAllUnits || context.scope?.tenantWide || context.scopeType === "GLOBAL";
    const allowedUnits = context.scope?.unitIds ?? context.allowedUnitIds ?? [];

    if (isTenantWide) {
      return and(...conditions)!;
    }

    if (context.scope?.ownership === "NONE" || context.scopeType === "NONE") {
      conditions.push(sql`false`);
      return and(...conditions)!;
    }

    if (context.scope?.ownership === "SELF" || context.scopeType === "SELF") {
      const corretorCol = options?.corretorColumn ?? table.corretorId;
      if (corretorCol) {
        conditions.push(eq(corretorCol, context.userId));
      } else if (table.branchId && allowedUnits.length > 0) {
        conditions.push(inArray(table.branchId, [...allowedUnits]));
      } else {
        conditions.push(sql`false`);
      }
      return and(...conditions)!;
    }

    if (table.branchId) {
      if (allowedUnits.length > 0) {
        if (options?.allowUnassignedBranch) {
          conditions.push(
            or(inArray(table.branchId, [...allowedUnits]), isNull(table.branchId))!,
          );
        } else {
          conditions.push(inArray(table.branchId, [...allowedUnits]));
        }
      } else {
        conditions.push(sql`false`);
      }
    }

    return and(...conditions)!;
  }
}

