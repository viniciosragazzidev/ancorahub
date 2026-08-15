/**
 * A handoff only becomes human-visible after the provider confirms the final
 * message and supplies its immutable identifier. This is intentionally pure so
 * the contract is regression-tested independently of a provider mock.
 */
export function isConfirmedClosingDelivery(
  deliveryStatus: string,
  providerMessageId: string | null | undefined,
): boolean {
  return deliveryStatus === "sent" && Boolean(providerMessageId?.trim());
}
