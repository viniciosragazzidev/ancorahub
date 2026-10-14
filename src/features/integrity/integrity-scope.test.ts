import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const { resolveReportDataScope } = vi.hoisted(() => ({ resolveReportDataScope: vi.fn() }));
vi.mock("@/features/reports/metrics/metric-scope", () => ({ resolveReportDataScope }));

import type { TenantContext } from "@/shared/auth/types";
import {
  buildIntegrityAuditScope,
  buildIntegrityLeadScope,
  canViewIntegrityPanel,
} from "./integrity-scope";

const director: TenantContext = {
  userId: "director-1", tenantId: "tenant-a", role: "director", jobTitle: "director", branchId: null,
};

function compile(query: Parameters<PgDialect["sqlToQuery"]>[0]) {
  return new PgDialect().sqlToQuery(query);
}

describe("integrity panel access and scope", () => {
  beforeEach(() => resolveReportDataScope.mockReset().mockResolvedValue({ leadScope: undefined }));

  it("requires ver_painel_integridade and preserves the standard director access", async () => {
    await expect(canViewIntegrityPanel(director)).resolves.toBe(true);
    await expect(canViewIntegrityPanel({ ...director, role: "broker", jobTitle: "broker" })).resolves.toBe(false);
  });

  it("binds legacy audit rows to the active tenant membership at event time", () => {
    const query = compile(buildIntegrityAuditScope(director));
    expect(query.sql).toContain("tenant_memberships");
    expect(query.sql).toContain("tenant_id");
    expect(query.sql).toContain("updated_at");
    expect(query.params).toContain("tenant-a");
    expect(query.params).not.toContain("tenant-b");
  });

  it("keeps managers in their authenticated unit and tenant", async () => {
    const query = compile(await buildIntegrityLeadScope({
      ...director, userId: "manager-1", role: "manager", jobTitle: "manager", branchId: "unit-a",
    }));
    expect(query.sql).toContain('"leads"."tenant_id"');
    expect(query.sql).toContain('"leads"."branch_id"');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("unit-a");
    expect(query.params).not.toContain("unit-b");
  });

  it("fails closed for a manager without a unit", async () => {
    const query = compile(await buildIntegrityLeadScope({
      ...director, userId: "manager-1", role: "manager", jobTitle: "manager", branchId: null,
    }));
    expect(query.sql).toContain("false");
  });

  it("limits supervisors to active team memberships in the same tenant", async () => {
    const query = compile(await buildIntegrityLeadScope({
      ...director, userId: "supervisor-1", role: "supervisor", jobTitle: "supervisor", branchId: "unit-a",
    }));
    expect(query.sql).toContain('"tenant_memberships"."tenant_id"');
    expect(query.sql).toContain('"tenant_memberships"."supervisor_id"');
    expect(query.sql).toContain('"tenant_memberships"."status"');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("supervisor-1");
  });

  it("keeps director leads tenant-wide without adding unit or team filters", async () => {
    const query = compile(await buildIntegrityLeadScope(director));
    expect(query.sql).toContain('"leads"."tenant_id"');
    expect(query.params).toContain("tenant-a");
    expect(query.sql).not.toContain('"leads"."branch_id"');
    expect(query.sql).not.toContain('"tenant_memberships"."supervisor_id"');
  });
});
