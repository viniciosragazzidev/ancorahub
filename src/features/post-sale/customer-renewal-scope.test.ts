import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { TenantContext } from "@/shared/auth/types";
import { buildCustomerRenewalStatusScope } from "./customer-renewal-scope";

const director: TenantContext = {
  userId: "director-1", tenantId: "tenant-a", role: "director", jobTitle: "director", branchId: null,
};
const compile = (condition: ReturnType<typeof buildCustomerRenewalStatusScope>) => new PgDialect().sqlToQuery(condition);

describe("customer renewal role scope", () => {
  it("rejects customers from another tenant and managers outside their unit", () => {
    const manager = { ...director, userId: "manager-1", role: "manager" as const, jobTitle: "manager", branchId: "unit-a" };
    const query = compile(buildCustomerRenewalStatusScope(manager));
    expect(query.sql).toContain('"active_customers"."tenant_id"');
    expect(query.sql).toContain('"active_customers"."branch_id"');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("unit-a");
    expect(query.params).not.toContain("tenant-b");
    expect(query.params).not.toContain("unit-b");
  });

  it("rejects customers whose broker is outside the supervisor's active team", () => {
    const supervisor = { ...director, userId: "supervisor-1", role: "supervisor" as const, jobTitle: "supervisor", branchId: "unit-a" };
    const query = compile(buildCustomerRenewalStatusScope(supervisor));
    expect(query.sql).toContain('"active_customers"."broker_id"');
    expect(query.sql).toContain('"tenant_memberships"."tenant_id"');
    expect(query.sql).toContain('"tenant_memberships"."supervisor_id"');
    expect(query.sql).toContain('"tenant_memberships"."status"');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("supervisor-1");
    expect(query.params).not.toContain("other-supervisor");
    expect(query.sql).not.toContain('"active_customers"."branch_id"');
  });

  it("keeps directors tenant-wide and brokers limited to their own clients", () => {
    const directorQuery = compile(buildCustomerRenewalStatusScope(director));
    expect(directorQuery.params).toEqual(["tenant-a"]);
    expect(directorQuery.sql).not.toContain('"active_customers"."branch_id"');
    expect(directorQuery.sql).not.toContain('"tenant_memberships"."supervisor_id"');

    const brokerQuery = compile(buildCustomerRenewalStatusScope({ ...director, role: "broker", jobTitle: "broker" }));
    expect(brokerQuery.sql).toContain('"active_customers"."broker_id"');
    expect(brokerQuery.params).toContain("tenant-a");
    expect(brokerQuery.params).toContain("director-1");
  });
});
