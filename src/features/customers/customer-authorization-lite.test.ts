import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { AccessContext } from "@/shared/auth/access-context";
import { buildClientScopeWhere } from "./customer-authorization";

// The Lite gestor and supervisor read clients through this WHERE clause; rendering it shows the bound values.
const dialect = new PgDialect();

function render(where: ReturnType<typeof buildClientScopeWhere>) {
  return dialect.sqlToQuery(where);
}

function managerContext(overrides?: Partial<AccessContext>): AccessContext {
  return {
    userId: "manager-1",
    tenantId: "tenant-1",
    role: "manager",
    jobTitle: "manager",
    branchId: "unit-a",
    canAccessAllUnits: false,
    allowedUnitIds: ["unit-a"],
    permissions: new Set(["acessar_clientes"]),
    scopeType: "UNITS",
    scope: {
      tenantWide: false,
      unitIds: ["unit-a"],
      teamIds: [],
      ownership: "SCOPED",
      provenance: { units: "TENANT_MANAGER_BRANCHES" },
    },
    ...overrides,
  } as AccessContext;
}

function supervisorContext(overrides?: Partial<AccessContext>): AccessContext {
  return {
    userId: "supervisor-1",
    tenantId: "tenant-1",
    role: "supervisor",
    jobTitle: "supervisor",
    branchId: "unit-a",
    supervisorTeamScope: true,
    canAccessAllUnits: false,
    allowedUnitIds: ["unit-a"],
    permissions: new Set(["acessar_clientes"]),
    scopeType: "UNITS",
    scope: {
      tenantWide: false,
      unitIds: ["unit-a"],
      teamIds: [],
      teamScoped: true,
      ownership: "SCOPED",
      provenance: { units: "TENANT_MANAGER_BRANCHES" },
    },
    ...overrides,
  } as AccessContext;
}

describe("Lite clients scope (E2)", () => {
  it("limits the gestor to his unit and always binds the tenant", () => {
    const { sql: text, params } = render(buildClientScopeWhere(managerContext()));

    expect(text).toContain('"branch_id" in');
    expect(params).toEqual(expect.arrayContaining(["tenant-1", "unit-a"]));
    expect(params).not.toContain("unit-c");
  });

  it("returns nothing for a unit the gestor does not own (the detail page then answers not found)", () => {
    const { sql: text, params } = render(buildClientScopeWhere(managerContext(), { requestedBranchId: "unit-c" }));

    expect(text).toContain("false");
    expect(params).not.toContain("unit-c");
  });

  it("returns nothing for a gestor without a unit", () => {
    const { sql: text } = render(buildClientScopeWhere(managerContext({ branchId: null, allowedUnitIds: [], scope: { tenantWide: false, unitIds: [], teamIds: [], ownership: "SCOPED", provenance: { units: "TENANT_MANAGER_BRANCHES" } } } as Partial<AccessContext>)));

    expect(text).toContain("false");
    expect(text).not.toContain('"branch_id" in');
  });

  it("limits the supervisor to clients of his own team, never the whole unit", () => {
    const { sql: text, params } = render(buildClientScopeWhere(supervisorContext()));

    expect(text).toContain("supervisor_id");
    expect(text).not.toContain('"branch_id" in');
    expect(params).toEqual(expect.arrayContaining(["tenant-1", "supervisor-1"]));
  });
});
