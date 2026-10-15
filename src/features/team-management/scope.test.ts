import { describe, expect, it } from "vitest";

import { isBrokerVisibleInTeamMetricsScope, isTeamMetricRowVisibleInScope, resolveTeamMetricsScope } from "./scope";
import type { TenantContext } from "@/shared/auth/types";

function context(overrides: Partial<TenantContext> = {}): TenantContext {
  return { userId: "viewer", tenantId: "tenant-1", role: "manager", jobTitle: "manager", branchId: "unit-1", ...overrides };
}

describe("team metric scope", () => {
  it("keeps a manager inside the authenticated unit", () => {
    const scope = resolveTeamMetricsScope(context());
    expect(scope.kind).toBe("unit");
    if (scope.kind !== "unit") throw new Error("Expected manager unit scope.");
    expect(isBrokerVisibleInTeamMetricsScope(scope, { tenantId: "tenant-1", branchId: "unit-1", supervisorId: "sup-1" })).toBe(true);
    expect(isBrokerVisibleInTeamMetricsScope(scope, { tenantId: "tenant-1", branchId: "unit-2", supervisorId: "sup-1" })).toBe(false);
    expect(isBrokerVisibleInTeamMetricsScope(scope, { tenantId: "tenant-2", branchId: "unit-1", supervisorId: "sup-1" })).toBe(false);
    expect(isTeamMetricRowVisibleInScope(scope, { tenantId: "tenant-1", scopeType: "team", branchId: "unit-2", supervisorId: "sup-2" })).toBe(false);
  });

  it("keeps a supervisor inside their own team", () => {
    const scope = resolveTeamMetricsScope(context({ role: "supervisor", userId: "sup-1", supervisorTeamScope: true }));
    expect(scope.kind).toBe("team");
    if (scope.kind !== "team") throw new Error("Expected supervisor team scope.");
    expect(isBrokerVisibleInTeamMetricsScope(scope, { tenantId: "tenant-1", branchId: "unit-1", supervisorId: "sup-1" })).toBe(true);
    expect(isBrokerVisibleInTeamMetricsScope(scope, { tenantId: "tenant-1", branchId: "unit-1", supervisorId: "sup-2" })).toBe(false);
    expect(isBrokerVisibleInTeamMetricsScope(scope, { tenantId: "tenant-2", branchId: "unit-1", supervisorId: "sup-1" })).toBe(false);
    expect(isTeamMetricRowVisibleInScope(scope, { tenantId: "tenant-1", scopeType: "team", branchId: "unit-1", supervisorId: "sup-2" })).toBe(false);
    expect(isTeamMetricRowVisibleInScope(scope, { tenantId: "tenant-1", scopeType: "unit", branchId: "unit-1", supervisorId: null })).toBe(false);
  });

  it("denies supervisor views when team scope is off and rejects other roles", () => {
    expect(() => resolveTeamMetricsScope(context({ role: "supervisor", supervisorTeamScope: false }))).toThrow();
    expect(() => resolveTeamMetricsScope(context({ role: "director" }))).toThrow();
    expect(() => resolveTeamMetricsScope(context({ role: "broker" }))).toThrow();
  });
});
