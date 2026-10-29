export type MetaChannelRoutingCandidate = {
  id: string;
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  branchId: string | null;
  status: string;
  registrationStatus: string;
  hasCredentials: boolean;
  onboardingMode: string;
  isDefault: boolean;
  createdAt: Date | string | null;
};

export type MetaOutboundRecipientType = "lead" | "client" | "user";

export type MetaChannelSelection =
  | { kind: "selected"; channel: MetaChannelRoutingCandidate; source: "inbound" | "pinned" | "official" }
  | { kind: "blocked"; code: "META_SOURCE_CHANNEL_UNAVAILABLE"; message: string }
  | { kind: "none" };

function isUsable(channel: MetaChannelRoutingCandidate) {
  return channel.status === "active"
    && channel.registrationStatus === "registered"
    && Boolean(channel.phoneNumberId)
    && channel.hasCredentials;
}

function officialCandidates(channels: MetaChannelRoutingCandidate[], corporateOnly: boolean) {
  return channels
    .filter((channel) => channel.onboardingMode !== "coexistence" && (!corporateOnly || channel.branchId === null))
    .filter(isUsable)
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
}

function sourceChannelUnavailableMessage(channel?: { displayPhoneNumber: string | null }) {
  const number = channel?.displayPhoneNumber?.trim() || "usado na última mensagem";
  return `O número ${number} está desconectado; reconecte em Configurações > WhatsApp.`;
}

/**
 * Chooses one Meta sender for both direct replies and outbox messages. A known
 * customer source is strict: if it is unavailable, the reply must not switch
 * numbers. Without a known source, only official channels are fallbacks.
 */
export function selectMetaOutboundChannel(input: {
  channels: MetaChannelRoutingCandidate[];
  recipientType: MetaOutboundRecipientType;
  latestInboundChannelId?: string | null;
  pinnedChannelId?: string | null;
  corporateOnly?: boolean;
}): MetaChannelSelection {
  const customer = input.recipientType !== "user";

  if (customer && input.latestInboundChannelId) {
    const source = input.channels.find((channel) => channel.id === input.latestInboundChannelId);
    return source && isUsable(source)
      ? { kind: "selected", channel: source, source: "inbound" }
      : { kind: "blocked", code: "META_SOURCE_CHANNEL_UNAVAILABLE", message: sourceChannelUnavailableMessage(source) };
  }

  // Internal notices have no customer source to preserve. They always use the
  // deterministic official fallback (normally the tenant's default), even if
  // a legacy outbox row has a Coex or non-default channel pinned.
  if (customer && input.pinnedChannelId) {
    const pinned = input.channels.find((channel) => channel.id === input.pinnedChannelId);
    if (pinned && pinned.onboardingMode !== "coexistence" && (!input.corporateOnly || pinned.branchId === null) && isUsable(pinned)) {
      return { kind: "selected", channel: pinned, source: "pinned" };
    }
    return { kind: "blocked", code: "META_SOURCE_CHANNEL_UNAVAILABLE", message: sourceChannelUnavailableMessage(pinned) };
  }

  const official = officialCandidates(input.channels, input.corporateOnly ?? false)[0];
  return official ? { kind: "selected", channel: official, source: "official" } : { kind: "none" };
}

export function formatMetaSourceChannelUnavailableMessage(channel: { displayPhoneNumber?: string | null } | null | undefined) {
  return sourceChannelUnavailableMessage(channel ? { displayPhoneNumber: channel.displayPhoneNumber ?? null } : undefined);
}
