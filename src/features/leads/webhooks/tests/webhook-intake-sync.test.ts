import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const schema = {
    webhookDeliveries: Symbol("webhookDeliveries"),
    leads: Symbol("leads"),
    leadInteractions: Symbol("leadInteractions"),
    auditLogs: Symbol("auditLogs"),
  };
  const inserts: Array<{ table: symbol; values: Record<string, unknown> }> = [];
  const updates: Array<{ table: symbol; values: Record<string, unknown> }> = [];
  const db = {
    insert: vi.fn((table: symbol) => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        inserts.push({ table, values });
      }),
    })),
    update: vi.fn((table: symbol) => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          updates.push({ table, values });
        }),
      })),
    })),
    transaction: vi.fn(async (callback: (transaction: typeof db) => Promise<unknown>) => callback(db)),
  };
  const chooseAvailableBroker = vi.fn();
  const resolveLeadWebhookIdempotency = vi.fn();
  const resolveWebhookBranch = vi.fn();
  const notifyLeadArrived = vi.fn();
  const notifyNewLead = vi.fn();
  class WebhookBranchNotFoundError extends Error {}

  return {
    schema,
    inserts,
    updates,
    db,
    chooseAvailableBroker,
    resolveLeadWebhookIdempotency,
    resolveWebhookBranch,
    notifyLeadArrived,
    notifyNewLead,
    WebhookBranchNotFoundError,
  };
});

vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.schema }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(() => "where") }));
vi.mock("@/features/leads/assignment", () => ({ chooseAvailableBroker: state.chooseAvailableBroker }));
vi.mock("@/features/notifications/send-push-helper", () => ({
  notifyLeadArrived: state.notifyLeadArrived,
  notifyNewLead: state.notifyNewLead,
}));
vi.mock("@/features/leads/webhooks/services/resolve-lead-webhook-idempotency", () => ({
  resolveLeadWebhookIdempotency: state.resolveLeadWebhookIdempotency,
}));
vi.mock("@/features/leads/webhooks/services/resolve-webhook-branch", () => ({
  resolveWebhookBranch: state.resolveWebhookBranch,
  WebhookBranchNotFoundError: state.WebhookBranchNotFoundError,
}));

import { createLeadFromWebhookSync } from "../services/create-lead-from-webhook-sync";

const input = {
  tenantId: "tenant-a",
  branchId: "branch-a",
  credentialId: "credential-a",
  createdByUserId: "director-a",
  idempotencyKey: "delivery-a",
  requestMetadata: { requestId: "request-a", userAgent: "test", receivedAt: new Date("2026-07-20T12:00:00Z") },
};

const payload = { nome: " Maria da Silva ", telefone: "+55 (11) 99999-9999", email: " MARIA@EXAMPLE.COM " };

function inserted(table: symbol) {
  return state.inserts.filter((item) => item.table === table).map((item) => item.values);
}

describe("createLeadFromWebhookSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.inserts.length = 0;
    state.updates.length = 0;
    state.resolveLeadWebhookIdempotency.mockResolvedValue({ status: "new" });
    state.resolveWebhookBranch.mockResolvedValue("default-branch");
    state.chooseAvailableBroker.mockResolvedValue("broker-a");
    state.notifyLeadArrived.mockResolvedValue(undefined);
    state.notifyNewLead.mockResolvedValue(undefined);
  });

  it("persists a credential-scoped unit lead with normalized contact data and an audit trail", async () => {
    const result = await createLeadFromWebhookSync({ ...input, payload });

    expect(result).toMatchObject({ success: true, duplicate: false });
    expect(state.resolveWebhookBranch).not.toHaveBeenCalled();
    expect(state.chooseAvailableBroker).toHaveBeenCalledWith("tenant-a", "branch-a", undefined, "credential-a");

    expect(inserted(state.schema.leads)).toEqual([expect.objectContaining({
      tenantId: "tenant-a",
      branchId: "branch-a",
      corretorId: "broker-a",
      nome: "Maria da Silva",
      telefone: "+5511999999999",
      email: "maria@example.com",
      distributionStatus: "assigned",
      webhookCredentialId: "credential-a",
    })]);
    expect(inserted(state.schema.auditLogs)).toEqual([expect.objectContaining({ acao: "lead.webhook.received" })]);
    expect(inserted(state.schema.leadInteractions)).toHaveLength(1);
    expect(state.updates).toEqual([expect.objectContaining({ table: state.schema.webhookDeliveries, values: expect.objectContaining({ status: "processed" }) })]);
  });

  it("records a unit lead as queued when no broker is eligible and keeps it recoverable", async () => {
    state.chooseAvailableBroker.mockResolvedValue(null);

    const result = await createLeadFromWebhookSync({ ...input, payload });

    expect(result).toMatchObject({ success: true, duplicate: false });
    expect(inserted(state.schema.leads)).toEqual([expect.objectContaining({
      branchId: "branch-a",
      corretorId: null,
      status: "new",
      distributionStatus: "queued",
    })]);
  });

  it("uses the current default-branch fallback when a credential has no unit", async () => {
    const result = await createLeadFromWebhookSync({ ...input, branchId: null, payload });

    expect(result).toMatchObject({ success: true, duplicate: false });
    expect(state.resolveWebhookBranch).toHaveBeenCalledWith("tenant-a", null);
    expect(inserted(state.schema.leads)).toEqual([expect.objectContaining({ branchId: "default-branch" })]);
  });

  it("returns a replay without creating a second lead", async () => {
    state.resolveLeadWebhookIdempotency.mockResolvedValue({ status: "replay", leadId: "lead-existing" });

    await expect(createLeadFromWebhookSync({ ...input, payload })).resolves.toEqual({ success: true, leadId: "lead-existing", duplicate: true });
    expect(state.inserts).toHaveLength(0);
  });

  it("rejects a reused idempotency key with different content without persisting a lead", async () => {
    state.resolveLeadWebhookIdempotency.mockResolvedValue({ status: "conflict" });

    await expect(createLeadFromWebhookSync({ ...input, payload })).resolves.toEqual({ success: false, code: "IDEMPOTENCY_CONFLICT" });
    expect(state.inserts).toHaveLength(0);
  });

  it("silently discards a honeypot submission before persistence", async () => {
    await expect(createLeadFromWebhookSync({ ...input, payload: { ...payload, website: "bot" } })).resolves.toEqual({ success: true, leadId: "honeypot-discarded", duplicate: false });
    expect(state.inserts).toHaveLength(0);
    expect(state.chooseAvailableBroker).not.toHaveBeenCalled();
  });

  it("records an invalid payload as a rejected delivery", async () => {
    await expect(createLeadFromWebhookSync({ ...input, payload: { nome: "A", telefone: "123" } })).resolves.toMatchObject({ success: false, code: "INVALID_PAYLOAD" });
    expect(inserted(state.schema.webhookDeliveries)).toEqual([expect.objectContaining({ status: "rejected", errorCode: "INVALID_PAYLOAD" })]);
  });
});
