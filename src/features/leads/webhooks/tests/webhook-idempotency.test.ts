import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const schema = {
    webhookDeliveries: { id: Symbol("deliveryId"), leadId: Symbol("deliveryLeadId"), payloadHash: Symbol("payloadHash"), credentialId: Symbol("credentialId"), idempotencyKey: Symbol("idempotencyKey") },
    leads: { id: Symbol("leadId"), webhookCredentialId: Symbol("leadCredentialId"), externalId: Symbol("externalId") },
  };
  const rows: Array<Array<Record<string, string | null>>> = [];
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockImplementation(async () => rows.shift() ?? []);
  return { schema, rows, chain, db: { select: vi.fn(() => chain) } };
});

vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.schema }));
vi.mock("drizzle-orm", () => ({ and: vi.fn((...conditions: unknown[]) => conditions), eq: vi.fn((field: unknown, value: unknown) => [field, value]) }));

import { resolveLeadWebhookIdempotency } from "../services/resolve-lead-webhook-idempotency";

describe("resolveLeadWebhookIdempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.rows.length = 0;
  });

  it("replays the same credential, idempotency key, and payload", async () => {
    state.rows.push([{ deliveryId: "delivery-a", leadId: "lead-a", payloadHash: "same" }]);

    await expect(resolveLeadWebhookIdempotency("credential-a", "key-a", null, "same")).resolves.toEqual({ status: "replay", leadId: "lead-a" });
  });

  it("flags the same key with different content as a conflict", async () => {
    state.rows.push([{ deliveryId: "delivery-a", leadId: "lead-a", payloadHash: "old" }]);

    await expect(resolveLeadWebhookIdempotency("credential-a", "key-a", null, "new")).resolves.toEqual({ status: "conflict" });
  });

  it("falls back to the credential-scoped external identifier", async () => {
    state.rows.push([], [{ id: "lead-external" }]);

    await expect(resolveLeadWebhookIdempotency("credential-a", "key-a", "external-a", "hash")).resolves.toEqual({ status: "replay", leadId: "lead-external" });
  });

  it("allows a new delivery when no idempotency evidence exists", async () => {
    state.rows.push([], []);

    await expect(resolveLeadWebhookIdempotency("credential-a", "key-a", "external-a", "hash")).resolves.toEqual({ status: "new" });
  });
});
