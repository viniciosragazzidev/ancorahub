import "server-only";

import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { notStatusBroadcastSql } from "@/features/conversations/status-broadcast";
import { META_CLOUD_PROVIDER } from "./types";
import {
  resolveMetaInboundLookup,
  selectMetaOutboundChannel,
  type MetaChannelBlock,
  type MetaChannelRoutingCandidate,
  type MetaInboundLookup,
  type MetaOutboundRecipientType,
} from "./meta-channel-routing-domain";

const META_PROVIDER_KEYS = [META_CLOUD_PROVIDER, "meta_cloud_api"] as const;

/** One tenant-scoped resolver for direct replies and Meta outbox routes. */
export async function resolveMetaOutboundChannel(input: {
  tenantId: string;
  recipientType: MetaOutboundRecipientType;
  recipientId?: string | null;
  customerPhone?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  pinnedChannelId?: string | null;
  corporateOnly?: boolean;
}): Promise<typeof schema.communicationChannels.$inferSelect | MetaChannelBlock | null> {
  const db = getDatabase();
  const latestInboundChannelId = input.recipientType === "user"
    ? null
    : await findLatestInboundChannelId(input.tenantId, resolveMetaInboundLookup({
      leadId: input.leadId ?? (input.recipientType === "lead" ? input.recipientId : null),
      clientId: input.clientId ?? (input.recipientType === "client" ? input.recipientId : null),
      customerPhone: input.customerPhone,
    }));
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
  if (selection.kind === "blocked") return selection;
  if (selection.kind !== "selected") return null;
  const [channel] = await db.select().from(schema.communicationChannels).where(and(
    eq(schema.communicationChannels.id, selection.channel.id),
    eq(schema.communicationChannels.tenantId, input.tenantId),
  )).limit(1);
  return channel ?? null;
}

async function findLatestInboundChannelId(tenantId: string, lookup: MetaInboundLookup) {
  if (!lookup) return null;

  const identity = lookup.kind === "lead"
    ? eq(schema.whatsappMessages.leadId, lookup.id)
    : lookup.kind === "client"
      ? eq(schema.whatsappMessages.clientId, lookup.id)
      : sql`RIGHT(REGEXP_REPLACE(${schema.whatsappMessages.phone}, '[^0-9]', '', 'g'), 8) = ${lookup.suffix}`;

  const [lastInbound] = await getDatabase()
    .select({ channelId: schema.whatsappMessages.communicationChannelId })
    .from(schema.whatsappMessages)
    .where(and(
      eq(schema.whatsappMessages.tenantId, tenantId),
      inArray(schema.whatsappMessages.provider, [...META_PROVIDER_KEYS]),
      inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]),
      notStatusBroadcastSql(schema.whatsappMessages.messageId),
      sql`not (${schema.whatsappMessages.mediaKind} is null and lower(trim(coalesce(${schema.whatsappMessages.body}, ''))) in ('', '[text]'))`,
      gte(schema.whatsappMessages.sentAt, lookup.since),
      identity,
    ))
    .orderBy(desc(schema.whatsappMessages.sentAt), desc(schema.whatsappMessages.id))
    .limit(1);
  return lastInbound?.channelId ?? null;
}
