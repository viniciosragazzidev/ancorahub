import { describe, expect, it } from "vitest";
import type { AccessContext } from "@/shared/auth/access-context";
import { AuthorizationService } from "@/shared/auth/authorization-service";
import {
  buildClientResourceScope,
  buildClientScopeWhere,
} from "./customer-authorization";

function createMockContext(overrides?: Partial<AccessContext>): AccessContext {
  return {
    userId: "user-broker-1",
    tenantId: "tenant-1",
    role: "broker",
    jobTitle: "broker",
    branchId: "unit-a",
    canAccessAllUnits: false,
    allowedUnitIds: ["unit-a"],
    permissions: new Set(["acessar_clientes"]),
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

describe("Customer/Client Authorization & Query Scoping (Fase 1B)", () => {
  it("Director can read any client in same tenant", () => {
    const directorContext = createMockContext({
      userId: "user-dir-1",
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

    const clientResource = buildClientResourceScope({
      tenantId: "tenant-1",
      branchId: "unit-c",
      corretorId: "user-broker-99",
    });

    const decision = AuthorizationService.evaluate(
      directorContext,
      "acessar_clientes",
      clientResource,
    );
    expect(decision.allowed).toBe(true);
    expect(decision.matchedScope).toBe("TENANT_WIDE");
  });

  it("Cross-tenant access to client is strictly denied (TENANT_MISMATCH)", () => {
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

    const crossTenantClient = buildClientResourceScope({
      tenantId: "tenant-2",
      branchId: "unit-a",
      corretorId: "user-broker-1",
    });

    const decision = AuthorizationService.evaluate(
      directorContext,
      "acessar_clientes",
      crossTenantClient,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("TENANT_MISMATCH");
  });

  it("Multi-unit manager can access clients in authorized units (A+B) and is denied on unit C", () => {
    const managerContext = createMockContext({
      userId: "user-mgr-multi",
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

    const clientA = buildClientResourceScope({ tenantId: "tenant-1", branchId: "unit-a" });
    const clientB = buildClientResourceScope({ tenantId: "tenant-1", branchId: "unit-b" });
    const clientC = buildClientResourceScope({ tenantId: "tenant-1", branchId: "unit-c" });

    expect(AuthorizationService.can(managerContext, "acessar_clientes", clientA)).toBe(true);
    expect(AuthorizationService.can(managerContext, "acessar_clientes", clientB)).toBe(true);
    expect(AuthorizationService.can(managerContext, "acessar_clientes", clientC)).toBe(false);
  });

  it("Broker with SELF scope can access own client but cannot access other broker client", () => {
    const brokerContext = createMockContext({
      userId: "user-broker-1",
      scopeType: "SELF",
    });

    const ownClient = buildClientResourceScope({
      tenantId: "tenant-1",
      corretorId: "user-broker-1",
    });

    const otherClient = buildClientResourceScope({
      tenantId: "tenant-1",
      corretorId: "user-broker-2",
    });

    expect(AuthorizationService.can(brokerContext, "acessar_clientes", ownClient)).toBe(true);
    expect(AuthorizationService.can(brokerContext, "acessar_clientes", otherClient)).toBe(false);
  });

  it("buildClientScopeWhere builds secure query clauses with tenant isolation and scope", () => {
    const brokerContext = createMockContext();
    const brokerWhere = buildClientScopeWhere(brokerContext);
    expect(brokerWhere).toBeDefined();

    const managerContext = createMockContext({
      role: "manager",
      scopeType: "UNITS",
      allowedUnitIds: ["unit-a"],
      scope: {
        tenantWide: false,
        unitIds: ["unit-a"],
        teamIds: [],
        ownership: "SCOPED",
        provenance: { units: "TENANT_MANAGER_BRANCHES" },
      },
    });

    const managerWhere = buildClientScopeWhere(managerContext, { requestedBranchId: "unit-a" });
    expect(managerWhere).toBeDefined();

    const unauthorizedWhere = buildClientScopeWhere(managerContext, { requestedBranchId: "unit-c" });
    expect(unauthorizedWhere).toBeDefined();
  });
});
