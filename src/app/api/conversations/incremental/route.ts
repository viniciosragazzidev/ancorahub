import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";

import { isMediaKindSupported } from "@/features/conversations/media-kinds";
import { buildConversationLeadScope } from "@/features/conversations/lead-scope";
import { shouldCreateSyntheticCustomerConversation } from "@/features/communication-channels/conversation-classification";
import { loadedLeadMessageScope } from "@/features/conversations/loaded-lead-message-scope";
import { isValidConversationCursor, parseSyntheticConversationPhone } from "@/features/conversations/incremental-sync";
import { conversationMessageVisibilityFilter } from "@/features/conversations/message-index-query";
import { samePhone } from "@/features/communication-channels/service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { formatMetaSourceChannelUnavailableMessage } from "@/features/communication-channels/meta-channel-routing-domain";
import { getDirectorFacingMetaDeliveryFailure } from "@/features/communication-channels/meta-delivery-failure";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasPermission } from "@/shared/auth/permissions";
import { getDatabase, schema } from "@/shared/db";
import { normalizePhone } from "@/shared/utils/phone";

const requestSchema = z.object({
  cursor: z.object({ sentAt: z.string().datetime({ offset: true }), id: z.string().max(128) }).strict(),
  conversationIds: z.array(z.string().min(1).max(128)).max(800),
  openConversationId: z.string().max(128).nullable(),
}).strict();

const MAX_DELTA_MESSAGES = 500;
const responseHeaders = { "Cache-Control": "no-store, private" };

function withNoStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, { status, headers: responseHeaders });
}

function asRows(value: unknown): Array<Record<string, unknown>> {
  const rows = Array.isArray(value) ? value : (value as { rows?: unknown[] } | null)?.rows ?? [];
  return rows as Array<Record<string, unknown>>;
}

function compactPreview(value: string) {
  const body = value.trim();
  return body.length > 80 ? `${body.slice(0, 80)}...` : body;
}

function channelLabelOf(channels: Array<{ id: string; displayPhoneNumber: string | null }>) {
  const labels = new Map(channels.map((channel) => [channel.id, (channel.displayPhoneNumber ?? "").replace(/\D/g, "").slice(-4) || null]));
  const several = channels.length > 1;
  return (message: { provider?: string | null; communicationChannelId?: string | null }) => {
    if (message.provider === "waha") return "WAHA";
    if (!several || !message.communicationChannelId) return null;
    return labels.get(message.communicationChannelId) ?? null;
  };
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequiredTenantContext();
    if (!hasPermission(context.role, "acessar_conversas")) return withNoStore({ error: "Acesso não permitido." }, 403);
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return withNoStore({ error: "Cursor ou lista de conversas inválida.", requiresFullRefresh: true }, 400);

    const now = new Date();
    if (!isValidConversationCursor(parsed.data.cursor, now.getTime())) {
      return withNoStore({ requiresFullRefresh: true, reason: "cursor_expired" }, 409);
    }

    const requestedLeadIds = [...new Set(parsed.data.conversationIds.filter((id) => !id.startsWith("unassigned-")))];
    const requestedSynthetic = [...new Map(parsed.data.conversationIds
      .filter((id) => id.startsWith("unassigned-"))
      .map((id) => [id, parseSyntheticConversationPhone(id)] as const)).entries()];
    if (requestedSynthetic.some(([, phone]) => !phone)) {
      return withNoStore({ requiresFullRefresh: true, reason: "invalid_synthetic_conversation" }, 409);
    }
    const db = getDatabase();
    const message = schema.whatsappMessages;
    const visibleLeadRows = requestedLeadIds.length
      ? await db.select({ id: schema.leads.id, phone: schema.leads.telefone })
        .from(schema.leads)
        .where(and(
          eq(schema.leads.tenantId, context.tenantId),
          inArray(schema.leads.id, requestedLeadIds),
          buildConversationLeadScope(context),
          isNull(schema.leads.deletedAt),
          isNull(schema.leads.archivedAt),
        ))
      : [];
    const visibleLeadIds = visibleLeadRows.map((lead) => lead.id);
    const missingVisibleLead = requestedLeadIds.some((id) => !visibleLeadIds.includes(id));
    if (missingVisibleLead) return withNoStore({ requiresFullRefresh: true, reason: "conversation_scope_changed" }, 409);

    const openLead = parsed.data.openConversationId
      ? visibleLeadRows.find((lead) => lead.id === parsed.data.openConversationId) ?? null
      : null;
    if (parsed.data.openConversationId && !parsed.data.openConversationId.startsWith("unassigned-") && !openLead) {
      return withNoStore({ requiresFullRefresh: true, reason: "open_conversation_scope_changed" }, 409);
    }

    const requestedSyntheticPhones = requestedSynthetic.flatMap(([id, phone]) => phone ? [{ id, phone }] : []);
    const syntheticSuffixes = [...new Set(requestedSyntheticPhones.map(({ phone }) => phone.slice(-8)))];
    const syntheticPhoneRows = syntheticSuffixes.length
      ? asRows(await db.execute(sql`
          select distinct on (right(regexp_replace(coalesce(${message.phone}, ''), '[^0-9]', '', 'g'), 8))
            ${message.leadId} as lead_id, ${message.clientId} as client_id, ${message.phone} as phone
          from ${message}
          where ${and(
            eq(message.tenantId, context.tenantId),
            isNull(message.leadId),
            isNull(message.clientId),
            inArray(sql`right(regexp_replace(coalesce(${message.phone}, ''), '[^0-9]', '', 'g'), 8)`, syntheticSuffixes),
            conversationMessageVisibilityFilter(context.tenantId),
          )}
          order by right(regexp_replace(coalesce(${message.phone}, ''), '[^0-9]', '', 'g'), 8), ${message.sentAt} desc, ${message.id} desc
        `)).map((row) => ({
          leadId: typeof row.lead_id === "string" ? row.lead_id : null,
          clientId: typeof row.client_id === "string" ? row.client_id : null,
          phone: typeof row.phone === "string" ? row.phone : null,
        }))
      : [];
    const brokerPhoneRows = requestedSyntheticPhones.length
      ? await db.select({ phone: schema.brokerProfiles.phone })
        .from(schema.brokerProfiles)
        .where(eq(schema.brokerProfiles.tenantId, context.tenantId))
      : [];
    const visibleLeadPhones = new Set(visibleLeadRows.flatMap((lead) => lead.phone ? [lead.phone.replace(/\D/g, "")] : []));
    const validSyntheticIds = new Set(requestedSyntheticPhones
      .filter(({ phone }) => syntheticPhoneRows.some((row) =>
        typeof row.phone === "string"
        && samePhone(row.phone, phone)
        && shouldCreateSyntheticCustomerConversation(row, visibleLeadPhones, brokerPhoneRows.map((item) => item.phone)),
      ))
      .map(({ id }) => id));
    if (validSyntheticIds.size !== requestedSyntheticPhones.length) {
      return withNoStore({ requiresFullRefresh: true, reason: "synthetic_conversation_scope_changed" }, 409);
    }
    const openSyntheticPhone = parsed.data.openConversationId
      ? requestedSyntheticPhones.find(({ id }) => id === parsed.data.openConversationId)?.phone ?? null
      : null;
    if (parsed.data.openConversationId?.startsWith("unassigned-") && !openSyntheticPhone) {
      return withNoStore({ requiresFullRefresh: true, reason: "open_synthetic_conversation_scope_changed" }, 409);
    }

    const suffixColumn = sql`right(regexp_replace(coalesce(${message.phone}, ''), '[^0-9]', '', 'g'), 8)`;
    const matchedVisibleLead = visibleLeadRows.length
      ? loadedLeadMessageScope({ message, leads: visibleLeadRows })
      : undefined;
    const cursorAt = new Date(parsed.data.cursor.sentAt);
    const afterCursor = or(
      gt(message.sentAt, cursorAt),
      and(eq(message.sentAt, cursorAt), gt(message.id, parsed.data.cursor.id)),
    )!;
    const matchedSynthetic = syntheticSuffixes.length
      ? and(isNull(message.leadId), isNull(message.clientId), inArray(suffixColumn, syntheticSuffixes))
      : undefined;
    const matchedVisibleConversation = or(matchedVisibleLead, matchedSynthetic);
    const changedRows = matchedVisibleConversation
      ? await db.select({
          id: message.id,
          leadId: message.leadId,
          clientId: message.clientId,
          phone: message.phone,
          direction: message.direction,
          sentAt: message.sentAt,
        })
        .from(message)
        .where(and(
          eq(message.tenantId, context.tenantId),
          matchedVisibleConversation,
          conversationMessageVisibilityFilter(context.tenantId),
          afterCursor,
        ))
        .orderBy(asc(message.sentAt), asc(message.id))
        .limit(MAX_DELTA_MESSAGES + 1)
      : [];
    if (changedRows.length > MAX_DELTA_MESSAGES) return withNoStore({ requiresFullRefresh: true, reason: "delta_too_large" }, 409);

    const leadById = new Map(visibleLeadRows.map((lead) => [lead.id, lead]));
    const leadsByPhoneSuffix = new Map<string, typeof visibleLeadRows>();
    for (const lead of visibleLeadRows) {
      const suffix = normalizePhone(lead.phone ?? "").slice(-8);
      if (suffix.length !== 8) continue;
      leadsByPhoneSuffix.set(suffix, [...(leadsByPhoneSuffix.get(suffix) ?? []), lead]);
    }
    const syntheticByPhoneSuffix = new Map<string, typeof requestedSyntheticPhones>();
    for (const synthetic of requestedSyntheticPhones) {
      const suffix = synthetic.phone.slice(-8);
      syntheticByPhoneSuffix.set(suffix, [...(syntheticByPhoneSuffix.get(suffix) ?? []), synthetic]);
    }
    const affectedIds = new Set<string>();
    for (const row of changedRows) {
      const suffix = normalizePhone(row.phone ?? "").slice(-8);
      if (row.leadId && leadById.has(row.leadId)) affectedIds.add(row.leadId);
      if (!row.leadId && row.phone) {
        for (const lead of leadsByPhoneSuffix.get(suffix) ?? []) {
          if (lead.phone && samePhone(row.phone, lead.phone)) affectedIds.add(lead.id);
        }
      }
      if (!row.leadId && !row.clientId && row.phone) {
        for (const item of syntheticByPhoneSuffix.get(suffix) ?? []) {
          if (samePhone(row.phone, item.phone)) affectedIds.add(item.id);
        }
      }
    }
    const affectedLeads = visibleLeadRows.filter((lead) => affectedIds.has(lead.id));
    const affectedSynthetic = requestedSyntheticPhones.filter(({ id }) => affectedIds.has(id));
    const affectedLeadScope = affectedLeads.length
      ? loadedLeadMessageScope({ message, leads: affectedLeads })
      : undefined;
    const affectedSyntheticScope = affectedSynthetic.length
      ? and(
          isNull(message.leadId),
          isNull(message.clientId),
          inArray(suffixColumn, [...new Set(affectedSynthetic.map(({ phone }) => phone.slice(-8)))]),
        )
      : undefined;
    const summaryFilter = or(affectedLeadScope, affectedSyntheticScope);

    const statusLeadIds = [...new Set([
      ...affectedLeads.map((lead) => lead.id),
      ...(openLead ? [openLead.id] : []),
    ])];
    const aiConversationRows = statusLeadIds.length
      ? await db.select({
          id: schema.aiConversations.id,
          leadId: schema.aiConversations.leadId,
          status: schema.aiConversations.status,
          assignedUserId: schema.aiConversations.assignedUserId,
        })
        .from(schema.aiConversations)
        .where(and(
          eq(schema.aiConversations.tenantId, context.tenantId),
          inArray(schema.aiConversations.leadId, statusLeadIds),
        ))
        .orderBy(desc(schema.aiConversations.updatedAt), desc(schema.aiConversations.id))
      : [];
    const aiStatusByLeadId = new Map<string, { id: string; status: string; assignedUserId: string | null }>();
    for (const row of aiConversationRows) {
      if (row.leadId && !aiStatusByLeadId.has(row.leadId)) {
        aiStatusByLeadId.set(row.leadId, {
          id: row.id,
          status: row.status,
          assignedUserId: row.assignedUserId,
        });
      }
    }

    const summaryRows = summaryFilter
      ? asRows(await db.execute(sql`
          with matching as (
            select
              id,
              lead_id,
              client_id,
              phone,
              direction,
              sent_at,
              case
                when lead_id is not null then 'lead:' || lead_id
                else 'phone:' || right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 8)
              end as conversation_key
            from whatsapp_messages
            where ${and(eq(message.tenantId, context.tenantId), conversationMessageVisibilityFilter(context.tenantId), summaryFilter)}
          ), delta_counts as (
            select
              conversation_key,
              count(*) as message_count_delta,
              bool_or(direction not in ('outgoing', 'outbound', 'transition')) as has_incoming_delta
            from matching
            where sent_at > ${cursorAt} or (sent_at = ${cursorAt} and id > ${parsed.data.cursor.id})
            group by conversation_key
          ), latest as (
            select distinct on (conversation_key)
              id,
              lead_id,
              client_id,
              phone,
              direction,
              left(body, 120) as body,
              sent_at,
              case
                when lead_id is not null then 'lead:' || lead_id
                else 'phone:' || right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 8)
              end as conversation_key
            from whatsapp_messages
            where ${and(eq(message.tenantId, context.tenantId), conversationMessageVisibilityFilter(context.tenantId), summaryFilter)}
            order by conversation_key, sent_at desc, id desc
          )
          select latest.*, coalesce(delta_counts.message_count_delta, 0) as message_count_delta,
            coalesce(delta_counts.has_incoming_delta, false) as has_incoming_delta
          from latest
          left join delta_counts using (conversation_key)
        `))
      : [];

    let threadMessages: Array<Record<string, unknown>> = [];
    let threadStatuses: Array<{
      id: string;
      providerStatus: string | null;
      messageId: string | null;
      communicationChannelId: string | null;
      providerFailure?: { code: string; title: string; message: string } | null;
    }> = [];
    let latestInboundChannelId: string | null = null;
    if (openLead || openSyntheticPhone) {
      const openScope = openLead
        ? loadedLeadMessageScope({ message, leads: [{ id: openLead.id, phone: openLead.phone }] })
        : and(isNull(message.leadId), isNull(message.clientId), eq(suffixColumn, openSyntheticPhone!.slice(-8)))!;
      const openCursorMessages = await db.select({
        id: message.id,
        leadId: message.leadId,
        phone: message.phone,
        body: message.body,
        direction: message.direction,
        senderRole: message.senderRole,
        providerStatus: message.providerStatus,
        messageId: message.messageId,
        communicationChannelId: message.communicationChannelId,
        provider: message.provider,
        sentAt: message.sentAt,
        mediaKind: message.mediaKind,
        mediaMimeType: message.mediaMimeType,
        mediaFilename: message.mediaFilename,
        mediaSizeBytes: message.mediaSizeBytes,
        mediaStorageKey: message.mediaStorageKey,
      })
        .from(message)
        .where(and(eq(message.tenantId, context.tenantId), openScope, conversationMessageVisibilityFilter(context.tenantId), afterCursor))
        .orderBy(desc(message.sentAt), desc(message.id))
        .limit(301);
      if (openCursorMessages.length > 300) return withNoStore({ requiresFullRefresh: true, reason: "open_thread_delta_too_large" }, 409);
      threadMessages = openCursorMessages;

      threadStatuses = await db.select({
        id: message.id,
        providerStatus: message.providerStatus,
        messageId: message.messageId,
        communicationChannelId: message.communicationChannelId,
      })
        .from(message)
        .where(and(eq(message.tenantId, context.tenantId), openScope, conversationMessageVisibilityFilter(context.tenantId)))
        .orderBy(desc(message.sentAt), desc(message.id))
        .limit(300);
      const [latestInbound] = await db.select({ communicationChannelId: message.communicationChannelId })
        .from(message)
        .where(and(
          eq(message.tenantId, context.tenantId),
          openScope,
          conversationMessageVisibilityFilter(context.tenantId),
          inArray(message.direction, ["incoming", "inbound"]),
          inArray(message.provider, [META_CLOUD_PROVIDER, "meta_cloud_api"]),
        ))
        .orderBy(desc(message.sentAt), desc(message.id))
        .limit(1);
      latestInboundChannelId = latestInbound?.communicationChannelId ?? null;
    }

    const channels = openLead || openSyntheticPhone
      ? await db.select({
          id: schema.communicationChannels.id,
          displayPhoneNumber: schema.communicationChannels.displayPhoneNumber,
          status: schema.communicationChannels.status,
          registrationStatus: schema.communicationChannels.registrationStatus,
          phoneNumberId: schema.communicationChannels.phoneNumberId,
          hasCredentials: sql<boolean>`${schema.communicationChannels.accessTokenCiphertext} is not null`,
        })
        .from(schema.communicationChannels)
        .where(and(eq(schema.communicationChannels.tenantId, context.tenantId), inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api"])))
      : [];
    const channelLabel = channelLabelOf(channels);
    const channelById = new Map(channels.map((channel) => [channel.id, channel]));
    const sourceChannelFailure = (channelId: string | null) => {
      if (!channelId) return null;
      const channel = channelById.get(channelId);
      if (channel && channel.status === "active" && channel.registrationStatus === "registered" && channel.phoneNumberId && channel.hasCredentials) return null;
      return {
        code: "META_SOURCE_CHANNEL_UNAVAILABLE",
        title: "Número de WhatsApp desconectado",
        message: formatMetaSourceChannelUnavailableMessage(channel),
      };
    };

    const failedMessageEventKeys = context.role === "director"
      ? [...new Set([...threadMessages, ...threadStatuses]
          .filter((row) => row.providerStatus === "failed" || row.providerStatus === "deleted")
          .flatMap((row) => typeof row.messageId === "string" ? [`${row.messageId}:failed`, `${row.messageId}:deleted`] : []))]
      : [];
    const failedDeliveryEvents = failedMessageEventKeys.length
      ? await db.select({
          externalEventId: schema.communicationChannelWebhookEvents.externalEventId,
          errorCode: schema.communicationChannelWebhookEvents.errorCode,
        })
        .from(schema.communicationChannelWebhookEvents)
        .innerJoin(
          schema.communicationChannels,
          eq(schema.communicationChannelWebhookEvents.channelId, schema.communicationChannels.id),
        )
        .where(and(
          eq(schema.communicationChannels.tenantId, context.tenantId),
          inArray(schema.communicationChannelWebhookEvents.externalEventId, failedMessageEventKeys),
        ))
      : [];
    const failureByProviderMessageId = new Map(failedDeliveryEvents.flatMap((event) => {
      if (!event.externalEventId || !event.errorCode) return [];
      const messageId = event.externalEventId.replace(/:(?:failed|deleted)$/, "");
      const failure = getDirectorFacingMetaDeliveryFailure(event.errorCode);
      return failure ? [[messageId, failure] as const] : [];
    }));
    threadStatuses = threadStatuses.map((row) => ({
      ...row,
      providerFailure: (row.messageId ? failureByProviderMessageId.get(row.messageId) : null)
        ?? (row.providerStatus === "failed" ? sourceChannelFailure(row.communicationChannelId) : null),
    }));

    const mappedThreadMessages = threadMessages
      .sort((left, right) => new Date(String(left.sentAt)).getTime() - new Date(String(right.sentAt)).getTime())
      .map((row) => {
        const id = String(row.id);
        const mediaKind = typeof row.mediaKind === "string" ? row.mediaKind : null;
        const hasSupportedMedia = isMediaKindSupported(mediaKind);
        const messageId = typeof row.messageId === "string" ? row.messageId : null;
        const communicationChannelId = typeof row.communicationChannelId === "string" ? row.communicationChannelId : null;
        const providerStatus = typeof row.providerStatus === "string" ? row.providerStatus : null;
        return {
          id,
          leadId: openLead?.id ?? parsed.data.openConversationId!,
          body: String(row.body ?? ""),
          direction: String(row.direction),
          senderRole: typeof row.senderRole === "string" ? row.senderRole : null,
          providerStatus,
          providerFailure: (messageId ? failureByProviderMessageId.get(messageId) : null)
            ?? (providerStatus === "failed" ? sourceChannelFailure(communicationChannelId) : null),
          channelLabel: channelLabel({
            provider: typeof row.provider === "string" ? row.provider : null,
            communicationChannelId,
          }),
          sentAt: new Date(String(row.sentAt)).toISOString(),
          ...(hasSupportedMedia
            ? {
                media: {
                  kind: mediaKind!,
                  mimeType: typeof row.mediaMimeType === "string" ? row.mediaMimeType : null,
                  filename: typeof row.mediaFilename === "string" ? row.mediaFilename : null,
                  sizeBytes: typeof row.mediaSizeBytes === "number" ? row.mediaSizeBytes : null,
                  url: typeof row.mediaStorageKey === "string" ? `/api/conversations/media/${id}` : null,
                },
              }
            : {}),
        };
      });

    const compareLatestFirst = (left: Record<string, unknown>, right: Record<string, unknown>) =>
      new Date(String(right.sent_at)).getTime() - new Date(String(left.sent_at)).getTime()
      || String(right.id).localeCompare(String(left.id));
    const leadUpdates = affectedLeads.flatMap((lead) => {
      const matching = summaryRows.filter((row) =>
        row.lead_id === lead.id || (!row.lead_id && lead.phone && typeof row.phone === "string" && samePhone(row.phone, lead.phone)),
      );
      if (!matching.length) return [];
      const latest = [...matching].sort(compareLatestFirst)[0]!;
      return [{
        id: lead.id,
        latestMessage: {
          body: compactPreview(String(latest.body ?? "")),
          direction: String(latest.direction),
          sentAt: new Date(String(latest.sent_at)).toISOString(),
        },
        messageCountDelta: matching.reduce((sum, row) => sum + Number(row.message_count_delta ?? 0), 0),
        hasIncomingDelta: matching.some((row) => Boolean(row.has_incoming_delta)),
        ...(statusLeadIds.includes(lead.id)
          ? { aiConversationStatus: aiStatusByLeadId.get(lead.id) ?? null }
          : {}),
        ...(lead.id === parsed.data.openConversationId
          ? { replyBlockedMessage: sourceChannelFailure(latestInboundChannelId)?.message ?? null }
          : {}),
        ...(lead.id === parsed.data.openConversationId
          ? {
              messages: mappedThreadMessages,
              messageStatuses: threadStatuses.map(({ id, providerStatus, providerFailure }) => ({
                id,
                providerStatus,
                providerFailure,
              })),
            }
          : {}),
      }];
    });
    const syntheticUpdates = affectedSynthetic.flatMap(({ id, phone }) => {
      const matching = summaryRows.filter((row) =>
        !row.lead_id && !row.client_id && typeof row.phone === "string" && samePhone(row.phone, phone),
      );
      if (!matching.length) return [];
      const latest = [...matching].sort(compareLatestFirst)[0]!;
      return [{
        id,
        latestMessage: {
          body: compactPreview(String(latest.body ?? "")),
          direction: String(latest.direction),
          sentAt: new Date(String(latest.sent_at)).toISOString(),
        },
        messageCountDelta: matching.reduce((sum, row) => sum + Number(row.message_count_delta ?? 0), 0),
        hasIncomingDelta: matching.some((row) => Boolean(row.has_incoming_delta)),
        ...(id === parsed.data.openConversationId
          ? { replyBlockedMessage: sourceChannelFailure(latestInboundChannelId)?.message ?? null }
          : {}),
        ...(id === parsed.data.openConversationId
          ? {
              messages: mappedThreadMessages,
              messageStatuses: threadStatuses.map(({ id: messageId, providerStatus, providerFailure }) => ({
                id: messageId,
                providerStatus,
                providerFailure,
              })),
            }
          : {}),
      }];
    });
    const openConversationId = parsed.data.openConversationId;
    const openThreadStatusUpdate = openConversationId && !affectedIds.has(openConversationId) && (openLead || openSyntheticPhone)
      ? [{
          id: openConversationId,
          ...(openLead && statusLeadIds.includes(openLead.id)
            ? { aiConversationStatus: aiStatusByLeadId.get(openLead.id) ?? null }
            : {}),
          replyBlockedMessage: sourceChannelFailure(latestInboundChannelId)?.message ?? null,
          messages: mappedThreadMessages,
          messageStatuses: threadStatuses.map(({ id, providerStatus, providerFailure }) => ({ id, providerStatus, providerFailure })),
        }]
      : [];

    const lastChanged = changedRows.at(-1);
    const nextCursor = lastChanged
      ? { sentAt: lastChanged.sentAt.toISOString(), id: lastChanged.id }
      : parsed.data.cursor;
    return withNoStore({
      updates: [...leadUpdates, ...syntheticUpdates, ...openThreadStatusUpdate],
      nextCursor,
    });
  } catch (error) {
    console.error("[conversations.incremental] read failed", error);
    return withNoStore({ error: "Não foi possível sincronizar as conversas agora." }, 500);
  }
}
