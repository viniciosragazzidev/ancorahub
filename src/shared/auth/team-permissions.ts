import "server-only";

import { AuthorizationError } from "./errors";
import type { TenantContext } from "./types";
import type { TenantRole } from "@/shared/db/schema";

export const creatableTeamRoles = ["manager", "supervisor", "broker"] as const;
export type CreatableTeamRole = (typeof creatableTeamRoles)[number];

export function requireCanCreateRole(context: TenantContext, targetRole: CreatableTeamRole): TenantContext {
  const allowed = context.role === "director"
    ? targetRole === "manager" || targetRole === "supervisor" || targetRole === "broker"
    : context.role === "manager"
      ? targetRole === "supervisor" || targetRole === "broker"
      : context.role === "supervisor" && targetRole === "broker";
  if (!allowed) throw new AuthorizationError("O papel atual não pode criar este acesso.");
  return context;
}

export function canCreateRole(role: TenantRole, targetRole: CreatableTeamRole) {
  if (role === "director") return true;
  if (role === "manager") return targetRole === "supervisor" || targetRole === "broker";
  if (role === "supervisor") return targetRole === "broker";
  return false;
}

export type ManagedTeamRole = CreatableTeamRole;

export function canManageMember(
  context: TenantContext,
  target: { role: TenantRole; branchId: string | null; userId: string },
) {
  if (context.userId === target.userId) return false;
  if (target.role === "director") return false;
  if (context.role === "director") return true;
  if (context.role === "manager") {
    return (target.role === "supervisor" || target.role === "broker") && target.branchId === context.branchId;
  }
  if (context.role === "supervisor") {
    return target.role === "broker" && target.branchId === context.branchId;
  }
  return false;
}

export function requireCanManageMember(
  context: TenantContext,
  target: { role: TenantRole; branchId: string | null; userId: string },
) {
  if (!canManageMember(context, target)) {
    throw new AuthorizationError("O papel atual nao pode gerenciar este membro.");
  }
  return context;
}
