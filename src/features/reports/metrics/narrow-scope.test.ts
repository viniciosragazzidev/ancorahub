import { eq } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { schema } from "@/shared/db";

import { narrowReportScopeToBranch } from "./narrow-scope";

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
