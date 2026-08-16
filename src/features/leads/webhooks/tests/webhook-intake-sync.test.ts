import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const schema = { webhookDeliveries: Symbol("deliveries"), leads: Symbol("leads"), leadInteractions: Symbol("interactions"), auditLogs: Symbol("audit"), leadDistributionEvents: Symbol("events") };
  const inserts: Array<{ table: symbol; values: Record<string, unknown> }> = [];
  const updates: Array<{ table: symbol; values: Record<string, unknown> }> = [];
  const createQueryMock = () => Object.assign(Promise.resolve([]), { limit: vi.fn(async () => []) });
  const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => createQueryMock()) })) }));
  const db = {
    insert: vi.fn((table: symbol) => ({ values: vi.fn((values: Record<string, unknown>) => {
      inserts.push({ table, values });
      return { onConflictDoNothing: () => ({ returning: async () => [{ id: "reserved" }] }), then: (resolve: (value: undefined) => unknown) => Promise.resolve(undefined).then(resolve) };
    }) })),
    update: vi.fn((table: symbol) => ({ set: vi.fn((values: Record<string, unknown>) => ({ where: vi.fn(async () => { updates.push({ table, values }); }) })) })),
    select,
    transaction: vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)),
  };
  return { schema, inserts, updates, db, select, resolveIdempotency: vi.fn(), resolveBranch: vi.fn(), enqueueTx: vi.fn(), enqueue: vi.fn() };
});

vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.schema }));
vi.mock("drizzle-orm", () => ({ and: vi.fn(() => "and"), eq: vi.fn(() => "eq"), isNull: vi.fn(() => "isNull") }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: vi.fn(async () => "false") }));
vi.mock("@/features/ai-qualification/service", () => ({ startAiQualificationForLead: vi.fn() }));
vi.mock("@/features/leads/webhooks/services/lead-effect-outbox", () => ({ enqueueLeadEffectTx: state.enqueueTx, enqueueLeadEffect: state.enqueue }));
vi.mock("@/features/leads/webhooks/services/resolve-lead-webhook-idempotency", () => ({ resolveLeadWebhookIdempotency: state.resolveIdempotency }));
vi.mock("@/features/leads/webhooks/services/resolve-webhook-branch", () => ({ resolveWebhookBranch: state.resolveBranch, WebhookBranchNotFoundError: class WebhookBranchNotFoundError extends Error {} }));

import { createLeadFromWebhookSync } from "../services/create-lead-from-webhook-sync";

const input = { tenantId: "tenant-a", branchId: "branch-a", credentialId: "credential-a", createdByUserId: "director-a", idempotencyKey: "delivery-a", requestMetadata: { requestId: "request-a", userAgent: "test", receivedAt: new Date("2026-07-20T12:00:00Z") } };
const payload = { nome: " Maria da Silva ", telefone: "+55 (11) 99999-9999", email: " MARIA@EXAMPLE.COM " };

function inserted(table: symbol) { return state.inserts.filter((item) => item.table === table).map((item) => item.values); }

describe("createLeadFromWebhookSync", () => {
  beforeEach(() => { vi.clearAllMocks(); state.inserts.length = 0; state.updates.length = 0; state.resolveIdempotency.mockResolvedValue({ status: "new" }); });

  it("commits lead, audit, timeline, distribution event and effects without calling providers", async () => {
    const result = await createLeadFromWebhookSync({ ...input, payload });
    expect(result).toMatchObject({ success: true, duplicate: false });
    expect(inserted(state.schema.leads)).toEqual([expect.objectContaining({ tenantId: "tenant-a", branchId: "branch-a", corretorId: null, nome: "Maria da Silva", telefone: "+5511999999999", distributionStatus: "queued" })]);
    expect(inserted(state.schema.auditLogs)).toHaveLength(1);
    expect(inserted(state.schema.leadInteractions)).toHaveLength(1);
    expect(inserted(state.schema.leadDistributionEvents)).toEqual([expect.objectContaining({ action: "queued", strategy: "outbox" })]);
    expect(state.enqueueTx).toHaveBeenCalledTimes(2);
  });

  it("returns the existing lead before creating effects on a replay", async () => {
    state.resolveIdempotency.mockResolvedValue({ status: "replay", leadId: "lead-existing" });
    await expect(createLeadFromWebhookSync({ ...input, payload })).resolves.toEqual({ success: true, leadId: "lead-existing", duplicate: true });
    expect(state.inserts).toHaveLength(0);
  });

  it("rejects a reused key with different content", async () => {
    state.resolveIdempotency.mockResolvedValue({ status: "conflict" });
    await expect(createLeadFromWebhookSync({ ...input, payload })).resolves.toEqual({ success: false, code: "IDEMPOTENCY_CONFLICT" });
  });

  it("silently discards honeypot input", async () => {
    await expect(createLeadFromWebhookSync({ ...input, payload: { ...payload, website: "bot" } })).resolves.toEqual({ success: true, leadId: "honeypot-discarded", duplicate: false });
    expect(state.inserts).toHaveLength(0);
  });
});
