export type NegotiationRoleScope = {
  role: "director" | "manager" | "supervisor";
  tenantId: string;
  branchId: string | null;
  supervisorId: string | null;
};

export type NegotiationLeadOwner = {
  tenantId: string;
  branchId: string | null;
  brokerId: string | null;
};

export function canOpenNegotiations(role: string, enabled: boolean, hasPermission: boolean) {
  return enabled && hasPermission && (role === "director" || role === "manager" || role === "supervisor");
}

/** Pure permission boundary used by the drawer action and scope tests. */
export function canViewNegotiationLead(scope: NegotiationRoleScope, lead: NegotiationLeadOwner, supervisorBrokerIds: ReadonlySet<string> = new Set()) {
  if (lead.tenantId !== scope.tenantId || !lead.brokerId) return false;
  if (scope.role === "director") return true;
  if (scope.role === "manager") return Boolean(scope.branchId && lead.branchId === scope.branchId);
  return Boolean(scope.supervisorId && supervisorBrokerIds.has(lead.brokerId));
}
