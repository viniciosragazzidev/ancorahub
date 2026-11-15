import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  selectRows: [] as Array<Array<Record<string, unknown>>>,
  executeRows: [] as Array<Array<Record<string, unknown>>>,
  selectLimits: [] as number[],
  whereConditions: [] as unknown[],
  orderByCalls: [] as unknown[][],
  executeQueries: [] as Array<{ text: string }>,
  context: vi.fn(),
  database: null as unknown,
}));

vi.mock("drizzle-orm", () => {
  const combine = (kind: string) => (...conditions: unknown[]) => {
    const present = conditions.filter((condition) => condition !== undefined);
    return present.length ? { kind, conditions: present } : undefined;
  };
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => ({
    kind: "sql",
    text: strings.reduce((result, part, index) => result + part + (index < values.length ? " $" + (index + 1) + " " : ""), ""),
    values,
  });
  return {
    and: combine("and"),
    or: combine("or"),
    asc: (column: unknown) => ({ kind: "asc", column }),
    desc: (column: unknown) => ({ kind: "desc", column }),
    eq: (left: unknown, right: unknown) => ({ kind: "eq", left, right }),
    gt: (left: unknown, right: unknown) => ({ kind: "gt", left, right }),
    inArray: (column: unknown, values: unknown[]) => ({ kind: "inArray", column, values }),
    isNull: (column: unknown) => ({ kind: "isNull", column }),
    sql,
  };
});

vi.mock("@/shared/db", () => {
  const column = (table: string, name: string) => table + "." + name;
  const schema = {
    whatsappMessages: Object.fromEntries([
      "id", "tenantId", "leadId", "clientId", "phone", "direction", "sentAt", "body", "senderRole",
      "providerStatus", "messageId", "communicationChannelId", "provider", "mediaKind", "mediaMimeType",
      "mediaFilename", "mediaSizeBytes", "mediaStorageKey",
    ].map((name) => [name, column("whatsappMessages", name)])),
    leads: Object.fromEntries(["id", "tenantId", "telefone", "deletedAt", "archivedAt"].map((name) => [name, column("leads", name)])),
    brokerProfiles: { phone: column("brokerProfiles", "phone"), tenantId: column("brokerProfiles", "tenantId") },
    aiConversations: Object.fromEntries(["id", "leadId", "tenantId", "status", "assignedUserId", "updatedAt"].map((name) => [name, column("aiConversations", name)])),
    communicationChannels: Object.fromEntries(["id", "tenantId", "provider", "displayPhoneNumber", "status", "registrationStatus", "phoneNumberId", "accessTokenCiphertext"].map((name) => [name, column("communicationChannels", name)])),
    communicationChannelWebhookEvents: Object.fromEntries(["externalEventId", "errorCode", "channelId"].map((name) => [name, column("communicationChannelWebhookEvents", name)])),
  };
  const database = {
    select: vi.fn(() => {
      const rows = mocks.selectRows.shift() ?? [];
      const query = {
        from: vi.fn(() => query),
        innerJoin: vi.fn(() => query),
        where: vi.fn((condition: unknown) => { mocks.whereConditions.push(condition); return query; }),
        orderBy: vi.fn((...args: unknown[]) => { mocks.orderByCalls.push(args); return query; }),
        limit: vi.fn((limit: number) => { mocks.selectLimits.push(limit); return Promise.resolve(rows); }),
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
      };
      return query;
    }),
    execute: vi.fn(async (query: { text: string }) => {
      mocks.executeQueries.push(query);
      return { rows: mocks.executeRows.shift() ?? [] };
    }),
  };
  mocks.database = database;
  return { getDatabase: () => database, schema };
});

vi.mock("@/features/conversations/lead-scope", () => ({ buildConversationLeadScope: vi.fn(() => ({ kind: "lead-scope" })) }));
vi.mock("@/features/conversations/message-index-query", () => ({ conversationMessageVisibilityFilter: vi.fn(() => ({ kind: "visible-messages" })) }));
vi.mock("@/features/conversations/media-kinds", () => ({ isMediaKindSupported: vi.fn(() => false) }));
vi.mock("@/features/communication-channels/conversation-classification", () => ({ shouldCreateSyntheticCustomerConversation: vi.fn(() => false) }));
vi.mock("@/features/communication-channels/service", () => ({
  samePhone: (left: string, right: string) => left.replace(/\D/g, "").slice(-8) === right.replace(/\D/g, "").slice(-8),
}));
vi.mock("@/features/communication-channels/types", () => ({ META_CLOUD_PROVIDER: "meta_cloud_api" }));
vi.mock("@/features/communication-channels/meta-channel-routing-domain", () => ({ formatMetaSourceChannelUnavailableMessage: vi.fn(() => "Canal indisponível") }));
vi.mock("@/features/communication-channels/meta-delivery-failure", () => ({ getDirectorFacingMetaDeliveryFailure: vi.fn(() => null) }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context }));
vi.mock("@/shared/auth/permissions", () => ({ hasPermission: vi.fn(() => true) }));

import { POST } from "./route";

const cursor = () => ({ sentAt: new Date(Date.now() - 30_000).toISOString(), id: "m-10" });
const lead = { id: "lead-1", phone: "+55 21 99999-1234" };
const changed = (overrides: Record<string, unknown> = {}) => ({
  id: "m-11",
  leadId: "lead-1",
  clientId: null,
  phone: lead.phone,
  direction: "incoming",
  sentAt: new Date(Date.now() - 10_000),
  ...overrides,
});
const summary = (overrides: Record<string, unknown> = {}) => ({
  id: "m-11",
  lead_id: "lead-1",
  client_id: null,
  phone: lead.phone,
  direction: "incoming",
  body: "Nova mensagem",
  sent_at: new Date(Date.now() - 10_000),
  conversation_key: "lead:lead-1",
  message_count_delta: 1,
  has_incoming_delta: true,
  ...overrides,
});
const request = (body: Record<string, unknown>) => new NextRequest("http://localhost/api/conversations/incremental", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ cursor: cursor(), conversationIds: ["lead-1"], openConversationId: null, ...body }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.selectRows = [];
  mocks.executeRows = [];
  mocks.selectLimits = [];
  mocks.whereConditions = [];
  mocks.orderByCalls = [];
  mocks.executeQueries = [];
  mocks.context.mockResolvedValue({ tenantId: "tenant-1", userId: "director-1", role: "director" });
});

function containsNode(value: unknown, predicate: (node: Record<string, unknown>) => boolean): boolean {
  if (!value || typeof value !== "object") return false;
  const node = value as Record<string, unknown>;
  if (predicate(node)) return true;
  return Object.values(node).some((child) => Array.isArray(child)
    ? child.some((item) => containsNode(item, predicate))
    : containsNode(child, predicate));
}

describe("POST /api/conversations/incremental", () => {
  it("does not associate a linked message from another lead by matching phone suffix", async () => {
    mocks.selectRows = [[lead], [changed({ id: "foreign-message", leadId: "lead-other" })]];

    const response = await POST(request({}));
    const payload = await response.json() as { updates: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.updates).toEqual([]);
    expect(mocks.executeQueries).toHaveLength(0);
    expect(containsNode(mocks.whereConditions[1], (node) => node.kind === "isNull" && node.column === "whatsappMessages.leadId")).toBe(true);
  });

  it("uses id as the cursor tie-breaker for messages with the same sent_at", async () => {
    mocks.selectRows = [[lead], []];

    const response = await POST(request({}));

    expect(response.status).toBe(200);
    expect(containsNode(mocks.whereConditions[1], (node) => node.kind === "gt" && node.left === "whatsappMessages.id" && node.right === "m-10")).toBe(true);
  });

  it("truncates microseconds to milliseconds for comparisons, ordering and delta counts", async () => {
    mocks.selectRows = [[lead], [changed()], [{ id: "ai-1", leadId: "lead-1", status: "AI_ACTIVE", assignedUserId: null }]];
    mocks.executeRows = [[summary()]];

    const response = await POST(request({}));
    const deltaQuery = mocks.executeQueries[0]!.text;
    const messageOrder = mocks.orderByCalls.find((args) => args.some((arg) =>
      (arg as { kind?: string; column?: { kind?: string; text?: string } }).kind === "asc"
      && (arg as { column?: { text?: string } }).column?.text?.includes("date_trunc('milliseconds'"),
    ));

    expect(response.status).toBe(200);
    expect(containsNode(mocks.whereConditions[1], (node) =>
      node.kind === "gt"
      && Boolean(node.left && typeof node.left === "object"
        && String((node.left as { text?: string }).text).includes("date_trunc('milliseconds'")),
    )).toBe(true);
    expect(messageOrder).toBeDefined();
    expect((messageOrder?.[1] as { column?: unknown })?.column).toBe("whatsappMessages.id");
    expect(deltaQuery).toContain("date_trunc('milliseconds', sent_at) >");
    expect(deltaQuery).toContain("date_trunc('milliseconds', sent_at) =");
    expect(deltaQuery).toContain("id >");
  });

  it("returns the bounded fallback when more than 500 messages are behind the cursor", async () => {
    mocks.selectRows = [[lead], Array.from({ length: 501 }, (_, index) => changed({ id: "m-" + index }))];

    const response = await POST(request({}));
    const payload = await response.json() as { requiresFullRefresh?: boolean; reason?: string };

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ requiresFullRefresh: true, reason: "delta_too_large" });
    expect(mocks.selectLimits).toContain(501);
  });

  it("returns the bounded fallback when more than 300 messages are in the open thread delta", async () => {
    mocks.selectRows = [
      [lead],
      [changed()],
      [],
      Array.from({ length: 301 }, (_, index) => ({ id: "thread-" + index })),
    ];
    mocks.executeRows = [[summary()]];

    const response = await POST(request({ openConversationId: "lead-1" }));
    const payload = await response.json() as { requiresFullRefresh?: boolean; reason?: string };

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ requiresFullRefresh: true, reason: "open_thread_delta_too_large" });
    expect(mocks.selectLimits).toContain(301);
  });

  it("rejects an expired cursor before querying messages", async () => {
    const response = await POST(request({ cursor: { sentAt: new Date(Date.now() - 3 * 60_000).toISOString(), id: "old" } }));
    const payload = await response.json() as { requiresFullRefresh?: boolean; reason?: string };

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ requiresFullRefresh: true, reason: "cursor_expired" });
    expect((mocks.database as { select: ReturnType<typeof vi.fn> }).select).not.toHaveBeenCalled();
  });

  it("keeps the milliseconds of sent_at in the response (cursor is in ms)", async () => {
    const sentAt = new Date(Date.now() - 10_000);
    sentAt.setMilliseconds(123);
    mocks.selectRows = [[lead], [changed({ sentAt })], []];
    mocks.executeRows = [[summary({ sent_at: sentAt })]];

    const response = await POST(request({}));
    const payload = await response.json() as { updates: Array<{ latestMessage?: { sentAt: string } }> };

    expect(response.status).toBe(200);
    expect(payload.updates[0]?.latestMessage?.sentAt).toBe(sentAt.toISOString());
    expect(payload.updates[0]?.latestMessage?.sentAt).toMatch(/.123Z$/);
  });

  it("returns one truncated latest preview and aggregate cursor increments, plus AI status columns", async () => {
    mocks.selectRows = [[lead], [changed()], [{ id: "ai-1", leadId: "lead-1", status: "HUMAN_ACTIVE", assignedUserId: "broker-1" }]];
    mocks.executeRows = [[summary({ body: "x".repeat(120) })]];

    const response = await POST(request({}));
    const payload = await response.json() as { updates: Array<Record<string, unknown>> };
    const update = payload.updates[0]!;
    const queryText = mocks.executeQueries[0]!.text;

    expect(response.status).toBe(200);
    expect(update).toMatchObject({
      id: "lead-1",
      messageCountDelta: 1,
      hasIncomingDelta: true,
      aiConversationStatus: { id: "ai-1", status: "HUMAN_ACTIVE", assignedUserId: "broker-1" },
      latestMessage: { body: "x".repeat(80) + "..." },
    });
    expect(update).not.toHaveProperty("messageCount");
    expect(update).not.toHaveProperty("hasIncoming");
    expect(queryText).toContain("count(*) as message_count_delta");
    expect(queryText).toContain("bool_or(direction not in");
    expect(queryText).toContain("select distinct on (conversation_key)");
    expect(queryText).toContain("left(body, 120) as body");
    expect(queryText.slice(0, queryText.indexOf("), delta_counts"))).not.toMatch(/\bbody\b/);
  });

  it("returns an AI status change for a loaded lead even when no message changed", async () => {
    const currentCursor = cursor();
    mocks.selectRows = [
      [lead],
      [],
      [{
        id: "ai-1",
        leadId: "lead-1",
        status: "WAITING_HUMAN",
        assignedUserId: "broker-1",
        updatedAfterCursor: true,
      }],
    ];

    const response = await POST(request({ cursor: currentCursor }));
    const payload = await response.json() as { updates: Array<Record<string, unknown>> };

    expect(response.status).toBe(200);
    expect(payload.updates).toEqual([{
      id: "lead-1",
      aiConversationStatus: { id: "ai-1", status: "WAITING_HUMAN", assignedUserId: "broker-1" },
    }]);
    expect(payload.updates[0]).not.toHaveProperty("messageCountDelta");
    expect(containsNode(mocks.whereConditions, (node) => node.kind === "gt" && node.left === "aiConversations.updatedAt")).toBe(true);
  });
});
