import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const schema = { tenantMemberships: Symbol("tenantMemberships"), user: Symbol("user"), brokerProfiles: Symbol("brokerProfiles"), passwordResetRequests: Symbol("passwordResetRequests"), session: Symbol("session"), auditLogs: Symbol("auditLogs") };
  let target: unknown = null;
  const inserts: Array<{ table: symbol; values: unknown }> = [];
  const deletes: symbol[] = [];
  const db = {
    select: vi.fn(() => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.innerJoin = vi.fn(() => chain); chain.leftJoin = vi.fn(() => chain);
      chain.where = vi.fn(() => ({ limit: vi.fn(async () => target ? [target] : []) }));
      return { from: vi.fn(() => chain) };
    }),
    insert: vi.fn((table: symbol) => ({ values: vi.fn(async (values: unknown) => { inserts.push({ table, values }); }) })),
    delete: vi.fn((table: symbol) => ({ where: vi.fn(async () => { deletes.push(table); }) })),
  };
  return { schema, db, inserts, deletes, setTarget: (value: unknown) => { target = value; }, context: { tenantId: "tenant-a", userId: "manager-a", role: "manager" as const, jobTitle: "manager", branchId: "unit-a" } };
});

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.schema }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("drizzle-orm", () => ({ and: (...values: unknown[]) => values, eq: (field: unknown, value: unknown) => ({ field, value }), or: (...values: unknown[]) => values }));
vi.mock("better-auth/crypto", () => ({ hashPassword: async () => "hash" }));
vi.mock("@/features/communication-channels/outbound-service", () => ({ enqueueMetaTemplateMessage: vi.fn() }));
vi.mock("@/shared/auth/credential-account", () => ({ buildCredentialAccount: vi.fn(), buildCredentialAccountPasswordUpdate: vi.fn(), CREDENTIAL_PROVIDER_ID: "credential" }));

import { generatePasswordResetLinkForMember } from "./password-recovery";

describe("generatePasswordResetLinkForMember", () => {
  beforeEach(() => {
    vi.clearAllMocks(); state.inserts.length = 0; state.deletes.length = 0; state.setTarget(null);
  });

  it("rejects a target without a membership in the actor tenant before creating a token or ending sessions", async () => {
    await expect(generatePasswordResetLinkForMember("external-user")).rejects.toThrow(/tenant/);
    expect(state.inserts).toHaveLength(0); expect(state.deletes).toHaveLength(0);
  });

  it("rejects another unit and manager against director without side effects", async () => {
    state.setTarget({ tenantId: "tenant-a", userId: "broker-b", email: "b@example.com", role: "broker", branchId: "unit-b" });
    await expect(generatePasswordResetLinkForMember("broker-b")).rejects.toThrow(/escopo/);
    state.setTarget({ tenantId: "tenant-a", userId: "director-a", email: "d@example.com", role: "director", branchId: "unit-a" });
    await expect(generatePasswordResetLinkForMember("director-a")).rejects.toThrow(/escopo/);
    expect(state.inserts).toHaveLength(0); expect(state.deletes).toHaveLength(0);
  });

  it("creates an approved reset link and revokes sessions for a broker in the manager unit", async () => {
    state.setTarget({ tenantId: "tenant-a", userId: "broker-a", email: "a@example.com", role: "broker", branchId: "unit-a" });
    const result = await generatePasswordResetLinkForMember("broker-a");
    expect(result.success).toBe(true);
    expect(state.inserts.some((row) => row.table === state.schema.passwordResetRequests)).toBe(true);
    expect(state.deletes).toContain(state.schema.session);
  });
});
