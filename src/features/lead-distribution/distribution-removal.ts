/**
 * Removing a lead without a broker from distribution (definitive: only a
 * manual assignment to a broker brings it back). Pure data, shared by the
 * action, the engine guard and the screens.
 */
export const DISTRIBUTION_REMOVAL_REASONS = {
  disqualified_no_value: { label: "Lead desqualificado e sem valor", tag: "Desqualificado sem valor" },
  external_broker_transfer: { label: "Transferência de lead para corretor externo", tag: "Corretor externo" },
} as const;

export type DistributionRemovalReason = keyof typeof DISTRIBUTION_REMOVAL_REASONS;

export const DISTRIBUTION_REMOVAL_NOTE_MAX = 500;

export function isDistributionRemovalReason(value: unknown): value is DistributionRemovalReason {
  return typeof value === "string" && Object.hasOwn(DISTRIBUTION_REMOVAL_REASONS, value);
}

/** Tag text for a removed lead, e.g. "Fora da distribuição · Corretor externo". */
export function distributionRemovalTag(reason: string | null | undefined) {
  return isDistributionRemovalReason(reason) ? `Fora da distribuição · ${DISTRIBUTION_REMOVAL_REASONS[reason].tag}` : null;
}

/** Only a lead without a broker, still open, can be removed. */
export function canRemoveFromDistribution(lead: { corretorId: string | null; distributionRemovedAt: Date | string | null; archivedAt?: Date | string | null; deletedAt?: Date | string | null }) {
  return !lead.corretorId && !lead.distributionRemovedAt && !lead.archivedAt && !lead.deletedAt;
}
