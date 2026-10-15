import { sql, type AnyColumn, type SQL } from "drizzle-orm";

export { isSupervisorTeamScoped } from "./supervisor-scope-policy";

/**
 * `column` belongs to a broker of the supervisor's team. Resolved in the
 * database (no connection needed to build it): an empty team matches nothing,
 * never the whole unit.
 */
export function inSupervisorTeam(column: AnyColumn | SQL, tenantId: string, supervisorUserId: string): SQL {
  return sql`${column} in (
    select "tenant_memberships"."user_id" from "tenant_memberships"
    where "tenant_memberships"."tenant_id" = ${tenantId}
      and "tenant_memberships"."supervisor_id" = ${supervisorUserId}
      and "tenant_memberships"."status" = 'active'
  )`;
}
