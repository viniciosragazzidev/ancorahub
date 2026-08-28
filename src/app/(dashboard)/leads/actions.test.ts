import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const schema = {
    leads: Symbol("leads"),
    aiConversations: Symbol("aiConversations"),
    auditLogs: Symbol("auditLogs"),
  };
  const updates: Array<{ table: symbol; values: Record<string, unknown> }> = [];
  const inserts: Array<{ table: symbol; values: Record<string, unknown> }> = [];
  const db = {
    select: vi.fn(),
    update: vi.fn((table: symbol) => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          updates.push({ table, values });
        }),
      })),
    })),
    insert: vi.fn((table: symbol) => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        inserts.push({ table, values });
      }),
    })),
    transaction: vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)),
  };

  return {
    db,
    inserts,
    mockTenantContext: { tenantId: "tenant-test", userId: "director-test", role: "director" as const },
    schema,
    updates,
  };
});

vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.schema }));
vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: () => Promise.resolve(state.mockTenantContext),
}));
vi.mock("@/features/leads/publish-lead-invalidation", () => ({
  publishLeadInvalidation: vi.fn(() => Promise.resolve()),
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((field: unknown, value: unknown) => ({ field, value })),
  isNull: vi.fn((field: unknown) => ({ field, null: true })),
}));

import { deleteLeadAction } from "./actions";

function formData(leadId = "00000000-0000-4000-8000-000000000001") {
  const data = new FormData();
  data.set("leadId", leadId);
  return data;
}

describe("deleteLeadAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.inserts.length = 0;
    state.updates.length = 0;
    state.mockTenantContext.role = "director";
    state.db.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: "lead-test" }]) })),
      })),
    });
  });

  it("returns a completed mutation so the confirmation dialog can reset before navigating", async () => {
    await expect(deleteLeadAction({}, formData())).resolves.toMatchObject({
      success: true,
      mutationId: expect.any(String),
    });
    expect(state.updates.map((update) => update.table)).toEqual(
      expect.arrayContaining([state.schema.leads, state.schema.aiConversations]),
    );
    expect(state.inserts).toHaveLength(1);
  });

  it("keeps a client-readable error when the lead is already absent", async () => {
    state.db.select.mockReturnValue({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => []) })) })),
    });

    await expect(deleteLeadAction({}, formData())).resolves.toMatchObject({
      error: "Este lead já não está disponível.",
      mutationId: expect.any(String),
    });
  });
});
