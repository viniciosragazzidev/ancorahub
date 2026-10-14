import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { TenantContext } from "@/shared/auth/types";
import { buildNocBranchScope, buildNocLeadScope, buildNocMembershipScope, canViewNocBranchHealth } from "./role-scope";

const director: TenantContext = {
  userId: "director-1", tenantId: "tenant-a", role: "director", jobTitle: "director", branchId: null,
};
const compile = (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => new PgDialect().sqlToQuery(condition);

describe("NOC role scopes", () => {
  it("limits manager leads and team rows to the authenticated unit, failing closed without one", () => {
    const manager = { ...director, userId: "manager-1", role: "manager" as const, jobTitle: "manager", branchId: "unit-a" };
    for (const condition of [buildNocLeadScope(manager), buildNocMembershipScope(manager), buildNocBranchScope(manager)]) {
      const query = compile(condition);
      expect(query.params).toContain("tenant-a");
      expect(query.params).toContain("unit-a");
      expect(query.params).not.toContain("unit-b");
    }
    expect(compile(buildNocLeadScope({ ...manager, branchId: null })).sql).toContain("false");
    expect(compile(buildNocMembershipScope({ ...manager, branchId: null })).sql).toContain("false");
    expect(compile(buildNocBranchScope({ ...manager, branchId: null })).sql).toContain("false");
  });

  it("limits supervisor leads and members to their own tenant team, not the full unit", () => {
    const supervisor = { ...director, userId: "supervisor-1", role: "supervisor" as const, jobTitle: "supervisor", branchId: "unit-a" };
    const leads = compile(buildNocLeadScope(supervisor));
    const members = compile(buildNocMembershipScope(supervisor));
    expect(leads.sql).toContain('"tenant_memberships"."supervisor_id"');
    expect(leads.params).toContain("tenant-a");
    expect(leads.params).toContain("supervisor-1");
    expect(members.sql).toContain('"tenant_memberships"."supervisor_id"');
    expect(members.params).toContain("tenant-a");
    expect(members.params).toContain("supervisor-1");
    expect(canViewNocBranchHealth(supervisor)).toBe(false);
    expect(compile(buildNocBranchScope(supervisor)).sql).toContain("false");
  });

  it("preserves director tenant-wide access and rejects other tenants", () => {
    for (const condition of [buildNocLeadScope(director), buildNocMembershipScope(director), buildNocBranchScope(director)]) {
      const query = compile(condition);
      expect(query.params).toContain("tenant-a");
      expect(query.params).not.toContain("tenant-b");
      expect(query.sql).not.toContain('"tenant_memberships"."supervisor_id"');
    }
    expect(canViewNocBranchHealth(director)).toBe(true);
  });
});
