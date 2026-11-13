import fs from "node:fs/promises";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";
import { monthKey, shiftMonth } from "./analytics-core";

const contexts = vi.hoisted(() => ({ get: (() => { throw new Error("Test identity not selected"); }) as () => TenantContext }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => contexts.get() }));
const testUrl = process.env.ERP_TEST_DATABASE_URL;

describe.skipIf(!testUrl)("ERP analytics against isolated PostgreSQL", () => {
  let db: ReturnType<typeof import("@/shared/db").getDatabase>;
  let schema: typeof import("@/shared/db").schema;
  let analytics: typeof import("./analytics");
  let tv: typeof import("./tv");
  const store = new AsyncLocalStorage<TenantContext>();
  const run = crypto.randomUUID();
  const id = (suffix: string) => `${run}-${suffix}`;
  const context = (person: string, role: TenantContext["role"] = "director", tenant = id("a"), branchId: string | null = null): TenantContext => ({ userId: id(person), tenantId: tenant, role, jobTitle: role, branchId });
  const as = <T>(identity: TenantContext, work: () => Promise<T>) => store.run(identity, work);
  const current = monthKey();
  const previous = shiftMonth(current, -1);
  const inMonth = (month: string) => new Date(`${month}-10T15:00:00Z`);
  const now = () => new Date(Date.now() - 60_000);

  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5442" || url.pathname !== "/erp_test" || url.username !== "erp_test") throw new Error("Refusing any database outside isolated ERP test host.");
    const root = process.env.ERP_TEST_ROOT; if (!root) throw new Error("Missing marked test root.");
    const marker = JSON.parse(await fs.readFile(path.join(root, "provenance.json"), "utf8"));
    if (marker.purpose !== "ancorahub-erp-synthetic-tests") throw new Error("Unmarked database root.");
    process.env.DATABASE_URL = testUrl; process.env.SUPABASE_DB_URL = testUrl; delete process.env.DATABASE_SSL;
    const shared = await import("@/shared/db");
    schema = shared.schema; db = shared.getDatabase();
    const result = await db.execute(sql`SHOW data_directory`);
    if (path.resolve(String(result[0].data_directory)).toLowerCase() !== path.resolve(root, "data-erp-test").toLowerCase()) throw new Error("Unexpected test server directory.");
    contexts.get = () => { const identity = store.getStore(); if (!identity) throw new Error("No synthetic session"); return identity; };
    analytics = await import("./analytics"); tv = await import("./tv");

    await db.insert(schema.tenants).values([{ id: id("a"), name: "Empresa A sintética", slug: id("a") }, { id: id("b"), name: "Empresa B sintética", slug: id("b") }]);
    await db.insert(schema.branches).values([{ id: id("a1"), tenantId: id("a"), name: "Unidade A1" }, { id: id("a2"), tenantId: id("a"), name: "Unidade A2" }, { id: id("b1"), tenantId: id("b"), name: "Unidade B1" }]);
    const people: [string, string, "director" | "broker" | "supervisor", string | null][] = [
      ["director", "a", "director", null], ["supervisor", "a", "supervisor", "a1"], ["broker1", "a", "broker", "a1"], ["broker2", "a", "broker", "a2"], ["other", "b", "director", null],
    ];
    for (const [person, tenant, role, branch] of people) {
      await db.insert(schema.user).values({ id: id(person), name: `Pessoa ${person}`, email: `${id(person)}@example.invalid` });
      await db.insert(schema.tenantMemberships).values({ id: id(`membership-${person}`), tenantId: id(tenant), userId: id(person), role, jobTitle: role, branchId: branch ? id(branch) : null, supervisorId: person === "broker1" ? id("supervisor") : null });
    }
    await db.insert(schema.carriers).values({ id: id("carrier"), tenantId: id("a"), name: "Operadora Sintética" });
    await db.insert(schema.carrierPlans).values({ id: id("plan"), tenantId: id("a"), carrierId: id("carrier"), name: "Plano Sintético" });
    const leads = [[1, "a", "a1", "broker1"], [2, "a", "a2", "broker2"], [3, "a", "a1", "broker1"], [4, "b", "b1", "other"], [5, "a", "a1", "broker1"], [6, "a", "a1", "broker1"]] as const;
    await db.insert(schema.leads).values(leads.map(([n, tenant, branch, broker]) => ({ id: id(`lead${n}`), tenantId: id(tenant), branchId: id(branch), corretorId: id(broker), nome: `Negócio sintético ${n}`, telefone: "00000000000", status: "converted" as const })));
    const sale = (n: number, tenant: string, broker: string, saleDate: Date, saleValue: string, extra: Partial<typeof schema.sales.$inferInsert> = {}) => ({ id: id(`sale${n}`), tenantId: id(tenant), leadId: id(`lead${n}`), brokerId: id(broker), saleDate, saleValue, createdBy: id(tenant === "a" ? "director" : "other"), ...extra });
    await db.insert(schema.sales).values([
      sale(1, "a", "broker1", now(), "100.00", { carrierPlanId: id("plan") }),
      sale(2, "a", "broker2", now(), "200.00"),
      sale(3, "a", "broker1", now(), "50.00", { status: "cancelled" }),
      sale(4, "b", "other", now(), "999.00"),
      sale(5, "a", "broker1", inMonth(previous), "10.00"),
      sale(6, "a", "broker1", inMonth(shiftMonth(previous, -12)), "10.00"),
    ]);
    // Three commission installments for one sale must not inflate production.
    await db.insert(schema.commissionSchedule).values([1, 2, 3].map((monthNumber) => ({ id: id(`commission${monthNumber}`), tenantId: id("a"), saleId: id("sale1"), monthNumber, referenceMonth: shiftMonth(current, monthNumber - 1), percentage: "10.00", amount: "10.00" })));
    await db.insert(schema.goals).values([
      { id: id("goal-tenant"), tenantId: id("a"), scope: "tenant", scopeId: id("a"), name: "Meta empresa", targetType: "sales_count", targetValue: "10", period: current, startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 86_400_000), createdBy: id("director") },
      { id: id("goal-broker2"), tenantId: id("a"), scope: "broker", scopeId: id("broker2"), name: "Meta corretor 2", targetType: "revenue", targetValue: "5000.00", period: current, startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 86_400_000), createdBy: id("director") },
      { id: id("goal-broker1"), tenantId: id("a"), scope: "broker", scopeId: id("broker1"), name: "Meta corretor 1", targetType: "revenue", targetValue: "3000.00", period: current, startDate: new Date(Date.now() - 86_400_000), endDate: new Date(Date.now() + 86_400_000), createdBy: id("director") },
    ]);
    const { FEATURE_FLAGS } = await import("@/shared/feature-flags/catalog");
    const { ERP_MODULE_KEYS } = await import("./contracts");
    const modules = [...ERP_MODULE_KEYS];
    for (const [key, value] of [[FEATURE_FLAGS.ERP_OPERATIONAL.key, "true"], [FEATURE_FLAGS.ERP_MODULES.key, JSON.stringify(modules)]]) await db.insert(schema.systemSettings).values({ key, value }).onConflictDoUpdate({ target: schema.systemSettings.key, set: { value } });
    for (const tenantId of [id("a"), id("b")]) await db.insert(schema.erpModuleSettings).values(["analytics", "tv"].map((moduleKey) => ({ tenantId, moduleKey, enabled: true, roles: ["director", "manager", "supervisor", "broker"], updatedBy: id(tenantId === id("a") ? "director" : "other") })));
  }, 30000);
  afterAll(async () => { if (db) await db.$client.end({ timeout: 5 }); });

  const monthRow = <T extends { month: string }>(rows: T[], month: string) => rows.find((row) => row.month === month);

  it("counts a sale with several commission rows once and keeps cancellations apart", async () => {
    const report = await as(context("director"), () => analytics.getProductionReport({ from: previous, to: current }));
    const row = monthRow(report.rows, current)!;
    expect(row).toMatchObject({ count: 2, cancelled: 1, cents: 30000, partial: true });
    expect(monthRow(report.rows, previous)).toMatchObject({ count: 1, cents: 1000, partial: false });
    expect(report.totals.cash).toBe(0);
    const [events] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.erpEvents).where(and(eq(schema.erpEvents.tenantId, id("a")), eq(schema.erpEvents.action, "erp.analytics.viewed")));
    expect(events.total).toBeGreaterThan(0);
  });

  it("isolates tenants", async () => {
    const report = await as(context("other", "director", id("b")), () => analytics.getProductionReport({ from: current, to: current }));
    expect(monthRow(report.rows, current)).toMatchObject({ count: 1, cents: 99900, cancelled: 0 });
    await expect(as(context("other", "director", id("b")), () => analytics.getProductionReport({ from: current, to: current, unit: id("a1") }))).rejects.toThrow("escopo");
  });

  it("limits a broker to own sales and hides agency cash", async () => {
    const report = await as(context("broker1", "broker", id("a"), id("a1")), () => analytics.getProductionReport({ from: current, to: current }));
    expect(monthRow(report.rows, current)).toMatchObject({ count: 1, cancelled: 1, cents: 10000, cash: null });
    expect(report.visibility).toEqual({ values: true, cash: false });
    const carriers = await as(context("broker1", "broker", id("a"), id("a1")), () => analytics.getCarrierReport({ from: current, to: current }));
    expect(carriers.rows.map((row) => [row.name, row.count, row.cancelled])).toEqual([["Operadora Sintética", 1, 0], ["Não informada", 0, 1]]);
    const director = await as(context("director"), () => analytics.getCarrierReport({ from: current, to: current }));
    expect(director.rows.map((row) => [row.name, row.count, row.share, row.cancelled])).toEqual([["Não informada", 1, 5000, 1], ["Operadora Sintética", 1, 5000, 0]]);
    const goals = await as(context("broker1", "broker", id("a"), id("a1")), () => analytics.getScopedGoals());
    expect(goals.rows.map((row) => row.name)).toEqual(["Meta corretor 1"]);
  });

  it("shows a supervisor the team's counts without colleagues' values", async () => {
    const report = await as(context("supervisor", "supervisor", id("a"), id("a1")), () => analytics.getProductionReport({ from: current, to: current }));
    expect(report.visibility.values).toBe(false);
    expect(monthRow(report.rows, current)).toMatchObject({ count: 1, cents: null, cash: null });
    const goals = await as(context("supervisor", "supervisor", id("a"), id("a1")), () => analytics.getScopedGoals());
    const broker1 = goals.rows.find((row) => row.name === "Meta corretor 1");
    expect(broker1?.hideMoney).toBe(true); expect(broker1?.target).toBeNull();
    expect(goals.rows.some((row) => row.name === "Meta corretor 2")).toBe(false);
  });

  it("returns no YoY over a zero base and compares months with history", async () => {
    const report = await as(context("director"), () => analytics.getGrowthReport({}));
    expect(monthRow(report.rows, current)).toMatchObject({ count: 2, previousCount: null, countYoy: null, partial: true });
    expect(monthRow(report.rows, previous)).toMatchObject({ count: 1, previousCount: 1, countYoy: 0 });
  });

  it("lists every day of the month with sales and created leads", async () => {
    const report = await as(context("director"), () => analytics.getDailyReport({ month: previous }));
    expect(report.rows.length).toBeGreaterThanOrEqual(28);
    expect(report.rows.find((row) => row.day === `${previous}-10`)?.count).toBe(1);
    expect(report.totals.leads).toBe(0);
  });

  it("shows TV units only, and names only with the tenant policy", async () => {
    const board = await as(context("director"), () => tv.getTvBoard());
    expect(board.tiles.find((tile) => tile.id === "production-count")).toMatchObject({ value: "2" });
    expect(board.tiles.some((tile) => tile.id === "brokers")).toBe(false);
    expect(JSON.stringify(board)).not.toContain("Pessoa broker");
    await db.update(schema.erpModuleSettings).set({ params: { showNames: true } }).where(and(eq(schema.erpModuleSettings.tenantId, id("a")), eq(schema.erpModuleSettings.moduleKey, "tv")));
    const named = await as(context("director"), () => tv.getTvBoard());
    expect(named.tiles.some((tile) => tile.id === "brokers")).toBe(true);
  });
});
