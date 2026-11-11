import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { TenantContext } from "@/shared/auth/types";
import {
  buildBrokerClientWalletWhere,
  clampBrokerWalletPage,
  normalizeBrokerClientWalletFilters,
  shouldExposeBrokerRenewalsTab,
} from "./broker-client-wallet";

const broker: TenantContext = {
  userId: "broker-a",
  tenantId: "tenant-a",
  role: "broker",
  jobTitle: "broker",
  branchId: "unit-a",
};
const now = new Date("2026-11-11T15:00:00.000Z");
const compile = (context: TenantContext, filters: Parameters<typeof buildBrokerClientWalletWhere>[1]) =>
  new PgDialect().sqlToQuery(buildBrokerClientWalletWhere(context, filters, now));
const filters = normalizeBrokerClientWalletFilters({ view: "all", page: 1 });

describe("broker client wallet query contract", () => {
  it("always scopes list and count predicates to the authenticated tenant and broker", () => {
    const list = compile(broker, { ...filters, view: "all" });
    const attentionCount = compile(broker, { ...filters, view: "attention" });

    for (const query of [list, attentionCount]) {
      expect(query.sql).toContain('"clients"."tenant_id"');
      expect(query.sql).toContain('"clients"."corretor_id"');
      expect(query.params).toContain("tenant-a");
      expect(query.params).toContain("broker-a");
      expect(query.params).not.toContain("tenant-b");
      expect(query.params).not.toContain("broker-b");
    }
  });

  it("uses only same-tenant, same-broker open tasks and contract-backed renewals", () => {
    const query = compile(broker, {
      ...filters,
      view: "attention",
      returnStatus: "overdue",
    });

    expect(query.sql).toContain('"lead_tasks"."tenant_id"');
    expect(query.sql).toContain('"lead_tasks"."assigned_to"');
    expect(query.sql).toContain('"lead_tasks"."completed_at" is null');
    expect(query.sql).toContain('"active_customers"."renewal_window_start_date"');
    expect(query.sql).toContain('"active_customers"."status"');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("broker-a");
    expect(query.params).toContain("2026-12-11");
  });

  it("keeps search, origin and contract filters in the common list/count predicate", () => {
    const query = compile(broker, normalizeBrokerClientWalletFilters({
      view: "all",
      page: 2,
      query: " Ana_100% ",
      origin: "manual",
      contractStatus: "active",
      returnStatus: "today",
    }));

    expect(query.sql).toContain('"clients"."nome"');
    expect(query.sql).toContain('"clients"."telefone"');
    expect(query.sql).toContain('"leads"."origem"');
    expect(query.sql).toContain('"active_customers"."status"');
    expect(query.sql).toContain('"lead_tasks"."due_at"');
    expect(query.params).toContain("Ana_100%");
    expect(query.params).toContain("manual");
  });

  it("fails closed for roles other than broker", () => {
    const director = { ...broker, userId: "director-a", role: "director" as const, branchId: null };
    const query = compile(director, filters);
    expect(query.sql).toBe("false");
    expect(query.params).toEqual([]);
  });

  it("normalizes URL filters and clamps pagination", () => {
    expect(clampBrokerWalletPage("0")).toBe(1);
    expect(clampBrokerWalletPage("2.9")).toBe(2);
    expect(clampBrokerWalletPage("not-a-page")).toBe(1);
    expect(normalizeBrokerClientWalletFilters({
      view: "invalid" as never,
      page: 999_999,
      query: `  ${"x".repeat(120)}  `,
      contractStatus: "other" as never,
      returnStatus: "other" as never,
    })).toMatchObject({ view: "all", page: 50_000, query: "x".repeat(100) });
  });

  it("shows the renewals cut only when a real active contract has its renewal window", () => {
    expect(shouldExposeBrokerRenewalsTab(0)).toBe(false);
    expect(shouldExposeBrokerRenewalsTab(1)).toBe(true);
  });
});
