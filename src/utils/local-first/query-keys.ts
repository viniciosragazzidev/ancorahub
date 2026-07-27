/**
 * Query keys must always start with the authenticated scope. This prevents a
 * cache entry from one tenant or user being reused by another account.
 */
export function localFirstQueryKey(
  tenantId: string,
  userId: string,
  domain: string,
  entity?: string,
) {
  return ["local-first", tenantId, userId, domain, ...(entity ? [entity] : [])] as const;
}
