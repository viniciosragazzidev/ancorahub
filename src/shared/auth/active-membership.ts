import { AuthorizationError } from "./errors";

type MembershipWithStatus = {
  membershipStatus: string;
};

/**
 * Disabled historical associations do not block the current tenant. Multiple
 * active associations remain denied until the product has a tenant selector.
 */
export function selectSingleActiveMembership<T extends MembershipWithStatus>(
  memberships: T[],
): T {
  const activeMemberships = memberships.filter(
    (membership) => membership.membershipStatus === "active",
  );

  if (activeMemberships.length !== 1) {
    throw new AuthorizationError(
      "The authenticated user must have exactly one active tenant membership.",
      "INCONSISTENT_MEMBERSHIP",
    );
  }

  return activeMemberships[0];
}
