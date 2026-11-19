import type { TenantContext } from "@/shared/auth/tenant-context";

export function callAncoraSessionOwnerId(
  context: Pick<TenantContext, "userId" | "viewAs">,
  authenticatedUserId: string,
) {
  return context.viewAs ? authenticatedUserId : context.userId;
}
