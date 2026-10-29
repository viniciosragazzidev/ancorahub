import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { notStatusBroadcastSql } from "@/features/conversations/status-broadcast";
import { META_CLOUD_PROVIDER } from "./types";
import { selectMetaOutboundChannel, type MetaChannelRoutingCandidate, type MetaOutboundRecipientType } from "./meta-channel-routing-domain";

const META_PROVIDER_KEYS = [META_CLOUD_PROVIDER, "meta_cloud_api"] as const;

export class MetaSourceChannelUnavailableError extends Error {
  readonly code = "META_SOURCE_CHANNEL_UNAVAILABLE";

  constructor(message: string) {
    super(message);
    this.name = "MetaSourceChannelUnavailableError";
  }
}

export function isMetaSourceChannelUnavailableError(error: unknown): error is MetaSourceChannelUnavailableError {
  return error instanceof MetaSourceChannelUnavailableError
    || (error instanceof Error && "code" in error && error.code === "META_SOURCE_CHANNEL_UNAVAILABLE");
}

/** One tenant-scoped resolver for direct replies and Meta outbox routes. */
export async function resolveMetaOutboundChannel(input: {
  tenantId: string;
  recipientType: MetaOutboundRecipientType;
  customerPhone?: string | null;
  pinnedChannelId?: string | null;
  corporateOnly?: boolean;
}) {
  const db = getDatabase();
  const latestInboundChannelId = input.recipientType === "user"
    ? null
    : await findLatestInboundChannelId(input.tenantId, input.customerPhone);
  const candidates: MetaChannelRoutingCandidate[] = await db.select({
    id: schema.communicationChannels.id,
    phoneNumberId: schema.communicationChannels.phoneNumberId,
    displayPhoneNumber: schema.communicationChannels.displayPhoneNumber,
    branchId: schema.communicationChannels.branchId,
    status: schema.communicationChannels.status,
    registrationStatus: schema.communicationChannels.registrationStatus,
    hasCredentials: sql<boolean>`${schema.communicationChannels.accessTokenCiphertext} is not null`.as("has_credentials"),
    onboardingMode: schema.communicationChannels.onboardingMode,
    isDefault: schema.communicationChannels.isDefault,
    createdAt: schema.communicationChannels.createdAt,
  }).from(schema.communicationChannels).where(and(
    eq(schema.communicationChannels.tenantId, input.tenantId),
    inArray(schema.communicationChannels.provider, [...META_PROVIDER_KEYS]),
  ));
  const selection = selectMetaOutboundChannel({
    channels: candidates,
    recipientType: input.recipientType,
    latestInboundChannelId,
    pinnedChannelId: input.pinnedChannelId,
    corporateOnly: input.corporateOnly,
  });
  if (selection.kind === "blocked") throw new MetaSourceChannelUnavailableError(selection.message);
  if (selection.kind !== "selected") return null;
  const [channel] = await db.select().from(schema.communicationChannels).where(and(
    eq(schema.communicationChannels.id, selection.channel.id),
    eq(schema.communicationChannels.tenantId, input.tenantId),
  )).limit(1);
  return channel ?? null;
}

async function findLatestInboundChannelId(tenantId: string, customerPhone?: string | null) {
  const suffix = customerPhone?.replace(/\D/g, "").slice(-8) ?? "";
  if (suffix.length !== 8) return null;

  const [lastInbound] = await getDatabase()
    .select({ channelId: schema.whatsappMessages.communicationChannelId })
    .from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, tenantId),
      inArray(schema.whatsappMessages.provider, [...META_PROVIDER_KEYS]),
      inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]),
      notStatusBroadcastSql(schema.whatsappMessages.messageId),
      sql`not (${schema.whatsappMessages.mediaKind} is null and lower(trim(coalesce(${schema.whatsappMessages.body}, ''))) in ('', '[text]'))`,
      sql`RIGHT(REGEXP_REPLACE(${schema.whatsappMessages.phone}, '[^0-9]', '', 'g'), 8) = ${suffix}`,
    ))
    .orderBy(desc(schema.whatsappMessages.sentAt), desc(schema.whatsappMessages.id))
    .limit(1);
  return lastInbound?.channelId ?? null;
}
