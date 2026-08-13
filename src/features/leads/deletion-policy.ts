import type { TenantRole } from "@/shared/db/schema";

/** Lead removal is an irreversible operational decision reserved for Directors. */
export function canDeleteLead(role: TenantRole) {
  return role === "director";
}
