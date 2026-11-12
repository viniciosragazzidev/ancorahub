/**
 * Management registers the sale of a broker's lead (decision of 04/11): the director on any lead, the
 * manager on a lead of the unit. The broker's own lead keeps the status selector; finished leads show nothing.
 * The server action checks the same scope again.
 */
export function canManagementRegisterSale(input: {
  role: string;
  userId: string;
  branchId: string | null | undefined;
  lead: { corretorId: string | null; branchId: string | null; status: string };
  /** Convertido pela IA sem venda registrada (10/11): a gestão também pode completar o registro. */
  aiSalePending?: boolean;
}) {
  const { role, userId, branchId, lead } = input;
  if (!lead.corretorId || lead.corretorId === userId) return false;
  if (lead.status === "lost" || (lead.status === "converted" && !input.aiSalePending)) return false;
  if (role === "director") return true;
  return role === "manager" && Boolean(branchId) && lead.branchId === branchId;
}

/**
 * A titular may be initialized by the owner or by management inside the
 * authenticated lead scope. Scope is resolved separately on the server query.
 */
export function canEnsureLeadHolder(input: {
  role: string;
  userId: string;
  lead: { corretorId: string | null };
  isInScope: boolean;
}) {
  if (!input.isInScope) return false;
  if (input.role === "broker") return input.lead.corretorId === input.userId;
  return input.role === "director" || input.role === "manager" || input.role === "supervisor";
}
