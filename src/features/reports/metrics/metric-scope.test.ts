import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAccessContext } = vi.hoisted(() => ({ resolveAccessContext: vi.fn() }));

vi.mock("@/shared/auth/access-context", () => ({ resolveAccessContext }));
vi.mock("@/features/team/supervisor-service", () => ({ getSupervisedBrokerIds: vi.fn(async () => ["broker-a"]) }));

import type { TenantContext } from "@/shared/auth/types";
import { resolveReportDataScope } from "./metric-scope";

const manager: TenantContext = {
  userId: "manager-1", tenantId: "tenant-1", role: "manager", jobTitle: "manager",
  branchId: "branch-1", customRoleId: "custom-1", customRoleScope: "own",
};

function accessContext(scopeType: "NONE" | "GLOBAL" | "SELF" | "UNITS", input: {
  tenantWide?: boolean; ownership?: "ANY" | "SCOPED" | "SELF" | "NONE"; unitIds?: string[];
} = {}) {
  return {
    scopeType,
    scope: {
      tenantWide: input.tenantWide ?? false,
      ownership: input.ownership ?? "NONE",
      unitIds: input.unitIds ?? [],
      teamIds: [],
      provenance: { units: "CUSTOM_ROLE_SCOPE" },
    },
    allowedUnitIds: input.unitIds ?? [],
  };
}

describe("resolveReportDataScope", () => {
  beforeEach(() => resolveAccessContext.mockReset());

  it("does not widen a custom own scope to the manager's whole branch", async () => {
    resolveAccessContext.mockResolvedValue(accessContext("SELF", { ownership: "SELF" }));
    const scope = await resolveReportDataScope(manager);
    expect(scope.leadScope).toBeTruthy();
    expect(scope.canSeeUnits).toBe(false);
  });

  it("fails closed for a custom role with no data scope", async () => {
    resolveAccessContext.mockResolvedValue(accessContext("NONE"));
    const scope = await resolveReportDataScope(manager);
    expect(scope.leadScope).toBeTruthy();
    expect(scope.canSeeUnits).toBe(false);
    expect(scope.canCompareUnits).toBe(false);
  });

  it("uses only explicitly assigned units for a custom branch scope", async () => {
    resolveAccessContext.mockResolvedValue(accessContext("UNITS", { ownership: "SCOPED", unitIds: ["branch-2"] }));
    const scope = await resolveReportDataScope(manager);
    expect(scope.leadScope).toBeTruthy();
    expect(scope.canSeeUnits).toBe(true);
    expect(scope.canCompareUnits).toBe(false);
  });

  it("allows tenant-wide data only when the canonical scope explicitly grants it", async () => {
    resolveAccessContext.mockResolvedValue(accessContext("GLOBAL", { tenantWide: true, ownership: "ANY" }));
    const scope = await resolveReportDataScope(manager);
    expect(scope.leadScope).toBeUndefined();
    expect(scope.tenantId).toBe(manager.tenantId);
    expect(scope.canCompareUnits).toBe(false);
  });
});
