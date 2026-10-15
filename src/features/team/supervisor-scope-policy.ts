import type { TenantContext } from "@/shared/auth/types";

/** Pure role/flag gate shared by server-side team scope resolvers. */
export function isSupervisorTeamScoped(context: Pick<TenantContext, "role" | "supervisorTeamScope">) {
  return context.role === "supervisor" && Boolean(context.supervisorTeamScope);
}
