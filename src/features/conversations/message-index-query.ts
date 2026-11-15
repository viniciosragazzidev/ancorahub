import { and, eq, sql, type SQL } from "drizzle-orm";

import { notStatusBroadcastSql } from "./status-broadcast";
import { schema } from "@/shared/db";

const RECENT_GLOBAL_MESSAGE_LIMIT = 2_000;
const LOADED_MESSAGE_LIMIT = { filtered: 2_000, unfiltered: 4_000 } as const;

/** Shared visibility filters for both the initial SQL preview and incremental reads. */
export function conversationMessageVisibilityFilter(tenantId: string) {
  const message = schema.whatsappMessages;
  return and(
    eq(message.tenantId, tenantId),
    notStatusBroadcastSql(message.messageId),
    sql`not (${message.mediaKind} is null and lower(trim(coalesce(${message.body}, ''))) in ('', '[text]'))`,
    sql`not (
      ${message.leadId} is null and ${message.clientId} is null and exists (
        select 1 from communication_channels history_channel
        where history_channel.id = ${message.communicationChannelId}
          and history_channel.tenant_id = ${message.tenantId}
          and history_channel.onboarding_mode = 'coexistence'
          and history_channel.activated_at is not null
          and ${message.sentAt} < history_channel.activated_at
      )
    )`,
  )!;
}

/**
 * Compact list read for /conversas. SQL folds the global recent window and all
 * messages tied to the already scoped lead set into one row per chat, retaining
 * only an 80-character preview. Full bodies and media are fetched for the open
 * thread only.
 */
export function buildConversationMessageIndexQuery(input: {
  tenantId: string;
  loadedLeadScope: SQL;
  includeGlobalRecent: boolean;
  loadedMessageLimit: 2_000 | 4_000;
  coexChannelIds: string[];
}) {
  const message = schema.whatsappMessages;
  const filters = conversationMessageVisibilityFilter(input.tenantId);
  const recentFilters = input.includeGlobalRecent ? filters : sql`false`;
  const loadedMessageLimit = input.loadedMessageLimit === LOADED_MESSAGE_LIMIT.filtered
    ? LOADED_MESSAGE_LIMIT.filtered
    : LOADED_MESSAGE_LIMIT.unfiltered;
  const coexChannelIds = input.coexChannelIds.length
    ? sql`communication_channel_id in (${sql.join(input.coexChannelIds.map((id) => sql`${id}`), sql`, `)})`
    : sql`false`;

  return sql`
    with recent_global as (
      select
        id,
        lead_id,
        client_id,
        phone,
        direction,
        provider,
        case when length(coalesce(body, '')) > 80 then left(body, 80) || '...' else coalesce(body, '') end as preview_body,
        sent_at,
        communication_channel_id,
        case
          when lead_id is not null then 'lead:' || lead_id
          else 'phone:' || regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
        end as conversation_key
      from whatsapp_messages
      where ${recentFilters}
      order by sent_at desc, id desc
      limit ${RECENT_GLOBAL_MESSAGE_LIMIT}
    ), loaded_visible as (
      select
        id,
        lead_id,
        client_id,
        phone,
        direction,
        provider,
        case when length(coalesce(body, '')) > 80 then left(body, 80) || '...' else coalesce(body, '') end as preview_body,
        sent_at,
        communication_channel_id,
        case
          when lead_id is not null then 'lead:' || lead_id
          else 'phone:' || regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
        end as conversation_key
      from whatsapp_messages
      where ${filters} and (${input.loadedLeadScope})
      order by sent_at desc, id desc
      limit ${loadedMessageLimit}
    ), candidates as (
      select * from recent_global
      union
      select * from loaded_visible
    ), ranked as (
      select
        candidates.*,
        count(*) over (partition by conversation_key) as conversation_message_count,
        bool_or(direction not in ('outgoing', 'outbound', 'transition')) over (partition by conversation_key) as conversation_has_incoming,
        bool_or(${coexChannelIds}) over (partition by conversation_key) as conversation_has_coex,
        row_number() over (partition by conversation_key order by sent_at desc, id desc) as preview_rank
      from candidates
      where lead_id is not null or length(right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 8)) = 8
    ), inbound_ranked as (
      select
        conversation_key,
        communication_channel_id,
        sent_at,
        row_number() over (partition by conversation_key order by sent_at desc, id desc) as inbound_rank
      from candidates
      where direction in ('incoming', 'inbound') and provider in ('meta_cloud', 'meta_cloud_api')
    ), latest_candidate_cursor as (
      select date_trunc('milliseconds', sent_at) as sent_at, id
      from candidates
      where lead_id is not null or length(right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 8)) = 8
      order by date_trunc('milliseconds', sent_at) desc, id desc
      limit 1
    ), snapshot_cursor as (
      select sent_at, id from latest_candidate_cursor
      union all
      select date_trunc('milliseconds', statement_timestamp()), ''::text
      where not exists (select 1 from latest_candidate_cursor)
    ), ranked_preview as (
      select * from ranked where preview_rank = 1
    )
    select ranked_preview.id, ranked_preview.lead_id, ranked_preview.client_id, ranked_preview.phone,
      ranked_preview.direction, ranked_preview.provider, ranked_preview.preview_body, ranked_preview.sent_at,
      ranked_preview.communication_channel_id, ranked_preview.conversation_key,
      ranked_preview.conversation_message_count, ranked_preview.conversation_has_incoming, ranked_preview.conversation_has_coex,
      inbound_ranked.communication_channel_id as latest_inbound_channel_id,
      inbound_ranked.sent_at as latest_inbound_at,
      snapshot_cursor.sent_at as snapshot_cursor_sent_at, snapshot_cursor.id as snapshot_cursor_id
    from snapshot_cursor
    left join ranked_preview on true
    left join inbound_ranked on inbound_ranked.conversation_key = ranked_preview.conversation_key and inbound_ranked.inbound_rank = 1
    order by ranked_preview.sent_at desc nulls last, ranked_preview.id desc nulls last
  `;
}

export function mapConversationMessageIndexResult(value: unknown) {
  const rawRows = Array.isArray(value) ? value : (value as { rows?: unknown[] } | null)?.rows ?? [];
  let cursor: { sentAt: string; id: string } | null = null;
  const rows = rawRows.flatMap((value) => {
    const row = value as Record<string, unknown>;
    if (row.snapshot_cursor_sent_at != null) {
      const sentAt = row.snapshot_cursor_sent_at instanceof Date
        ? row.snapshot_cursor_sent_at
        : new Date(String(row.snapshot_cursor_sent_at));
      if (Number.isFinite(sentAt.getTime())) {
        cursor = { sentAt: sentAt.toISOString(), id: String(row.snapshot_cursor_id ?? "") };
      }
    }
    // snapshot_cursor emits one metadata-only row when the index has no messages.
    if (row.id == null) return [];
    return [mapConversationMessageIndexRow(row)];
  });
  return { rows, cursor };
}

export function mapConversationMessageIndexRows(value: unknown) {
  return mapConversationMessageIndexResult(value).rows;
}

function mapConversationMessageIndexRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    leadId: typeof row.lead_id === "string" ? row.lead_id : null,
    clientId: typeof row.client_id === "string" ? row.client_id : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    direction: String(row.direction),
    provider: typeof row.provider === "string" ? row.provider : null,
    previewBody: typeof row.preview_body === "string" ? row.preview_body : "",
    sentAt: row.sent_at instanceof Date ? row.sent_at : new Date(String(row.sent_at)),
    communicationChannelId: typeof row.communication_channel_id === "string" ? row.communication_channel_id : null,
    latestInboundChannelId: typeof row.latest_inbound_channel_id === "string" ? row.latest_inbound_channel_id : null,
    latestInboundAt: row.latest_inbound_at instanceof Date ? row.latest_inbound_at : row.latest_inbound_at ? new Date(String(row.latest_inbound_at)) : null,
    conversationKey: String(row.conversation_key),
    conversationMessageCount: Number(row.conversation_message_count),
    conversationHasIncoming: Boolean(row.conversation_has_incoming),
    conversationHasCoex: row.conversation_has_coex === true || row.conversation_has_coex === "true" || row.conversation_has_coex === "t",
  };
}
