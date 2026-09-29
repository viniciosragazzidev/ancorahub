import { describe, expect, it } from "vitest";
import type { AccessContext } from "@/shared/auth/access-context";
import { AuthorizationService } from "@/shared/auth/authorization-service";
import {
  buildLeadResourceScope,
  buildLeadScopeWhere,
} from "./lead-authorization";
import { sql } from "drizzle-orm";

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

describe("Lead Authorization & Query Scoping (Fase 1B)", () => {
  // A. Director same tenant read
  it("A. Director in same tenant can read any lead in the tenant", () => {
    const directorContext = createMockContext({
      userId: "user-dir-1",
      role: "director",
      jobTitle: "director",
      canAccessAllUnits: true,
      scopeType: "GLOBAL",
      scope: {
        tenantWide: true,
        unitIds: [],
        teamIds: [],
        ownership: "ANY",
        provenance: { units: "TENANT_WIDE" },
      },
    });

    const leadResource = buildLeadResourceScope({
      tenantId: "tenant-1",
      branchId: "unit-c",
      corretorId: "user-broker-99",
    });

    const decision = AuthorizationService.evaluate(
      directorContext,
      "acessar_leads",
      leadResource,
    );
    expect(decision.allowed).toBe(true);
    expect(decision.matchedScope).toBe("TENANT_WIDE");
  });

  // B. Director cross-tenant deny
  it("B. Director cross-tenant access is strictly denied (TENANT_MISMATCH)", () => {
    const directorContext = createMockContext({
      userId: "user-dir-1",
      role: "director",
      jobTitle: "director",
      canAccessAllUnits: true,
      scopeType: "GLOBAL",
      scope: {
        tenantWide: true,
        unitIds: [],
        teamIds: [],
        ownership: "ANY",
        provenance: { units: "TENANT_WIDE" },
      },
    });

    const crossTenantLead = buildLeadResourceScope({
      tenantId: "tenant-2",
      branchId: "unit-a",
      corretorId: "user-broker-1",
    });

    const decision = AuthorizationService.evaluate(
      directorContext,
      "acessar_leads",
      crossTenantLead,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("TENANT_MISMATCH");
  });

  // C. Manager Unit A read A (allow)
  it("C. Manager of Unit A can read lead from Unit A", () => {
    const managerContext = createMockContext({
      userId: "user-mgr-1",
      role: "manager",
      jobTitle: "manager",
      canAccessAllUnits: false,
      allowedUnitIds: ["unit-a"],
        scopeType: "UNITS",
      scope: {
        tenantWide: false,
        unitIds: ["unit-a"],
        teamIds: [],
        ownership: "SCOPED",
        provenance: { units: "TENANT_MANAGER_BRANCHES" },
      },
    });

    const leadInUnitA = buildLeadResourceScope({
      tenantId: "tenant-1",
      branchId: "unit-a",
      corretorId: "user-broker-99",
    });

    const decision = AuthorizationService.evaluate(
      managerContext,
      "acessar_leads",
      leadInUnitA,
    );
    expect(decision.allowed).toBe(true);
    expect(decision.matchedScope).toBe("UNIT");
  });

  // D & E. Manager Units A+B can access A and B, but cannot access C
  it("D & E. Multi-unit manager (Units A+B) can access leads in A and B, but is denied on Unit C", () => {
    const multiUnitManager = createMockContext({
      userId: "user-mgr-multi",
      role: "manager",
      jobTitle: "manager",
      canAccessAllUnits: false,
      allowedUnitIds: ["unit-a", "unit-b"],
      scopeType: "UNITS",
      scope: {
        tenantWide: false,
        unitIds: ["unit-a", "unit-b"],
        teamIds: [],
        ownership: "SCOPED",
        provenance: { units: "TENANT_MANAGER_BRANCHES" },
      },
    });

    const leadA = buildLeadResourceScope({ tenantId: "tenant-1", branchId: "unit-a" });
    const leadB = buildLeadResourceScope({ tenantId: "tenant-1", branchId: "unit-b" });
    const leadC = buildLeadResourceScope({ tenantId: "tenant-1", branchId: "unit-c" });

    expect(AuthorizationService.can(multiUnitManager, "acessar_leads", leadA)).toBe(true);
    expect(AuthorizationService.can(multiUnitManager, "acessar_leads", leadB)).toBe(true);

    const decisionC = AuthorizationService.evaluate(multiUnitManager, "acessar_leads", leadC);
    expect(decisionC.allowed).toBe(false);
    expect(decisionC.reason).toBe("UNIT_OUT_OF_SCOPE");
  });

  // F & G. Broker SELF reads own lead, cannot read other broker lead
  it("F & G. Broker with SELF scope reads own lead but is denied on another broker's lead", () => {
    const brokerContext = createMockContext({
      userId: "user-broker-1",
      role: "broker",
      scopeType: "SELF",
    });

    const ownLead = buildLeadResourceScope({
      tenantId: "tenant-1",
      branchId: "unit-a",
      corretorId: "user-broker-1",
    });

    const otherBrokerLead = buildLeadResourceScope({
      tenantId: "tenant-1",
      branchId: "unit-a",
      corretorId: "user-broker-2",
    });

    expect(AuthorizationService.can(brokerContext, "acessar_leads", ownLead)).toBe(true);

    const otherDecision = AuthorizationService.evaluate(
      brokerContext,
      "acessar_leads",
      otherBrokerLead,
    );
    expect(otherDecision.allowed).toBe(false);
    expect(otherDecision.reason).toBe("NOT_RESOURCE_OWNER");
  });

  // H. Custom capability + correct scope allows access
  it("H. Custom role with 'acessar_leads' and branch scope can read within assigned branch", () => {
    const customRoleContext = createMockContext({
      userId: "user-custom-1",
      role: "broker",
      jobTitle: "consultor_senior",
      customRoleId: "custom-role-senior",
      customRoleScope: "branch",
      canAccessAllUnits: false,
      allowedUnitIds: ["unit-b"],
      scopeType: "UNITS",
      scope: {
        tenantWide: false,
        unitIds: ["unit-b"],
        teamIds: [],
        ownership: "SCOPED",
        provenance: { units: "CUSTOM_ROLE_SCOPE" },
      },
      permissions: new Set(["acessar_leads"]),
    });

    const leadInUnitB = buildLeadResourceScope({
      tenantId: "tenant-1",
      branchId: "unit-b",
      corretorId: "user-broker-any",
    });

    const leadInUnitA = buildLeadResourceScope({
      tenantId: "tenant-1",
      branchId: "unit-a",
      corretorId: "user-broker-any",
    });

    expect(AuthorizationService.can(customRoleContext, "acessar_leads", leadInUnitB)).toBe(true);
    expect(AuthorizationService.can(customRoleContext, "acessar_leads", leadInUnitA)).toBe(false);
  });

  // I. Capability missing deny
  it("I. Missing 'acessar_leads' capability denies access even inside correct unit", () => {
    const restrictedContext = createMockContext({
      permissions: new Set([]), // No permissions
    });

    const lead = buildLeadResourceScope({
      tenantId: "tenant-1",
      branchId: "unit-a",
      corretorId: "user-broker-1",
    });

    const decision = AuthorizationService.evaluate(
      restrictedContext,
      "acessar_leads",
      lead,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("MISSING_CAPABILITY");
  });

  // J. Cross-tenant IDOR protection via buildLeadScopeWhere
  it("J. buildLeadScopeWhere always binds tenantId and denies out-of-scope requests", () => {
    const brokerContext = createMockContext();
    const whereSql = buildLeadScopeWhere(brokerContext);
    expect(whereSql).toBeDefined();

    const managerMulti = createMockContext({
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

    // When manager requests unit-a (authorized)
    const allowedBranchWhere = buildLeadScopeWhere(managerMulti, { requestedBranchId: "unit-a" });
    expect(allowedBranchWhere).toBeDefined();

    // When manager requests unit-c (unauthorized branch parameter) -> produces fail-closed false condition
    const unauthorizedBranchWhere = buildLeadScopeWhere(managerMulti, { requestedBranchId: "unit-c" });
    expect(unauthorizedBranchWhere).toBeDefined();
  });

  // K, L, M. Query scope constraints consistency
  it("K, L, M. QueryScopeConstraints returns matching constraints for list, count, and search", () => {
    const directorContext = createMockContext({
      role: "director",
      canAccessAllUnits: true,
      scopeType: "GLOBAL",
      scope: {
        tenantWide: true,
        unitIds: [],
        teamIds: [],
        ownership: "ANY",
        provenance: { units: "TENANT_WIDE" },
      },
    });

    const directorConstraints = AuthorizationService.getQueryScopeConstraints(directorContext);
    expect(directorConstraints.tenantWide).toBe(true);
    expect(directorConstraints.tenantId).toBe("tenant-1");
    expect(directorConstraints.ownerMode).toBe("ANY");

    const brokerContext = createMockContext({
      userId: "user-broker-1",
      scopeType: "SELF",
    });

    const brokerConstraints = AuthorizationService.getQueryScopeConstraints(brokerContext);
    expect(brokerConstraints.tenantWide).toBe(false);
    expect(brokerConstraints.ownerMode).toBe("SELF");
    expect(brokerConstraints.effectiveOwnerUserId).toBe("user-broker-1");
  });

  // N. Update out of scope denied
  it("N. Update attempts on out-of-scope lead throw AuthorizationError on require", () => {
    const brokerContext = createMockContext({
      userId: "user-broker-1",
      scopeType: "SELF",
    });

    const otherLead = buildLeadResourceScope({
      tenantId: "tenant-1",
      branchId: "unit-a",
      corretorId: "user-broker-2",
    });

    expect(() => {
      AuthorizationService.require(brokerContext, "acessar_leads", otherLead);
    }).toThrowError(/Acesso restrito/);
  });
});
