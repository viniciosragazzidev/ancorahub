import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { inArray } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";
import { buildSalesPageScope } from "./sales-page-scope";

const director: TenantContext = {
  userId: "director-1", tenantId: "tenant-a", role: "director", jobTitle: "director", branchId: null,
};

function compile(condition: Parameters<PgDialect["sqlToQuery"]>[0]) {
  return new PgDialect().sqlToQuery(condition);
}

describe("sales page scope", () => {
  it("keeps sales and branch choices inside the authenticated tenant", () => {
    const scope = buildSalesPageScope(director, { leadScope: undefined, salesBrokerScope: undefined });
    const salesQuery = compile(scope.salesWhere);
    const branchesQuery = compile(scope.branchesWhere!);
    expect(salesQuery.params).toContain("tenant-a");
    expect(salesQuery.params).not.toContain("tenant-b");
    expect(branchesQuery.params).toContain("tenant-a");
  });

  it("ignores a forged manager branch and restricts choices and sales to the manager unit", () => {
    const manager = { ...director, userId: "manager-1", role: "manager" as const, jobTitle: "manager", branchId: "unit-a" };
    const scope = buildSalesPageScope(manager, { leadScope: undefined, salesBrokerScope: undefined }, "unit-b");
    const salesQuery = compile(scope.salesWhere);
    const branchesQuery = compile(scope.branchesWhere!);
    expect(salesQuery.params).toContain("unit-a");
    expect(salesQuery.params).not.toContain("unit-b");
    expect(branchesQuery.params).toContain("unit-a");
    expect(branchesQuery.params).not.toContain("unit-b");
  });

  it("limits a supervisor to active team members across sales and tenant-safe lead joins", () => {
    const supervisor = { ...director, userId: "supervisor-1", role: "supervisor" as const, jobTitle: "supervisor", branchId: null };
    const scope = buildSalesPageScope(supervisor, {
      leadScope: inArray(schema.leads.corretorId, ["broker-a"]),
      salesBrokerScope: inArray(schema.sales.brokerId, ["broker-a"]),
    });
    const query = compile(scope.salesWhere);
    expect(query.sql).toContain('"leads"."tenant_id"');
    expect(query.sql).toContain('"tenant_memberships"."supervisor_id"');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("supervisor-1");
    expect(scope.branchesWhere).toBeUndefined();
  });

  it("preserves the director's tenant-wide view and allows an in-tenant branch filter", () => {
    const scope = buildSalesPageScope(director, { leadScope: undefined, salesBrokerScope: undefined }, "unit-a");
    const query = compile(scope.salesWhere);
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("unit-a");
    expect(query.sql).not.toContain('"tenant_memberships"."supervisor_id"');
  });
});
