import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { TenantContext } from "@/shared/auth/types";
import { buildCompanyLeadCountScope, buildCompanyReadScope } from "./read-scope";

const director: TenantContext = {
  userId: "director-1", tenantId: "tenant-a", role: "director", jobTitle: "director", branchId: null,
};
const compile = (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => new PgDialect().sqlToQuery(condition);

describe("company read role scopes", () => {
  it("limits managers to their own unit and returns none without a unit", () => {
    const manager = { ...director, userId: "manager-1", role: "manager" as const, jobTitle: "manager", branchId: "unit-a" };
    const query = compile(buildCompanyReadScope(manager));
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("unit-a");
    expect(query.params).not.toContain("unit-b");
    expect(compile(buildCompanyReadScope({ ...manager, branchId: null })).sql).toContain("false");
  });

  it("shows supervisors only companies with a lead from their active tenant team", () => {
    const supervisor = { ...director, userId: "supervisor-1", role: "supervisor" as const, jobTitle: "supervisor", branchId: "unit-a" };
    const query = compile(buildCompanyReadScope(supervisor));
    const leadCountScope = compile(buildCompanyLeadCountScope(supervisor)!);
    expect(query.sql).toContain('"companies"."tenant_id"');
    expect(query.sql).toContain('"leads"."tenant_id"');
    expect(query.sql).toContain('"tenant_memberships"."supervisor_id"');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("supervisor-1");
    expect(leadCountScope.params).not.toContain("unit-a");
    expect(query.params).not.toContain("tenant-b");
  });

  it("preserves the director tenant view and refuses an unrelated tenant", () => {
    const query = compile(buildCompanyReadScope(director));
    expect(query.params).toContain("tenant-a");
    expect(query.params).not.toContain("tenant-b");
    expect(query.sql).not.toContain('"tenant_memberships"."supervisor_id"');
  });
});
