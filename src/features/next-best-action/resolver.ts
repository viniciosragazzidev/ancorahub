import type { LeadActionContext, NextBestAction, DashboardActionContext } from "./types";
import { evaluateLeadRules, evaluateDashboardRules } from "./rules";
import { filterActionsByPermissions } from "./permissions";
import type { TenantRole } from "@/shared/db/schema";

export function resolveLeadNextBestAction(
  ctx: LeadActionContext,
  userRole?: TenantRole | string | null,
  jobTitle?: string | null,
): NextBestAction | null {
  const primaryAction = evaluateLeadRules(ctx);
  if (!primaryAction) return null;

  if (userRole) {
    const filtered = filterActionsByPermissions([primaryAction], userRole, jobTitle);
    return filtered[0] ?? null;
  }

  return primaryAction;
}

export function resolveDashboardNextBestActions(
  ctx: DashboardActionContext,
  userRole?: TenantRole | string | null,
  jobTitle?: string | null,
): NextBestAction[] {
  const actions = evaluateDashboardRules(ctx);
  if (userRole) {
    return filterActionsByPermissions(actions, userRole, jobTitle);
  }
  return actions;
}
