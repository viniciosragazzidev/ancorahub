import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import { schema } from "@/shared/db";
import { loadedLeadMessageScope } from "./loaded-lead-message-scope";
import { buildConversationMessageIndexQuery, conversationMessageVisibilityFilter, mapConversationMessageIndexRows } from "./message-index-query";

describe("SQL index of conversation previews", () => {
  it("applies the same tenant, Status, placeholder and coexistence-history filters to every read", () => {
    const query = new PgDialect().sqlToQuery(conversationMessageVisibilityFilter("tenant-a"));
    expect(query.sql).toContain('"whatsapp_messages"."tenant_id"');
    expect(query.sql).toContain("not ilike");
    expect(query.params).toContain("%status@broadcast%");
    expect(query.sql).toContain("'[text]'");
    expect(query.sql).toContain("history_channel.onboarding_mode = 'coexistence'");
    expect(query.sql).toContain('history_channel.tenant_id = "whatsapp_messages"."tenant_id"');
    expect(query.sql).toContain("history_channel.activated_at");
    expect(query.params).toContain("tenant-a");
  });

  it("returns one latest index row and counters per conversation for the tenant-visible leads", () => {
    const query = new PgDialect().sqlToQuery(buildConversationMessageIndexQuery({
      tenantId: "tenant-a",
      loadedLeadScope: loadedLeadMessageScope({
        message: schema.whatsappMessages,
        leads: [{ id: "lead-a", phone: "+55 (11) 99999-1234" }],
      }),
      includeGlobalRecent: true,
      loadedMessageLimit: 4_000,
      coexChannelIds: ["coex-a"],
    }));

    expect(query.sql).toContain("with recent_global as");
    expect(query.sql).toContain("limit");
    expect(query.sql).toContain("union");
    expect(query.sql).toContain("row_number() over (partition by conversation_key");
    expect(query.sql).toContain("count(*) over (partition by conversation_key)");
    expect(query.sql).toContain("bool_or(direction not in ('outgoing', 'outbound', 'transition'))");
    expect(query.sql).toContain("bool_or(communication_channel_id in");
    expect(query.sql).toContain("inbound_ranked");
    expect(query.sql).toContain("left(body, 80) || '...' else coalesce(body, '') end as preview_body");
    expect(query.sql).toContain("where preview_rank = 1");
    expect(query.sql).not.toMatch(/select\s+.*body/i);
    expect(query.sql).toContain("not ilike");
    expect(query.sql).toContain("'[text]'");
    expect(query.sql).toContain("history_channel.onboarding_mode = 'coexistence'");
    expect(query.params).toEqual(expect.arrayContaining(["tenant-a", "lead-a", "99991234", "coex-a"]));
  });

  it("keeps filtered server views within their own loaded leads and the old 2k bound", () => {
    const query = new PgDialect().sqlToQuery(buildConversationMessageIndexQuery({
      tenantId: "tenant-a",
      loadedLeadScope: loadedLeadMessageScope({ message: schema.whatsappMessages, leads: [{ id: "lead-a", phone: "5511999991234" }] }),
      includeGlobalRecent: false,
      loadedMessageLimit: 2_000,
      coexChannelIds: [],
    }));
    expect(query.sql).toContain("where false");
    expect(query.params).toContain(2_000);
    expect(query.params).not.toContain(4_000);
  });

  it("maps the compact Postgres row into the index shape, including SQL counters", () => {
    expect(mapConversationMessageIndexRows({ rows: [{
      id: "message-a",
      lead_id: "lead-a",
      client_id: null,
      phone: "5511999991234",
      direction: "inbound",
      provider: "meta_cloud",
      preview_body: "preview",
      sent_at: "2026-11-14T12:00:00.000Z",
      communication_channel_id: "channel-a",
      latest_inbound_channel_id: "channel-a",
      latest_inbound_at: "2026-11-14T11:59:00.000Z",
      conversation_key: "lead:lead-a",
      conversation_message_count: "9",
      conversation_has_incoming: true,
      conversation_has_coex: false,
    }] })).toEqual([{
      id: "message-a",
      leadId: "lead-a",
      clientId: null,
      phone: "5511999991234",
      direction: "inbound",
      provider: "meta_cloud",
      previewBody: "preview",
      sentAt: new Date("2026-11-14T12:00:00.000Z"),
      communicationChannelId: "channel-a",
      latestInboundChannelId: "channel-a",
      latestInboundAt: new Date("2026-11-14T11:59:00.000Z"),
      conversationKey: "lead:lead-a",
      conversationMessageCount: 9,
      conversationHasIncoming: true,
      conversationHasCoex: false,
    }]);
  });
});
