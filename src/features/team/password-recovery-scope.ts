import type { TenantRole } from "@/shared/db/schema";
import type { TenantContext } from "@/shared/auth/types";
import { canManageMember } from "@/shared/auth/team-permissions";

export function canGenerateMemberPasswordReset(
  context: TenantContext,
  target: { tenantId: string; userId: string; role: TenantRole; branchId: string | null },
) {
  if (target.tenantId !== context.tenantId) return false;
  if (context.role === "director") return true;
  if (context.role !== "manager") return false;
  if (target.role === "director" || target.role === "manager") return false;
  return canManageMember(context, target) && Boolean(context.branchId && target.branchId === context.branchId);
}
