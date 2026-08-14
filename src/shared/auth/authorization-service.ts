import "server-only";

import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import type { PermissionKey } from "./permissions";
import type { AccessContext } from "./access-context";
import { AuthorizationError } from "./errors";

export class AuthorizationService {
  /**
   * Valida se a permissão (O QUE) está concedida no contexto do usuário.
   */
  static can(context: AccessContext, permission: PermissionKey): boolean {
    return context.permissions.has(permission);
  }

  /**
   * Exige que a permissão (O QUE) esteja concedida.
   */
  static requirePermission(context: AccessContext, permission: PermissionKey): AccessContext {
    if (!this.can(context, permission)) {
      throw new AuthorizationError(`Permissão negada para a capacidade: ${permission}`);
    }
    return context;
  }

  /**
   * Valida se uma unidade específica (ONDE) está dentro do escopo permitido.
   */
  static canAccessUnit(context: AccessContext, unitId: string | null | undefined): boolean {
    if (context.canAccessAllUnits || context.scopeType === "GLOBAL") return true;
    if (context.scopeType === "NONE") return false;
    if (!unitId) return false;
    return context.allowedUnitIds.includes(unitId);
  }

  /**
   * Interseção estrita entre o escopo solicitado pelo frontend e o escopo permitido no servidor.
   * Regra de ouro: effectiveScope = requestedScope ∩ allowedScope
   */
  static intersectUnitScope(context: AccessContext, requestedUnitIds?: string[] | null): string[] | undefined {
    if (!requestedUnitIds || requestedUnitIds.length === 0) {
      return context.canAccessAllUnits ? undefined : context.allowedUnitIds;
    }

    if (context.canAccessAllUnits) {
      return requestedUnitIds;
    }

    const intersected = requestedUnitIds.filter((id) => context.allowedUnitIds.includes(id));
    return intersected;
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

    if (context.canAccessAllUnits || context.scopeType === "GLOBAL") {
      return and(...conditions)!;
    }

    if (context.scopeType === "NONE") {
      conditions.push(sql`false`);
      return and(...conditions)!;
    }

    if (context.scopeType === "SELF") {
      const corretorCol = options?.corretorColumn ?? table.corretorId;
      if (corretorCol) {
        conditions.push(eq(corretorCol, context.userId));
      } else if (table.branchId && context.allowedUnitIds.length > 0) {
        conditions.push(inArray(table.branchId, context.allowedUnitIds));
      } else {
        conditions.push(sql`false`);
      }
      return and(...conditions)!;
    }

    if (context.scopeType === "UNITS") {
      if (table.branchId) {
        if (context.allowedUnitIds.length > 0) {
          if (options?.allowUnassignedBranch) {
            conditions.push(or(inArray(table.branchId, context.allowedUnitIds), isNull(table.branchId))!);
          } else {
            conditions.push(inArray(table.branchId, context.allowedUnitIds));
          }
        } else {
          conditions.push(sql`false`);
        }
      }
    }

    return and(...conditions)!;
  }
}
