import { describe, expect, it } from "vitest";
import type { AccessContext } from "./access-context";
import {
  classifyShadowMismatch,
  evaluateShadowAuthorization,
} from "./shadow-mode";

function createMockContext(overrides?: Partial<AccessContext>): AccessContext {
  return {
    userId: "user-broker-1",
    tenantId: "tenant-1",
    role: "broker",
    jobTitle: "broker",
    branchId: "unit-a",
    canAccessAllUnits: false,
    allowedUnitIds: ["unit-a"],
    permissions: new Set(["acessar_leads"]),
    scopeType: "SELF",
    scope: {
      tenantWide: false,
      unitIds: ["unit-a"],
      teamIds: [],
      ownership: "SELF",
      provenance: {
        units: "SELF_BROKER",
      },
    },
    ...overrides,
  };
}

describe("Shadow Authorization Mode & Mismatch Classification (Fase 1B)", () => {
  it("Legacy ALLOW + Canonical ALLOW yields mismatch = false", async () => {
    const context = createMockContext({
      userId: "user-broker-1",
    });

    const resource = {
      tenantId: "tenant-1",
      unitId: "unit-a",
      ownerUserId: "user-broker-1",
    };

    const result = await evaluateShadowAuthorization({
      operationKey: "lead.read",
      legacyAllowed: true,
      context,
      capability: "acessar_leads",
      resource,
    });

    expect(result.mismatch).toBe(false);
    expect(result.canonicalDecision.allowed).toBe(true);
    expect(result.mismatchClassification).toBeUndefined();
  });

  it("Legacy DENY + Canonical DENY yields mismatch = false", async () => {
    const context = createMockContext({
      userId: "user-broker-1",
    });

    const crossTenantResource = {
      tenantId: "tenant-2",
      unitId: "unit-a",
      ownerUserId: "user-broker-1",
    };

    const result = await evaluateShadowAuthorization({
      operationKey: "lead.read",
      legacyAllowed: false,
      context,
      capability: "acessar_leads",
      resource: crossTenantResource,
    });

    expect(result.mismatch).toBe(false);
    expect(result.canonicalDecision.allowed).toBe(false);
    expect(result.mismatchClassification).toBeUndefined();
  });

  it("Legacy ALLOW + Canonical DENY is classified as LEGACY_TOO_PERMISSIVE", async () => {
    const context = createMockContext({
      userId: "user-broker-1",
    });

    // Resource owned by someone else -> canonical denies
    const otherResource = {
      tenantId: "tenant-1",
      unitId: "unit-a",
      ownerUserId: "user-broker-2",
    };

    const result = await evaluateShadowAuthorization({
      operationKey: "lead.read",
      legacyAllowed: true, // Suppose legacy bug was overly permissive
      context,
      capability: "acessar_leads",
      resource: otherResource,
    });

    expect(result.mismatch).toBe(true);
    expect(result.canonicalDecision.allowed).toBe(false);
    expect(result.mismatchClassification).toBe("LEGACY_TOO_PERMISSIVE");
  });

  it("Legacy DENY + Canonical ALLOW (e.g. multi-unit manager) is classified as LEGACY_TOO_RESTRICTIVE", async () => {
    const multiUnitManager = createMockContext({
      userId: "user-mgr-1",
      role: "manager",
      scopeType: "UNITS",
      allowedUnitIds: ["unit-a", "unit-b"],
      scope: {
        tenantWide: false,
        unitIds: ["unit-a", "unit-b"],
        teamIds: [],
        ownership: "SCOPED",
        provenance: { units: "TENANT_MANAGER_BRANCHES" },
      },
    });

    // Resource in unit-b: legacy manager code only checked single membership branchId (unit-a), so legacy denied
    const resourceUnitB = {
      tenantId: "tenant-1",
      unitId: "unit-b",
    };

    const result = await evaluateShadowAuthorization({
      operationKey: "lead.read",
      legacyAllowed: false, // Legacy single-branch check failed
      context: multiUnitManager,
      capability: "acessar_leads",
      resource: resourceUnitB,
    });

    expect(result.mismatch).toBe(true);
    expect(result.canonicalDecision.allowed).toBe(true);
    expect(result.mismatchClassification).toBe("LEGACY_TOO_RESTRICTIVE");
  });

  it("Classify helper handles custom mismatch categories", () => {
    expect(
      classifyShadowMismatch(
        true,
        { allowed: false },
        "QUERY_SCOPE_GAP",
      ),
    ).toBe("QUERY_SCOPE_GAP");

    expect(
      classifyShadowMismatch(
        false,
        { allowed: true },
        "TEAM_SCOPE_GAP",
      ),
    ).toBe("TEAM_SCOPE_GAP");
  });
});
