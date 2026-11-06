import type { TenantRole } from "@/shared/db/schema";
import type { TenantContext } from "@/shared/auth/types";
import { canManageMember } from "@/shared/auth/team-permissions";

/**
 * Who may generate (and see) a reset link for someone else. The link opens
 * the account, so it is never available for a director or a platform admin:
 * that would let one director take over another, or a tenant director take
 * over the platform. Those people use "Esqueci a senha" (link to their own
 * WhatsApp) or ask the platform admin.
 */
export function canGenerateMemberPasswordReset(
  context: TenantContext,
  target: { tenantId: string; userId: string; role: TenantRole; branchId: string | null; isPlatformAdmin?: boolean | null },
) {
  if (target.tenantId !== context.tenantId) return false;
  if (target.isPlatformAdmin) return false;
  if (target.role === "director") return false;
  if (target.userId === context.userId) return false;
  if (context.role === "director") return true;
  if (context.role !== "manager") return false;
  if (target.role === "manager") return false;
  return canManageMember(context, target) && Boolean(context.branchId && target.branchId === context.branchId);
}
