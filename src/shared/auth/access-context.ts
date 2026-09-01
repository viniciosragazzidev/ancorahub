import "server-only";

import { and, eq } from "drizzle-orm";
import type { PermissionKey } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "./tenant-context";
import type {
  AccessScope,
  AccessScopeType,
  ResourceOwnershipScope,
  ScopeProvenance,
  TenantContext,
} from "./types";
import { listEffectiveCapabilities } from "@/features/custom-roles/service";
import { getDatabase, schema } from "@/shared/db";
import { withPerfSpan } from "@/shared/observability/request-timing";

export type { AccessScopeType };

export type AccessContext = TenantContext & {
  /** Capacidades e permissões efetivas (RBAC base + Custom Roles) */
  permissions: Set<PermissionKey>;
  /** Modelo canônico de escopo de autorização */
  scope: AccessScope;
  /** Propriedades de compatibilidade com código existente */
  scopeType: AccessScopeType;
  allowedUnitIds: string[];
  canAccessAllUnits: boolean;
};

/**
 * Converte um AccessContext canônico para a visão TenantContext legada.
 */
export function toLegacyTenantContext(context: AccessContext): TenantContext {
  return {
    userId: context.userId,
    tenantId: context.tenantId,
    role: context.role,
    jobTitle: context.jobTitle,
    customRoleId: context.customRoleId,
    customRoleScope: context.customRoleScope,
    branchId: context.branchId,
  };
}

/**
 * Resolve o AccessContext canônico do usuário autenticado no servidor.
 * Separa estritamente ROLE (capacidades) de SCOPE (onde o usuário pode atuar)
 * e resolve gestores multi-unidade a partir de tenant_manager_branches com fallback seguro.
 */
export async function resolveAccessContext(
  existingContext?: TenantContext,
): Promise<AccessContext> {
  return withPerfSpan("access_context.resolve", async () => {
    const context = existingContext ?? (await getRequiredTenantContext());

    const permissionList = await withPerfSpan("rbac.resolve", () =>
      listEffectiveCapabilities({
        tenantId: context.tenantId,
        role: context.role,
        jobTitle: context.jobTitle,
        customRoleId: context.customRoleId ?? null,
      }),
    );

    const permissions = new Set<PermissionKey>(permissionList);

    let scopeType: AccessScopeType = "GLOBAL";
    let allowedUnitIds: string[] = [];
    let canAccessAllUnits = false;
    let ownership: ResourceOwnershipScope = "ANY";
    let unitsProvenance: ScopeProvenance = "TENANT_WIDE";

    if (context.role === "director" || context.customRoleScope === "tenant") {
      scopeType = "GLOBAL";
      canAccessAllUnits = true;
      ownership = "ANY";
      unitsProvenance = context.role === "director" ? "TENANT_WIDE" : "CUSTOM_ROLE_SCOPE";
    } else if (context.customRoleScope === "none") {
      scopeType = "NONE";
      ownership = "NONE";
      unitsProvenance = "NONE";
    } else if (
      context.role === "broker" &&
      (!context.customRoleScope || context.customRoleScope === "own")
    ) {
      scopeType = "SELF";
      ownership = "SELF";
      unitsProvenance = "SELF_BROKER";
      if (context.branchId) {
        allowedUnitIds = [context.branchId];
      }
    } else {
      // Manager, Supervisor ou Custom Role com escopo de unidade (branch)
      // Resolução canônica de filiais vinculadas via tenant_manager_branches
      const managerBranches = await withPerfSpan("scope.manager_branches", async () => {
        try {
          return await getDatabase()
            .select({ branchId: schema.tenantManagerBranches.branchId })
            .from(schema.tenantManagerBranches)
            .innerJoin(
              schema.branches,
              and(
                eq(schema.tenantManagerBranches.branchId, schema.branches.id),
                eq(schema.branches.tenantId, context.tenantId),
                eq(schema.branches.status, "active"),
              ),
            )
            .where(
              and(
                eq(schema.tenantManagerBranches.tenantId, context.tenantId),
                eq(schema.tenantManagerBranches.userId, context.userId),
              ),
            );
        } catch {
          return [];
        }
      });

      if (managerBranches.length > 0) {
        // Multi-unidades explicitamente atribuídas no tenant_manager_branches
        allowedUnitIds = managerBranches.map((r) => r.branchId);
        scopeType = "UNITS";
        ownership = "SCOPED";
        unitsProvenance = "TENANT_MANAGER_BRANCHES";
      } else if (context.branchId) {
        // Fallback legado temporário: filial única registrada no membership
        allowedUnitIds = [context.branchId];
        scopeType = "UNITS";
        ownership = "SCOPED";
        unitsProvenance = "LEGACY_MEMBERSHIP_BRANCH";
      } else {
        // Sem filiais vinculadas nem fallback: fail closed
        allowedUnitIds = [];
        scopeType = "NONE";
        ownership = "NONE";
        unitsProvenance = "EMPTY_FALLBACK";
      }
    }

    const scope: AccessScope = {
      tenantWide: canAccessAllUnits,
      unitIds: Object.freeze([...allowedUnitIds]),
      teamIds: Object.freeze([]),
      ownership,
      provenance: {
        units: unitsProvenance,
      },
    };

    return {
      ...context,
      permissions,
      scope,
      scopeType,
      allowedUnitIds,
      canAccessAllUnits,
    };
  });
}

