import type { ReportDataScope } from "@/features/reports/metrics/metric-scope";
import { buildStrictRoleLeadScope } from "@/features/leads/strict-role-scope";
import type { TenantContext } from "@/shared/auth/types";

/** Every document attached to a lead inherits the lead's tenant and role boundary. */
export function buildDocumentLeadScope(
  context: TenantContext,
  reportScope: Pick<ReportDataScope, "leadScope">,
) {
  return buildStrictRoleLeadScope(context, reportScope);
}
