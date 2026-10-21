import "server-only";

import { unstable_cache } from "next/cache";

import type { TenantContext } from "@/shared/auth/types";

/**
 * Short cache of a dashboard tab's data (21/10: switching tabs re-ran every
 * report query). Keyed by the user and their scope, so a manager never sees
 * another unit's numbers, plus the tab's filters. Data must be JSON-safe
 * (the tabs already send dates as ISO strings).
 */
export function cachedDashboardData<T>(
  tab: string,
  context: TenantContext,
  filters: unknown,
  loader: () => Promise<T>,
  revalidateSeconds = 60,
): Promise<T> {
  const scope = JSON.stringify({
    tenantId: context.tenantId,
    userId: context.userId,
    role: context.role,
    jobTitle: context.jobTitle,
    branchId: context.branchId,
    customRoleId: context.customRoleId ?? null,
    customRoleScope: context.customRoleScope ?? null,
    supervisorTeamScope: context.supervisorTeamScope ?? false,
    viewAs: context.viewAs?.adminUserId ?? null,
  });
  return unstable_cache(loader, ["dashboard-tab-v1", tab, scope, JSON.stringify(filters ?? null)], {
    revalidate: revalidateSeconds,
    tags: [`dashboard-tab:${context.tenantId}`],
  })();
}
