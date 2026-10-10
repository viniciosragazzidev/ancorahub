import { sql, type AnyColumn, type SQL } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { tenantMemberships } from "@/shared/db/schema";

/** Supervisor limited to their team (flag SUPERVISOR_TEAM_SCOPE, resolved in the tenant context). */
export function isSupervisorTeamScoped(context: Pick<TenantContext, "role" | "supervisorTeamScope">) {
  return context.role === "supervisor" && Boolean(context.supervisorTeamScope);
}

/**
 * `column` belongs to a broker of the supervisor's team. Resolved in the
 * database (no connection needed to build it): an empty team matches nothing,
 * never the whole unit.
 */
export function inSupervisorTeam(column: AnyColumn | SQL, tenantId: string, supervisorUserId: string): SQL {
  const memberships = tenantMemberships;
  return sql`${column} in (select ${memberships.userId} from ${memberships} where ${memberships.tenantId} = ${tenantId} and ${memberships.supervisorId} = ${supervisorUserId} and ${memberships.status} = 'active')`;
}
