/** Selects a new Coex phone without reusing one already connected to the CRM. */
export function selectUnconnectedCoexistencePhoneId<T extends { id: string }>(input: {
  candidates: T[];
  connectedPhoneNumberIds: ReadonlySet<string>;
}) {
  return input.candidates.find((candidate) => !input.connectedPhoneNumberIds.has(candidate.id))?.id ?? null;
}

export function resolveMetaChannelDefault(input: {
  coexistence: boolean;
  existingIsDefault: boolean;
  currentDefaultExists: boolean;
}) {
  if (input.coexistence) return false;
  return input.existingIsDefault || !input.currentDefaultExists;
}

/** A missing or ambiguous phone match is intentionally a no-op for partner removal. */
export function selectPartnerRemovedChannels<T extends { id: string; phoneNumberId: string | null; displayPhoneNumber: string | null }>(input: {
  channels: T[];
  phoneNumberId?: string | null;
  phone?: string | null;
}) {
  if (input.phoneNumberId) return input.channels.filter((channel) => channel.phoneNumberId === input.phoneNumberId);

  const suffix = (input.phone ?? "").replace(/\D/g, "").slice(-8);
  if (suffix.length !== 8) return [];
  const matches = input.channels.filter((channel) => (channel.displayPhoneNumber ?? "").replace(/\D/g, "").slice(-8) === suffix);
  return matches.length === 1 ? matches : [];
}
