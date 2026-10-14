import type { TenantContext } from "@/shared/auth/types";

export function canManageLiteBroker(
  context: TenantContext,
  target: { role: string; branchId: string | null; supervisorId: string | null; userId: string },
) {
  if (target.role !== "broker" || !context.branchId || target.branchId !== context.branchId || target.userId === context.userId) return false;
  if (context.role === "manager") return true;
  if (context.role === "supervisor") return Boolean(context.supervisorTeamScope && target.supervisorId === context.userId);
  return false;
}
