import type { TenantContext } from "@/shared/auth/types";
import { canManageMember } from "@/shared/auth/team-permissions";

export function canRevokeTeamInvitation(
  context: TenantContext,
  target: { userId: string | null; role: TenantContext["role"]; branchId: string | null; supervisorId: string | null },
) {
  if (!canManageMember(context, {
    userId: target.userId ?? "pending-invitation",
    role: target.role,
    branchId: target.branchId,
  })) return false;
  if (context.role === "supervisor") {
    return Boolean(
      target.role === "broker"
      && context.branchId
      && target.branchId === context.branchId
      && target.supervisorId === context.userId
    );
  }
  return true;
}
