import "server-only";

import { AuthorizationError } from "./errors";
import type { TenantContext } from "./types";
import type { TenantRole } from "@/shared/db/schema";
import type { AccessContext } from "./access-context";

export const creatableTeamRoles = ["director", "manager", "supervisor", "broker"] as const;
export type CreatableTeamRole = (typeof creatableTeamRoles)[number];

export function requireCanCreateRole(context: TenantContext, targetRole: CreatableTeamRole): TenantContext {
  const allowed = context.role === "director"
    ? targetRole === "director" || targetRole === "manager" || targetRole === "supervisor" || targetRole === "broker"
    : context.role === "manager"
      ? targetRole === "supervisor" || targetRole === "broker"
      : context.role === "supervisor" && targetRole === "broker";
  if (!allowed) throw new AuthorizationError("O papel atual não pode criar este acesso.");
  return context;
}

export function canCreateRole(role: TenantRole, targetRole: CreatableTeamRole): boolean {
  if (role === "director") return true;
  if (role === "manager") return targetRole === "supervisor" || targetRole === "broker";
  if (role === "supervisor") return targetRole === "broker";
  return false;
}

export type ManagedTeamRole = CreatableTeamRole;

export function canManageMember(
  context: TenantContext | {
    userId: string;
    role: TenantRole;
    branchId: string | null;
    allowedUnitIds?: string[];
    scope?: { unitIds: readonly string[]; tenantWide: boolean };
  },
  target: { role: TenantRole; branchId: string | null; userId: string },
): boolean {
  if (context.userId === target.userId) return false;
  if (target.role === "director") return false;
  if (context.role === "director") return true;

  // Escopo de unidades autorizadas do gestor / supervisor
  const authorizedUnitIds: readonly string[] =
    "scope" in context && context.scope?.unitIds
      ? context.scope.unitIds
      : "allowedUnitIds" in context && Array.isArray(context.allowedUnitIds) && context.allowedUnitIds.length > 0
        ? context.allowedUnitIds
        : context.branchId
          ? [context.branchId]
          : [];

  const isTargetInScope = target.branchId ? authorizedUnitIds.includes(target.branchId) : false;

  if (context.role === "manager") {
    return (target.role === "supervisor" || target.role === "broker") && isTargetInScope;
  }
  if (context.role === "supervisor") {
    return target.role === "broker" && isTargetInScope;
  }
  return false;
}

export function requireCanManageMember(
  context: TenantContext | {
    userId: string;
    role: TenantRole;
    branchId: string | null;
    allowedUnitIds?: string[];
    scope?: { unitIds: readonly string[]; tenantWide: boolean };
  },
  target: { role: TenantRole; branchId: string | null; userId: string },
): TenantContext | typeof context {
  if (!canManageMember(context, target)) {
    throw new AuthorizationError("O papel atual não pode gerenciar este membro.");
  }
  return context;
}

/**
 * Validação rigorosa contra Privilege Escalation e Scope Escalation na edição de membros.
 */
export function requireCanUpdateMemberAuthority(params: {
  actorContext: AccessContext | TenantContext;
  targetMember: { role: TenantRole; branchId: string | null; userId: string };
  proposed: {
    role: CreatableTeamRole;
    branchId?: string | null;
    customRoleScope?: "none" | "own" | "branch" | "tenant" | null;
  };
}): void {
  const { actorContext, targetMember, proposed } = params;

  // 1. O ator pode gerenciar o membro alvo?
  requireCanManageMember(actorContext, targetMember);

  // 2. O ator pode conceder o papel proposto? (Manager não pode promover a Director)
  if (!canCreateRole(actorContext.role, proposed.role)) {
    throw new AuthorizationError(`Seu cargo (${actorContext.role}) não pode conceder o papel de ${proposed.role}.`);
  }

  const isDirector = actorContext.role === "director";
  const actorAllowedUnits: readonly string[] =
    "scope" in actorContext && actorContext.scope?.unitIds
      ? actorContext.scope.unitIds
      : "allowedUnitIds" in actorContext && Array.isArray(actorContext.allowedUnitIds)
        ? actorContext.allowedUnitIds
        : actorContext.branchId
          ? [actorContext.branchId]
          : [];

  // 3. Scope Escalation: Ator não-diretor não pode mover membro para filial fora de seu escopo
  if (!isDirector && proposed.branchId) {
    if (!actorAllowedUnits.includes(proposed.branchId)) {
      throw new AuthorizationError("Você não tem autorização para associar membros a uma filial fora do seu escopo.");
    }
  }

  // 4. Custom Role Scope Escalation: Custom role com escopo de tenant só pode ser concedida por Diretor
  if (proposed.customRoleScope === "tenant" && !isDirector) {
    throw new AuthorizationError("Apenas Diretores podem atribuir cargos customizados com escopo em todo o tenant.");
  }
}
