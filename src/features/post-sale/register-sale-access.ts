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
}) {
  const { role, userId, branchId, lead } = input;
  if (!lead.corretorId || lead.corretorId === userId) return false;
  if (lead.status === "converted" || lead.status === "lost") return false;
  if (role === "director") return true;
  return role === "manager" && Boolean(branchId) && lead.branchId === branchId;
}
