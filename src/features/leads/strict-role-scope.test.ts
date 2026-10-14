import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { TenantContext } from "@/shared/auth/types";
import { buildStrictRoleLeadScope } from "./strict-role-scope";

const director: TenantContext = {
  userId: "director-1", tenantId: "tenant-a", role: "director", jobTitle: "director", branchId: null,
};

function compile(condition: Parameters<PgDialect["sqlToQuery"]>[0]) {
  return new PgDialect().sqlToQuery(condition);
}

describe("strict role lead scope for sales and proposals", () => {
  it("keeps directors tenant-wide", () => {
    const query = compile(buildStrictRoleLeadScope(director, { leadScope: undefined }));
    expect(query.params).toEqual(["tenant-a"]);
    expect(query.sql).not.toContain('"leads"."branch_id"');
    expect(query.sql).not.toContain('"tenant_memberships"."supervisor_id"');
  });

  it("limits managers to the authenticated unit and fails closed without it", () => {
    const manager = { ...director, userId: "manager-1", role: "manager" as const, jobTitle: "manager", branchId: "unit-a" };
    const scoped = compile(buildStrictRoleLeadScope(manager, { leadScope: undefined }));
    expect(scoped.params).toContain("tenant-a");
    expect(scoped.params).toContain("unit-a");
    expect(scoped.params).not.toContain("unit-b");
    const noUnit = compile(buildStrictRoleLeadScope({ ...manager, branchId: null }, { leadScope: undefined }));
    expect(noUnit.sql).toContain("false");
  });

  it("limits supervisors to active team memberships in the same tenant", () => {
    const supervisor = { ...director, userId: "supervisor-1", role: "supervisor" as const, jobTitle: "supervisor" };
    const query = compile(buildStrictRoleLeadScope(supervisor, { leadScope: undefined }));
    expect(query.sql).toContain('"tenant_memberships"."tenant_id"');
    expect(query.sql).toContain('"tenant_memberships"."supervisor_id"');
    expect(query.sql).toContain('"tenant_memberships"."status"');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("supervisor-1");
  });
});
