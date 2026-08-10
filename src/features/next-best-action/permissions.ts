import type { NextBestAction } from "./types";
import { hasCapability } from "@/shared/auth/permissions";
import type { TenantRole } from "@/shared/db/schema";

export function filterActionsByPermissions(
  actions: NextBestAction[],
  role: TenantRole | string | null | undefined,
  jobTitle?: string | null,
): NextBestAction[] {
  if (!role) return [];

  return actions
    .filter((action) => {
      if (!action.permission) return true;
      return hasCapability(role, action.permission, jobTitle);
    })
    .map((action) => {
      if (action.secondaryActions && action.secondaryActions.length > 0) {
        return {
          ...action,
          secondaryActions: filterActionsByPermissions(
            action.secondaryActions,
            role,
            jobTitle,
          ),
        };
      }
      return action;
    });
}
