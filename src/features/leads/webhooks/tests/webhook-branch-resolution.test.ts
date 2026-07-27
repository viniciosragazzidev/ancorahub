import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const branches = { id: Symbol("id"), tenantId: Symbol("tenantId"), externalId: Symbol("externalId"), status: Symbol("status"), acceptingLeads: Symbol("acceptingLeads"), createdAt: Symbol("createdAt") };
  const rows: Array<Array<{ id: string }>> = [];
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockReturnValue(chain);
  chain.limit.mockImplementation(async () => rows.shift() ?? []);
  const db = { select: vi.fn(() => chain) };
  return { branches, rows, chain, db };
});

vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: { branches: state.branches } }));
vi.mock("drizzle-orm", () => ({ and: vi.fn((...conditions: unknown[]) => conditions), eq: vi.fn((field: unknown, value: unknown) => [field, value]) }));

import { WebhookBranchNotFoundError, resolveWebhookBranch } from "../services/resolve-webhook-branch";

describe("resolveWebhookBranch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.rows.length = 0;
  });

  it("uses the first active branch accepting leads only when the credential has no branch", async () => {
    state.rows.push([{ id: "default-branch" }]);

    await expect(resolveWebhookBranch("tenant-a", null)).resolves.toBe("default-branch");
    expect(state.chain.orderBy).toHaveBeenCalledOnce();
  });

  it("returns null when no default branch can receive a branchless credential", async () => {
    state.rows.push([]);

    await expect(resolveWebhookBranch("tenant-a", null)).resolves.toBeNull();
  });

  it("resolves an explicit external branch inside the tenant", async () => {
    state.rows.push([{ id: "branch-centro" }]);

    await expect(resolveWebhookBranch("tenant-a", "centro")).resolves.toBe("branch-centro");
    expect(state.chain.orderBy).not.toHaveBeenCalled();
  });

  it("rejects an unavailable or foreign external branch", async () => {
    state.rows.push([]);

    await expect(resolveWebhookBranch("tenant-a", "other-tenant-branch")).rejects.toBeInstanceOf(WebhookBranchNotFoundError);
  });
});
