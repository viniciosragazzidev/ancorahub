/**
 * Divider text for a change of broker in a lead conversation, from the lead's
 * distribution history. Null when the owner did not change.
 */
export function describeOwnerTransition(previousOwner: string | null, newOwner: string | null): string | null {
  if (previousOwner === newOwner) return null;
  if (!previousOwner && newOwner) return `Lead atribuído a ${newOwner}`;
  if (previousOwner && newOwner) return `Atendimento passou de ${previousOwner} para ${newOwner}`;
  if (previousOwner) return `Atribuição de ${previousOwner} removida · lead sem corretor`;
  return null;
}
