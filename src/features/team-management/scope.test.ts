import { describe, expect, it } from "vitest";

import {
  isBrokerMetricRowVisibleInScope,
  isBrokerVisibleInTeamMetricsScope,
  isTeamMetricRowVisibleInScope,
  resolveBrokerMetricsScope,
  resolveTeamMetricsScope,
} from "./scope";
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

describe("broker metric scope", () => {
  it("binds a broker to their own id from the session", () => {
    const scope = resolveBrokerMetricsScope(context({ role: "broker", userId: "broker-1" }));
    expect(scope).toEqual({ kind: "broker", tenantId: "tenant-1", brokerId: "broker-1" });
  });

  it("rejects every other role", () => {
    for (const role of ["manager", "supervisor", "director"] as const) {
      expect(() => resolveBrokerMetricsScope(context({ role, supervisorTeamScope: true }))).toThrow();
    }
  });

  it("only lets the broker's own row through", () => {
    const scope = resolveBrokerMetricsScope(context({ role: "broker", userId: "broker-1" }));
    expect(isBrokerMetricRowVisibleInScope(scope, { tenantId: "tenant-1", scopeType: "broker", brokerId: "broker-1" })).toBe(true);
    expect(isBrokerMetricRowVisibleInScope(scope, { tenantId: "tenant-1", scopeType: "broker", brokerId: "broker-2" })).toBe(false);
    expect(isBrokerMetricRowVisibleInScope(scope, { tenantId: "tenant-2", scopeType: "broker", brokerId: "broker-1" })).toBe(false);
    expect(isBrokerMetricRowVisibleInScope(scope, { tenantId: "tenant-1", scopeType: "team", brokerId: null })).toBe(false);
    expect(isBrokerMetricRowVisibleInScope(scope, { tenantId: "tenant-1", scopeType: "unit", brokerId: null })).toBe(false);
  });
});
