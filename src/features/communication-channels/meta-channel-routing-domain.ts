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

export type MetaChannelBlock = {
  blocked: true;
  reason: "META_SOURCE_CHANNEL_UNAVAILABLE";
  channelLabel: string;
  message: string;
};

export type MetaInboundLookup =
  | { kind: "lead"; id: string; since: Date; phoneSuffix: string | null }
  | { kind: "client"; id: string; since: Date; phoneSuffix: string | null }
  | { kind: "phone"; suffix: string; since: Date }
  | null;

export const META_INBOUND_LOOKBACK_DAYS = 30;

export function resolveMetaInboundLookup(input: {
  leadId?: string | null;
  clientId?: string | null;
  customerPhone?: string | null;
  now?: Date;
}): MetaInboundLookup {
  const since = new Date((input.now ?? new Date()).getTime() - META_INBOUND_LOOKBACK_DAYS * 86_400_000);
  const suffix = input.customerPhone?.replace(/\D/g, "").slice(-8) ?? "";
  // A new lead's first message may not be linked to it yet: the phone is the fallback, inside the same window.
  const phoneSuffix = suffix.length === 8 ? suffix : null;
  if (input.leadId?.trim()) return { kind: "lead", id: input.leadId.trim(), since, phoneSuffix };
  if (input.clientId?.trim()) return { kind: "client", id: input.clientId.trim(), since, phoneSuffix };
  return phoneSuffix ? { kind: "phone", suffix: phoneSuffix, since } : null;
}

export type MetaInboundHit = { channelId: string | null; sentAt: Date | string | null };

/** The most recent of the lead-linked and the phone inbound; a tie keeps the linked one. Pure. */
export function pickLatestInbound<T extends MetaInboundHit>(linked: T | null, byPhone: T | null): T | null {
  if (!linked || !byPhone) return linked ?? byPhone;
  const time = (hit: T) => (hit.sentAt ? new Date(hit.sentAt).getTime() : Number.NEGATIVE_INFINITY);
  return time(byPhone) > time(linked) ? byPhone : linked;
}

export type MetaChannelSelection =
  | { kind: "selected"; channel: MetaChannelRoutingCandidate; source: "inbound" | "pinned" | "official" }
  | ({ kind: "blocked" } & MetaChannelBlock)
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

function sourceChannelBlock(channel?: { displayPhoneNumber: string | null }): MetaChannelBlock {
  const channelLabel = channel?.displayPhoneNumber?.trim() || "usado na última mensagem";
  return {
    blocked: true,
    reason: "META_SOURCE_CHANNEL_UNAVAILABLE",
    channelLabel,
    message: `O número ${channelLabel} está desconectado; reconecte em Configurações > WhatsApp.`,
  };
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
      : { kind: "blocked", ...sourceChannelBlock(source) };
  }

  // Internal notices have no customer source to preserve. They always use the
  // deterministic official fallback (normally the tenant's default), even if
  // a legacy outbox row has a Coex or non-default channel pinned.
  if (customer && input.pinnedChannelId) {
    const pinned = input.channels.find((channel) => channel.id === input.pinnedChannelId);
    if (pinned && pinned.onboardingMode !== "coexistence" && (!input.corporateOnly || pinned.branchId === null) && isUsable(pinned)) {
      return { kind: "selected", channel: pinned, source: "pinned" };
    }
    return { kind: "blocked", ...sourceChannelBlock(pinned) };
  }

  const official = officialCandidates(input.channels, input.corporateOnly ?? false)[0];
  return official ? { kind: "selected", channel: official, source: "official" } : { kind: "none" };
}

export function formatMetaSourceChannelUnavailableMessage(channel: { displayPhoneNumber?: string | null } | null | undefined) {
  return sourceChannelBlock(channel ? { displayPhoneNumber: channel.displayPhoneNumber ?? null } : undefined).message;
}
