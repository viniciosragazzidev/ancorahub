import { eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { schema } from "@/shared/db";

import { brokersOfBranchCondition, drilldownHref, narrowReportScopeToBranch, parseBranchIdParam } from "./narrow-scope";

const dialect = new PgDialect();

describe("narrowReportScopeToBranch", () => {
  it("returns the same scope without a unit", () => {
    const scope = { leadScope: eq(schema.leads.corretorId, "b1"), canSeeUnits: true };
    expect(narrowReportScopeToBranch(scope)).toBe(scope);
    expect(narrowReportScopeToBranch(scope, null)).toBe(scope);
    expect(narrowReportScopeToBranch(scope, "")).toBe(scope);
  });

  it("adds the unit on top of the session scope (AND), keeping the other fields", () => {
    const scope = { leadScope: eq(schema.leads.corretorId, "b1"), canSeeUnits: true };
    const narrowed = narrowReportScopeToBranch(scope, "br-centro");
    expect(narrowed.canSeeUnits).toBe(true);
    const query = dialect.sqlToQuery(narrowed.leadScope!);
    expect(query.sql).toContain(`"leads"."corretor_id" = $1`);
    expect(query.sql).toContain(" and ");
    expect(query.sql).toContain(`"leads"."branch_id" = $2`);
    expect(query.params).toEqual(["b1", "br-centro"]);
  });

  it("a tenant-wide scope (Diretor) becomes the unit only", () => {
    const query = dialect.sqlToQuery(narrowReportScopeToBranch({ leadScope: undefined }, "br-ni").leadScope!);
    expect(query.sql).toContain(`"leads"."branch_id" = $1`);
    expect(query.params).toEqual(["br-ni"]);
  });
});

describe("brokersOfBranchCondition", () => {
  it("keeps brokers whose membership is in the unit, without filtering the leads by unit", () => {
    const query = dialect.sqlToQuery(brokersOfBranchCondition("t1", "br-centro"));
    expect(query.sql.startsWith(`"leads"."corretor_id" in (select "tenant_memberships"."user_id" from "tenant_memberships"`)).toBe(true);
    expect(query.sql).toContain(`"tenant_memberships"."tenant_id" = $1`);
    expect(query.sql).toContain(`"tenant_memberships"."branch_id" = $2`);
    expect(query.sql).not.toContain(`"leads"."branch_id"`);
    expect(query.params).toEqual(["t1", "br-centro"]);
  });
});

describe("drilldownHref", () => {
  it("is the same link as before without a unit", () => {
    expect(drilldownHref("out-of-sla", 7)).toBe("/dashboard/drill/out-of-sla?period=7");
    expect(drilldownHref("out-of-sla", 7, null)).toBe("/dashboard/drill/out-of-sla?period=7");
  });

  it("carries the unit picked on the overview", () => {
    expect(drilldownHref("stale-negotiations", 30, "br centro&x")).toBe("/dashboard/drill/stale-negotiations?period=30&branchId=br+centro%26x");
  });
});

describe("parseBranchIdParam", () => {
  it("accepts a non-empty id and nothing else", () => {
    expect(parseBranchIdParam(" br-1 ")).toBe("br-1");
    expect(parseBranchIdParam(["br-2", "br-3"])).toBe("br-2");
    expect(parseBranchIdParam("")).toBeNull();
    expect(parseBranchIdParam(undefined)).toBeNull();
    expect(parseBranchIdParam("x".repeat(129))).toBeNull();
  });
});
