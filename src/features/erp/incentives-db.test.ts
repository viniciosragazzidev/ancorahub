import fs from "node:fs/promises";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";

const contexts = vi.hoisted(() => ({ get: (() => { throw new Error("Test identity not selected"); }) as () => TenantContext }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => contexts.get() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const testUrl = process.env.ERP_TEST_DATABASE_URL;

describe.skipIf(!testUrl)("ERP incentives against isolated PostgreSQL", () => {
  let db: ReturnType<typeof import("@/shared/db").getDatabase>;
  let schema: typeof import("@/shared/db").schema;
  let incentives: typeof import("./incentives");
  let modulesSetting: { key: string; value: string }[] = [];
  const run = crypto.randomUUID();
  const id = (suffix: string) => `${run}-${suffix}`;
  const store = new AsyncLocalStorage<TenantContext>();
  const roles: Record<string, { role: TenantContext["role"]; tenant: string; branch: string | null }> = {};
  const as = <T>(person: string, work: () => Promise<T>) => { const r = roles[person]; return store.run({ userId: id(person), tenantId: r.tenant, role: r.role, jobTitle: r.role, branchId: r.branch }, work); };
  const campaign = (overrides: Record<string, unknown> = {}) => ({ name: "Campanha sintética", regulation: "Regulamento sintético para testes automatizados.", metric: "sales_count", startsOn: "2026-11-01", endsOn: "2026-11-30", branchIds: [], prize: "Troféu", showNames: false, ...overrides });
  async function approved(overrides: Record<string, unknown> = {}) {
    const campaignId = await as("director", () => incentives.createIncentiveCampaign(campaign(overrides)));
    await as("reviewer", () => incentives.approveIncentiveCampaign({ id: campaignId, expectedVersion: 1 }));
    return campaignId;
  }

  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5442" || url.pathname !== "/erp_test" || url.username !== "erp_test") throw new Error("Refusing any database outside isolated ERP test host.");
    const root = process.env.ERP_TEST_ROOT; if (!root) throw new Error("Missing marked test root.");
    const marker = JSON.parse(await fs.readFile(path.join(root, "provenance.json"), "utf8"));
    if (marker.purpose !== "ancorahub-erp-synthetic-tests") throw new Error("Unmarked database root.");
    process.env.DATABASE_URL = testUrl; process.env.SUPABASE_DB_URL = testUrl; delete process.env.DATABASE_SSL;
    const shared = await import("@/shared/db"); schema = shared.schema; db = shared.getDatabase();
    const result = await db.execute(sql`SHOW data_directory`);
    if (path.resolve(String(result[0].data_directory)).toLowerCase() !== path.resolve(root, "data-erp-test").toLowerCase()) throw new Error("Unexpected test server directory.");
    contexts.get = () => { const identity = store.getStore(); if (!identity) throw new Error("No synthetic session"); return identity; };
    incentives = await import("./incentives");
    await db.insert(schema.tenants).values([{ id: id("a"), name: "Empresa A sintética", slug: id("a") }, { id: id("b"), name: "Empresa B sintética", slug: id("b") }]);
    await db.insert(schema.branches).values([{ id: id("a1"), tenantId: id("a"), name: "Unidade A1" }, { id: id("a2"), tenantId: id("a"), name: "Unidade A2" }, { id: id("b1"), tenantId: id("b"), name: "Unidade B1" }]);
    Object.assign(roles, { director: { role: "director", tenant: id("a"), branch: null }, reviewer: { role: "director", tenant: id("a"), branch: null }, other: { role: "director", tenant: id("b"), branch: null },
      broker1: { role: "broker", tenant: id("a"), branch: id("a1") }, broker2: { role: "broker", tenant: id("a"), branch: id("a2") }, broker3: { role: "broker", tenant: id("a"), branch: id("a1") }, brokerB: { role: "broker", tenant: id("b"), branch: id("b1") } });
    for (const [person, r] of Object.entries(roles)) {
      await db.insert(schema.user).values({ id: id(person), name: `Teste ${person}`, email: `${id(person)}@example.invalid` });
      await db.insert(schema.tenantMemberships).values({ id: id(`membership-${person}`), tenantId: r.tenant, userId: id(person), role: r.role, jobTitle: r.role, branchId: r.branch });
    }
    await db.insert(schema.leads).values([["lead1", "a", "a1", "broker1"], ["lead2", "a", "a2", "broker2"], ["lead3", "b", "b1", "brokerB"]].map(([lead, tenant, branch, broker]) => ({ id: id(lead), tenantId: id(tenant), nome: `Negócio ${lead}`, telefone: "00000000000", branchId: id(branch), corretorId: id(broker), status: "converted" as const })));
    const sale = (key: string, lead: string, broker: string, at: string, value: string, status: "active" | "cancelled" = "active", tenant = "a") => ({ id: id(key), tenantId: id(tenant), leadId: id(lead), brokerId: id(broker), saleDate: new Date(at), saleValue: value, status, createdBy: id("director") });
    await db.insert(schema.sales).values([
      sale("s1", "lead1", "broker1", "2026-11-03T15:00:00Z", "100.00"),
      sale("s2", "lead2", "broker2", "2026-11-02T15:00:00Z", "100.00"),
      sale("s3", "lead1", "broker1", "2026-11-05T15:00:00Z", "999.00", "cancelled"),
      sale("s4", "lead1", "broker1", "2026-11-01T02:30:00Z", "50.00"), // 31/10 23:30 in São Paulo: outside the period
      sale("s5", "lead3", "brokerB", "2026-11-04T15:00:00Z", "700.00", "active", "b"),
      sale("s6", "lead1", "broker1", "2026-10-10T15:00:00Z", "10.00"),
    ]);
    const { FEATURE_FLAGS } = await import("@/shared/feature-flags/catalog");
    const { ERP_MODULE_KEYS } = await import("./contracts");
    modulesSetting = [{ key: FEATURE_FLAGS.ERP_OPERATIONAL.key, value: "true" }, { key: FEATURE_FLAGS.ERP_MODULES.key, value: JSON.stringify(ERP_MODULE_KEYS) }];
    for (const tenantId of [id("a"), id("b")]) await db.insert(schema.erpModuleSettings).values(["incentives", "analytics"].map((moduleKey) => ({ tenantId, moduleKey, enabled: true, roles: ["director", "manager", "supervisor", "broker"], updatedBy: id("director") })));
  }, 30000);
  // The platform flag row is global; other synthetic suites may rewrite it, so restore it before each case.
  beforeEach(async () => { for (const row of modulesSetting) await db.insert(schema.systemSettings).values(row).onConflictDoUpdate({ target: schema.systemSettings.key, set: { value: row.value } }); });
  afterAll(async () => { if (db) await db.$client.end({ timeout: 5 }); });

  it("requires an independent approval in code and in the database", async () => {
    const campaignId = await as("director", () => incentives.createIncentiveCampaign(campaign()));
    await expect(as("director", () => incentives.approveIncentiveCampaign({ id: campaignId, expectedVersion: 1 }))).rejects.toThrow("outra pessoa");
    await expect(db.update(schema.erpIncentiveCampaigns).set({ status: "approved", approvedBy: id("director") }).where(eq(schema.erpIncentiveCampaigns.id, campaignId))).rejects.toThrow();
    await expect(as("broker1", () => incentives.approveIncentiveCampaign({ id: campaignId, expectedVersion: 1 }))).rejects.toThrow("cargo");
    // Editing makes the editor the preparer of the new version.
    await as("reviewer", () => incentives.updateIncentiveCampaign({ id: campaignId, expectedVersion: 1, campaign: campaign({ name: "Campanha revisada" }) }));
    await expect(as("reviewer", () => incentives.approveIncentiveCampaign({ id: campaignId, expectedVersion: 2 }))).rejects.toThrow("outra pessoa");
    await as("director", () => incentives.approveIncentiveCampaign({ id: campaignId, expectedVersion: 2 }));
    await expect(as("director", () => incentives.updateIncentiveCampaign({ id: campaignId, expectedVersion: 2, campaign: campaign({ regulation: "Regulamento alterado em silêncio depois da aprovação." }) }))).rejects.toThrow("rascunhos");
  });

  it("ranks eligible facts deterministically and reproduces the digest", async () => {
    const campaignId = await approved();
    const first = await as("director", () => incentives.runIncentiveCalculation({ id: campaignId, expectedVersion: 1, kind: "preliminary" }));
    const second = await as("reviewer", () => incentives.runIncentiveCalculation({ id: campaignId, expectedVersion: 1, kind: "preliminary" }));
    const rows = await db.select().from(schema.erpIncentiveResults).where(eq(schema.erpIncentiveResults.campaignId, campaignId));
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(first)!.digest).toBe(byId.get(second)!.digest);
    const snapshot = byId.get(first)!.snapshot as { rows: { brokerId: string; value: number; facts: string[] }[] };
    // Tie on one sale each: broker2 reached it first (02/11). Cancelled, out-of-period and other-tenant sales are excluded.
    expect(snapshot.rows.map((row) => [row.brokerId, row.value, row.facts])).toEqual([[id("broker2"), 1, [id("s2")]], [id("broker1"), 1, [id("s1")]]]);
    await db.update(schema.sales).set({ status: "cancelled" }).where(eq(schema.sales.id, id("s2")));
    try {
      const third = await as("director", () => incentives.runIncentiveCalculation({ id: campaignId, expectedVersion: 1, kind: "preliminary" }));
      const [changed] = await db.select().from(schema.erpIncentiveResults).where(eq(schema.erpIncentiveResults.id, third));
      expect(changed.digest).not.toBe(byId.get(first)!.digest);
    } finally { await db.update(schema.sales).set({ status: "active" }).where(eq(schema.sales.id, id("s2"))); }
  });

  it("keeps results append-only", async () => {
    const campaignId = await approved();
    const resultId = await as("director", () => incentives.runIncentiveCalculation({ id: campaignId, expectedVersion: 1, kind: "preliminary" }));
    await expect(db.execute(sql`UPDATE erp_incentive_results SET digest = 'tampered' WHERE id = ${resultId}`)).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM erp_incentive_results WHERE id = ${resultId}`)).rejects.toThrow();
  });

  it("isolates tenants", async () => {
    const campaignId = await approved();
    await expect(as("other", () => incentives.getIncentiveCampaign(campaignId))).rejects.toThrow("escopo");
    await expect(as("other", () => incentives.runIncentiveCalculation({ id: campaignId, expectedVersion: 1, kind: "preliminary" }))).rejects.toThrow("escopo");
    await expect(as("other", () => incentives.cancelIncentiveCampaign({ id: campaignId, expectedVersion: 1, reason: "Tentativa de outra empresa" }))).rejects.toThrow("escopo");
    const list = await as("other", () => incentives.getIncentiveCampaigns());
    expect(list.rows.some((row) => row.id === campaignId)).toBe(false);
  });

  it("applies the exposure policy, records contestations and closes only after the period", async () => {
    const campaignId = await approved({ metric: "sales_value_cents", startsOn: "2026-10-01", endsOn: "2026-11-30" });
    const draftId = await as("director", () => incentives.createIncentiveCampaign(campaign({ name: "Rascunho oculto" })));
    expect((await as("broker1", () => incentives.getIncentiveCampaigns())).rows.some((row) => row.id === draftId)).toBe(false);
    const resultId = await as("director", () => incentives.runIncentiveCalculation({ id: campaignId, expectedVersion: 1, kind: "preliminary" }));
    const view = await as("broker1", () => incentives.getIncentiveCampaign(campaignId));
    // broker1: s1 (100,00) + s4 (50,00) + s6 (10,00) = 16000; broker2: 10000.
    expect(view.latest?.ranking).toEqual([{ position: 1, label: "Você", isViewer: true, value: 16000 }, { position: 2, label: "Corretor 2", isViewer: false, value: null }]);
    expect(view.canManage).toBe(false);
    const managerView = await as("director", () => incentives.getIncentiveCampaign(campaignId));
    expect(managerView.latest?.ranking.map((row) => row.value)).toEqual([16000, 10000]);
    await expect(as("broker3", () => incentives.contestIncentiveResult({ resultId, note: "Não participei mas quero contestar" }))).rejects.toThrow("participantes");
    await as("broker1", () => incentives.contestIncentiveResult({ resultId, note: "Faltou uma venda minha de novembro" }));
    const [contested] = await db.select().from(schema.erpEvents)
      .where(and(eq(schema.erpEvents.tenantId, id("a")), eq(schema.erpEvents.action, "erp.incentive.contested"), eq(schema.erpEvents.entityId, campaignId)));
    expect(contested).toMatchObject({ entityType: "erp_incentive_campaign", metadata: expect.objectContaining({ resultId }) });
    // Older contestations were stored on the result entity; they are still read.
    await db.insert(schema.erpEvents).values({ id: crypto.randomUUID(), tenantId: id("a"), actorId: id("broker1"), action: "erp.incentive.contested",
      entityType: "erp_incentive_result", entityId: resultId, metadata: { campaignId, note: "Contestação no formato antigo", position: 1 } });
    const contestations = (await as("director", () => incentives.getIncentiveCampaign(campaignId))).contestations;
    expect(contestations.map((row) => row.note).sort()).toEqual(["Contestação no formato antigo", "Faltou uma venda minha de novembro"]);
    expect(contestations.every((row) => row.resultId === resultId)).toBe(true);
    expect((await as("broker1", () => incentives.getIncentiveCampaign(campaignId))).contestations.map((row) => row.author)).toEqual(["Você", "Você"]);
    const [stored] = await db.select().from(schema.erpIncentiveResults).where(and(eq(schema.erpIncentiveResults.tenantId, id("a")), eq(schema.erpIncentiveResults.id, resultId)));
    expect(stored.kind).toBe("preliminary");
    const future = await approved({ endsOn: "2099-12-31" });
    await expect(as("director", () => incentives.runIncentiveCalculation({ id: future, expectedVersion: 1, kind: "final" }))).rejects.toThrow("último dia");
    const past = await approved({ startsOn: "2026-10-01", endsOn: "2026-10-31" });
    await as("director", () => incentives.runIncentiveCalculation({ id: past, expectedVersion: 1, kind: "final" }));
    const [closed] = await db.select().from(schema.erpIncentiveCampaigns).where(eq(schema.erpIncentiveCampaigns.id, past));
    expect(closed.status).toBe("closed");
    await expect(as("director", () => incentives.runIncentiveCalculation({ id: past, expectedVersion: 1, kind: "preliminary" }))).rejects.toThrow("aprovadas");
    await expect(as("director", () => incentives.cancelIncentiveCampaign({ id: past, expectedVersion: 1, reason: "Tentativa após encerramento" }))).rejects.toThrow("encerrada");
  });
});
