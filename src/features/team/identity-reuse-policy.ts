export type ExistingTeamIdentity = {
  id: string;
  active: boolean;
  status: "pending" | "active" | "disabled";
};

export type ExistingTeamMembership = { id: string } | null;

/**
 * Global identities are intentionally preserved when a tenant member is
 * deleted. They may still be used by another tenant, so a new invitation may
 * reuse one only when this tenant no longer has a membership for it.
 */
export function classifyExistingTeamIdentity(
  identity: ExistingTeamIdentity | null,
  tenantMembership: ExistingTeamMembership,
) {
  if (!identity) return { kind: "new" as const };
  if (tenantMembership) return { kind: "tenant-conflict" as const };
  if (!identity.active || identity.status !== "active") return { kind: "disabled" as const };
  return { kind: "reuse" as const, userId: identity.id };
}
