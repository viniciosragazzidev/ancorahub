import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

import type { TenantContext } from "@/shared/auth/types";
import {
  buildBrokerClientWalletWhere,
  chooseBrokerClientWalletContract,
  chooseBrokerClientWalletTask,
  clampBrokerWalletPage,
  classifyBrokerClientReturn,
  hasBrokerClientWalletRenewalAttention,
  isBrokerClientWalletRenewalEligible,
  normalizeBrokerClientWalletFilters,
  resolveBrokerClientWalletFilters,
  shouldUseBrokerClientWalletLite,
  shouldExposeBrokerRenewalsTab,
} from "./broker-client-wallet";
import { serializeBrokerClientWalletFilters } from "./broker-client-wallet-url";

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
      expect(query.sql).toContain('"leads"."tenant_id"');
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
    expect(query.sql).toContain('"active_customers"."renewal_status" in');
    expect(query.sql).toContain('"active_customers"."expiration_date" >=');
    expect(query.sql).toContain('"clients"."id" in (select "active_customers"."client_id"');
    expect(query.sql).not.toContain('"active_customers"."client_id" = "clients"."id"');
    expect(query.sql).not.toContain('"lead_tasks"."lead_id" = "clients"."lead_id"');
    expect(query.params).toContain("tenant-a");
    expect(query.params).toContain("broker-a");
    expect(query.params).toContain("2026-12-11");
  });

  it("keeps search, origin and contract filters in the common list/count predicate", () => {
    const query = compile(broker, normalizeBrokerClientWalletFilters({
      view: "all",
      page: 2,
      query: "1234",
      origin: "manual",
      contractStatus: "active",
      returnStatus: "today",
    }));

    expect(query.sql).toContain('"clients"."nome"');
    expect(query.sql).toContain('"clients"."telefone"');
    expect(query.sql).toContain('"leads"."origem"');
    expect(query.sql).toContain('"active_customers"."status"');
    expect(query.sql).toContain('"lead_tasks"."due_at"');
    expect(query.params).toContain("1234");
    expect(query.params).toContain("manual");
  });

  it("searches the phone only for numeric queries with at least four digits", () => {
    const shortNumeric = compile(broker, normalizeBrokerClientWalletFilters({ view: "all", page: 1, query: "123" }));
    const mixedText = compile(broker, normalizeBrokerClientWalletFilters({ view: "all", page: 1, query: "abc 1234" }));
    const phoneNumber = compile(broker, normalizeBrokerClientWalletFilters({ view: "all", page: 1, query: "+55 (21) 1234-5678" }));

    expect(shortNumeric.sql).not.toContain("regexp_replace");
    expect(mixedText.sql).not.toContain("regexp_replace");
    expect(phoneNumber.sql).toContain("regexp_replace");
  });

  it("makes overdue and today exclusive at the current instant", () => {
    const overdue = compile(broker, normalizeBrokerClientWalletFilters({ view: "all", page: 1, returnStatus: "overdue" }));
    const today = compile(broker, normalizeBrokerClientWalletFilters({ view: "all", page: 1, returnStatus: "today" }));

    expect(overdue.sql).toContain('"lead_tasks"."due_at" <');
    expect(today.sql).toContain('"lead_tasks"."due_at" >=');
    expect(classifyBrokerClientReturn(new Date(now.getTime() - 1), now)).toBe("overdue");
    expect(classifyBrokerClientReturn(now, now)).toBe("today");
    expect(classifyBrokerClientReturn(new Date("2026-11-12T03:00:00.000Z"), now)).toBe("future");
    expect(chooseBrokerClientWalletTask([
      { id: "old", title: "Vencido", dueAt: new Date(now.getTime() - 1), priority: "normal" },
      { id: "today", title: "Hoje", dueAt: new Date(now.getTime() + 1), priority: "normal" },
    ], "today", now)?.id).toBe("today");
  });

  it("requires an eligible, unexpired active contract for renewal attention", () => {
    const valid = {
      status: "active",
      renewalStatus: "pending_window",
      renewalWindowStartDate: "2026-12-01",
      expirationDate: "2026-12-31",
      updatedAt: now,
    };
    expect(isBrokerClientWalletRenewalEligible(valid, now)).toBe(true);
    expect(hasBrokerClientWalletRenewalAttention(valid, now)).toBe(true);
    expect(isBrokerClientWalletRenewalEligible({ ...valid, renewalStatus: "completed" }, now)).toBe(false);
    expect(hasBrokerClientWalletRenewalAttention({ ...valid, expirationDate: "2026-11-10" }, now)).toBe(false);
    expect(hasBrokerClientWalletRenewalAttention({ ...valid, renewalWindowStartDate: "2027-01-01" }, now)).toBe(false);
  });

  it("selects the contract matching the active contract filter", () => {
    const active = { status: "active", updatedAt: new Date("2026-11-01T00:00:00.000Z") };
    const cancelled = { status: "cancelled", updatedAt: now };

    expect(chooseBrokerClientWalletContract([cancelled, active])?.status).toBe("active");
    expect(chooseBrokerClientWalletContract([active, cancelled], "cancelled")?.status).toBe("cancelled");
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

  it("normalizes a renewal URL to all when no eligible renewal data exists", () => {
    const requested = normalizeBrokerClientWalletFilters({ view: "renewals", page: 3, query: "Ana", origin: "manual" });

    expect(resolveBrokerClientWalletFilters(requested, false)).toMatchObject({ view: "all", page: 3, query: "Ana", origin: "manual" });
    expect(serializeBrokerClientWalletFilters(resolveBrokerClientWalletFilters(requested, false)))
      .toBe("view=all&page=3&q=Ana&origin=manual");
    expect(resolveBrokerClientWalletFilters(requested, true)).toEqual(requested);
  });

  it("uses the new list only for a Lite broker while the flag is on", () => {
    expect(shouldUseBrokerClientWalletLite({ isLightBroker: true, flagEnabled: true })).toBe(true);
    expect(shouldUseBrokerClientWalletLite({ isLightBroker: true, flagEnabled: false })).toBe(false);
    expect(shouldUseBrokerClientWalletLite({ isLightBroker: false, flagEnabled: true })).toBe(false);
  });
});
