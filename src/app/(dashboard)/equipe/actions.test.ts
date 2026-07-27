import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock state ───────────────────────────────────────────────────────
const state = vi.hoisted(() => {
  const schema = {
    leads: Symbol("leads"),
    leadInteractions: Symbol("leadInteractions"),
    leadDistributionEvents: Symbol("leadDistributionEvents"),
    auditLogs: Symbol("auditLogs"),
    user: Symbol("user"),
    tenantMemberships: Symbol("tenantMemberships"),
    brokerProfiles: Symbol("brokerProfiles"),
    brokerInvitations: Symbol("brokerInvitations"),
    // Zod enum values — must match production schema shape
    teamJobTitleValues: [
      "manager",
      "broker",
      "marketing",
      "finance",
      "operations",
      "support",
    ] as const,
  };

  const inserts: Array<{ table: symbol; values: Record<string, unknown> }> = [];
  const updates: Array<{ table: symbol; values: Record<string, unknown> }> = [];
  const deletes: Array<{ table: symbol }> = [];

  // ── Helper: builds a flexible chain of query methods ────────────────
  function queryChain({ rows, useLimit = true }: { rows: unknown[]; useLimit?: boolean }) {
    const resolve = vi.fn(async () => rows);
    // If the chain ends without .limit(), make .where() return a thenable
    const whereResult = useLimit
      ? { limit: vi.fn(async () => rows) }
      : { then: vi.fn(async (cb: (value: unknown[]) => unknown) => cb(rows)) };
    return {
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          leftJoin: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => rows),
            })),
          })),
          where: vi.fn(() => whereResult),
        })),
        where: vi.fn(() => whereResult),
      })),
    };
  }

  const db = {
    select: vi.fn(() => queryChain({ rows: [] })),
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
    delete: vi.fn((table: symbol) => ({
      where: vi.fn(async () => {
        deletes.push({ table });
      }),
    })),
    transaction: vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)),
  };

  // ── Helper to reconfigure db.select for a specific query pattern ──
  function setSelectResult(
    pattern: "member" | "leads" | "profile" | "memberAndLeads",
    rows: unknown[],
  ) {
    // For simplicity, just override select to return a chain matching the
    // most specific pattern needed. We use callCount inside the implementation.
    db.select.mockImplementation(() => {
      if (pattern === "member") {
        return queryChain({ rows, useLimit: true });
      }
      if (pattern === "leads") {
        return queryChain({ rows, useLimit: false });
      }
      if (pattern === "profile") {
        return queryChain({ rows, useLimit: true });
      }
      // Default: member + leads + profile (3 sequential selects)
      return queryChain({ rows, useLimit: true });
    });
  }

  return {
    schema,
    inserts,
    updates,
    deletes,
    db,
    queryChain,
    setSelectResult,
    mockTenantContext: {
      tenantId: "tenant-test",
      userId: "director-test",
      role: "director" as const,
      branchId: "branch-test",
      jobTitle: "director",
    },
  };
});

// ── Mocks ─────────────────────────────────────────────────────────────
vi.mock("@/shared/db", () => ({
  getDatabase: () => state.db,
  schema: state.schema,
}));

vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: () => Promise.resolve(state.mockTenantContext),
}));

vi.mock("@/shared/auth/team-permissions", () => ({
  requireCanManageMember: vi.fn(),
  requireCanCreateRole: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
}));

import { deleteTeamMemberAction } from "./actions";

// ── Helpers ────────────────────────────────────────────────────────────
function inserted(table: symbol) {
  return state.inserts.filter((item) => item.table === table).map((item) => item.values);
}

function updated(table: symbol) {
  return state.updates.filter((item) => item.table === table).map((item) => item.values);
}

function deleted(table: symbol) {
  return state.deletes.filter((item) => item.table === table);
}

function makeFormData(memberId = "00000000-0000-4000-8000-000000000001") {
  const fd = new FormData();
  fd.append("memberId", memberId);
  return fd;
}

describe("deleteTeamMemberAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.inserts.length = 0;
    state.updates.length = 0;
    state.deletes.length = 0;
  });

  it("unassigns all leads when the broker has assigned leads", async () => {
    // Configure 3 sequential selects:
    // 1. Member query → returns member
    // 2. Leads query → returns 2 leads (no limit)
    // 3. Profile query → returns profile
    let callCount = 0;
    state.db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return state.queryChain({
          rows: [{ membershipId: "membership-test", userId: "broker-test", role: "broker", branchId: "branch-test" }],
          useLimit: true,
        });
      }
      if (callCount === 2) {
        return state.queryChain({
          rows: [{ id: "lead-1", branchId: "branch-test" }, { id: "lead-2", branchId: "branch-test" }],
          useLimit: false,
        });
      }
      return state.queryChain({ rows: [{ id: "profile-test" }], useLimit: true });
    });

    const result = await deleteTeamMemberAction({}, makeFormData());

    // Should succeed
    expect(result).toEqual({ success: true });

    // 1. Leads should be updated
    const leadUpdates = updated(state.schema.leads);
    expect(leadUpdates).toHaveLength(1);
    expect(leadUpdates[0]).toMatchObject({
      corretorId: null,
      distributionStatus: "returned_to_queue",
      assignedAt: null,
    });

    // 2. Lead interactions (2 leads → 2 interactions)
    expect(inserted(state.schema.leadInteractions)).toHaveLength(2);
    for (const interaction of inserted(state.schema.leadInteractions)) {
      expect(interaction).toMatchObject({
        tipo: "system_alert",
        conteudo: expect.stringContaining("corretor foi excluído"),
      });
    }

    // 3. Distribution events (2 leads → 2 events)
    expect(inserted(state.schema.leadDistributionEvents)).toHaveLength(2);
    for (const event of inserted(state.schema.leadDistributionEvents)) {
      expect(event).toMatchObject({
        action: "returned_to_queue",
        previousOwnerId: "broker-test",
        newOwnerId: null,
        reason: "Corretor excluído",
      });
    }

    // 4. Audit logs: 2 lead + 1 member = 3
    const auditLogs = inserted(state.schema.auditLogs);
    expect(auditLogs).toHaveLength(3);
    expect(auditLogs.filter((l) => l.entidade === "lead")).toHaveLength(2);
    expect(auditLogs.filter((l) => l.entidade === "lead")).toContainEqual(
      expect.objectContaining({ acao: "lead.returned_to_queue" }),
    );
    expect(auditLogs.filter((l) => l.entidade === "tenant_membership")).toContainEqual(
      expect.objectContaining({ acao: "excluiu_membro" }),
    );

    // 5. Member records should be deleted
    expect(deleted(state.schema.tenantMemberships)).toHaveLength(1);
    expect(deleted(state.schema.brokerProfiles)).toHaveLength(1);
    expect(deleted(state.schema.user)).toHaveLength(1);
  });

  it("skips lead handling when broker has no assigned leads", async () => {
    // 1. Member found
    // 2. Leads query → empty array
    // 3. Profile found
    let callCount = 0;
    state.db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return state.queryChain({
          rows: [{ membershipId: "membership-test", userId: "broker-test", role: "broker", branchId: "branch-test" }],
          useLimit: true,
        });
      }
      if (callCount === 2) {
        return state.queryChain({ rows: [], useLimit: false });
      }
      return state.queryChain({ rows: [{ id: "profile-test" }], useLimit: true });
    });

    const result = await deleteTeamMemberAction({}, makeFormData());

    expect(result).toEqual({ success: true });

    // No lead interactions or distribution events
    expect(inserted(state.schema.leadInteractions)).toHaveLength(0);
    expect(inserted(state.schema.leadDistributionEvents)).toHaveLength(0);

    // Only the member audit log
    const auditLogs = inserted(state.schema.auditLogs);
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0]).toMatchObject({ entidade: "tenant_membership", acao: "excluiu_membro" });

    // Member should be deleted
    expect(deleted(state.schema.user)).toHaveLength(1);
  });

  it("returns error when member is not found", async () => {
    // Both member and profile queries return empty
    let callCount = 0;
    state.db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return state.queryChain({ rows: [], useLimit: true });
      }
      // Else branch → profile query
      return state.queryChain({ rows: [], useLimit: true });
    });

    const result = await deleteTeamMemberAction({}, makeFormData());

    expect(result).toEqual({ success: false, error: "Membro não encontrado." });
    expect(state.inserts).toHaveLength(0);
    expect(state.deletes).toHaveLength(0);
  });
});
