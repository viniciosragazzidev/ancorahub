import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { TenantContext } from "@/shared/auth/types";
import { buildConversationLeadScope } from "./lead-scope";

const director: TenantContext = {
  userId: "director-1", tenantId: "tenant-a", role: "director", jobTitle: "director", branchId: null,
};

function compile(condition: ReturnType<typeof buildConversationLeadScope>) {
  return new PgDialect().sqlToQuery(condition);
}

describe("conversation lead role scope", () => {
  it("keeps a manager in the authenticated unit and fails closed without a unit", () => {
    const manager = { ...director, userId: "manager-1", role: "manager" as const, jobTitle: "manager", branchId: "unit-a" };
    const query = compile(buildConversationLeadScope(manager));
    expect(query.sql).toContain('"leads"."branch_id"');
    expect(query.params).toContain("unit-a");
    expect(query.params).not.toContain("unit-b");

    const noUnit = compile(buildConversationLeadScope({ ...manager, branchId: null }));
    expect(noUnit.sql).toContain("false");
  });

  it("limits supervisor conversations to active team memberships in the same tenant", () => {
    const supervisor = { ...director, userId: "supervisor-1", role: "supervisor" as const, jobTitle: "supervisor", branchId: "unit-a" };
    const query = compile(buildConversationLeadScope(supervisor));
    expect(query.sql).toContain('"tenant_memberships"."tenant_id"');
    expect(query.sql).toContain('"tenant_memberships"."supervisor_id"');
    expect(query.sql).toContain('"tenant_memberships"."status"');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("supervisor-1");
    expect(query.params).not.toContain("tenant-b");
  });

  it("keeps directors tenant-wide and brokers within their own leads", () => {
    const directorQuery = compile(buildConversationLeadScope(director));
    expect(directorQuery.sql).toContain('"leads"."tenant_id"');
    expect(directorQuery.params).toEqual(["tenant-a"]);

    const brokerQuery = compile(buildConversationLeadScope({ ...director, role: "broker", jobTitle: "broker" }));
    expect(brokerQuery.params).toContain("tenant-a");
    expect(brokerQuery.params).toContain("director-1");
  });
});
