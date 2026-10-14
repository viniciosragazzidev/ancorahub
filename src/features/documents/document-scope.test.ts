import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { TenantContext } from "@/shared/auth/types";
import { buildDocumentLeadScope } from "./document-scope";

const director: TenantContext = {
  userId: "director-1", tenantId: "tenant-a", role: "director", jobTitle: "director", branchId: null,
};

function compile(condition: Parameters<PgDialect["sqlToQuery"]>[0]) {
  return new PgDialect().sqlToQuery(condition);
}

describe("document lead access scope", () => {
  it("isolates a different tenant and keeps the director tenant-wide", () => {
    const query = compile(buildDocumentLeadScope(director, { leadScope: undefined }));
    expect(query.params).toContain("tenant-a");
    expect(query.params).not.toContain("tenant-b");
    expect(query.sql).not.toContain('"leads"."branch_id"');
  });

  it("limits a manager to the current unit and fails closed without one", () => {
    const manager = { ...director, userId: "manager-1", role: "manager" as const, jobTitle: "manager", branchId: "unit-a" };
    const scoped = compile(buildDocumentLeadScope(manager, { leadScope: undefined }));
    expect(scoped.params).toContain("unit-a");
    expect(scoped.params).not.toContain("unit-b");
    expect(scoped.params).toContain("tenant-a");
    expect(compile(buildDocumentLeadScope({ ...manager, branchId: null }, { leadScope: undefined })).sql).toContain("false");
  });

  it("limits a supervisor to active team memberships in the same tenant", () => {
    const supervisor = { ...director, userId: "supervisor-1", role: "supervisor" as const, jobTitle: "supervisor" };
    const query = compile(buildDocumentLeadScope(supervisor, { leadScope: undefined }));
    expect(query.sql).toContain('"tenant_memberships"."supervisor_id"');
    expect(query.sql).toContain('"tenant_memberships"."status"');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("supervisor-1");
  });
});
