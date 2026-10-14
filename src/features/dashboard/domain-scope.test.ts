import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { inArray } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { schema } from "@/shared/db";
import { buildDomainDashboardScopes } from "./domain-scope";

const director: TenantContext = {
  userId: "director-1", tenantId: "tenant-a", role: "director", jobTitle: "director", branchId: null,
};

function compile(condition: Parameters<PgDialect["sqlToQuery"]>[0]) {
  return new PgDialect().sqlToQuery(condition);
}

describe("domain dashboard tenant and membership scopes", () => {
  it("scopes every dashboard family to the authenticated tenant", () => {
    const scopes = buildDomainDashboardScopes(director, { leadScope: undefined, salesBrokerScope: undefined });
    for (const condition of Object.values(scopes)) {
      const query = compile(condition);
      expect(query.params).toContain("tenant-a");
      expect(query.params).not.toContain("tenant-b");
    }
  });

  it("limits manager leads, child records, sales and members to the current unit", () => {
    const manager = { ...director, userId: "manager-1", role: "manager" as const, jobTitle: "manager", branchId: "unit-a" };
    const scopes = buildDomainDashboardScopes(manager, { leadScope: undefined, salesBrokerScope: undefined });
    for (const condition of [scopes.leads, scopes.tasks, scopes.conversations, scopes.sales, scopes.memberships]) {
      const query = compile(condition);
      expect(query.params).toContain("unit-a");
      expect(query.params).not.toContain("unit-b");
    }
  });

  it("limits supervisors to their active team and keeps the director tenant-wide", () => {
    const supervisor = { ...director, userId: "supervisor-1", role: "supervisor" as const, jobTitle: "supervisor", branchId: "unit-a" };
    const supervisorScopes = buildDomainDashboardScopes(supervisor, {
      leadScope: inArray(schema.leads.corretorId, ["broker-a"]),
      salesBrokerScope: inArray(schema.sales.brokerId, ["broker-a"]),
    });
    for (const condition of [supervisorScopes.leads, supervisorScopes.tasks, supervisorScopes.conversations, supervisorScopes.sales]) {
      const query = compile(condition);
      expect(query.sql).toContain('"tenant_memberships"."supervisor_id"');
      expect(query.params).toContain("supervisor-1");
      expect(query.params).toContain("tenant-a");
    }
    const directorQuery = compile(buildDomainDashboardScopes(director, { leadScope: undefined, salesBrokerScope: undefined }).leads);
    expect(directorQuery.sql).not.toContain('"leads"."branch_id"');
    expect(directorQuery.sql).not.toContain('"tenant_memberships"."supervisor_id"');
  });

  it("fails closed for a manager without a unit and a custom role with no scope", () => {
    const noUnit = buildDomainDashboardScopes({
      ...director, userId: "manager-1", role: "manager", jobTitle: "manager", branchId: null,
    }, { leadScope: undefined, salesBrokerScope: undefined });
    expect(compile(noUnit.leads).sql).toContain("false");
    const noCustomScope = buildDomainDashboardScopes({
      ...director, userId: "manager-1", role: "manager", jobTitle: "manager", branchId: "unit-a", customRoleScope: "none",
    }, { leadScope: undefined, salesBrokerScope: undefined });
    expect(compile(noCustomScope.memberships).sql).toContain("false");
  });
});
