import fs from "node:fs/promises";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";

const contexts = vi.hoisted(() => ({ get: (() => { throw new Error("Test identity not selected"); }) as () => TenantContext }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => contexts.get() }));
const testUrl = process.env.ERP_TEST_DATABASE_URL;

describe.skipIf(!testUrl)("ERP referrals against isolated PostgreSQL", () => {
  let db: ReturnType<typeof import("@/shared/db").getDatabase>;
  let schema: typeof import("@/shared/db").schema;
  let referrals: typeof import("./referrals");
  let enableModules: () => Promise<void>;
  const store = new AsyncLocalStorage<TenantContext>();
  const run = crypto.randomUUID();
  const id = (suffix: string) => `${run}-${suffix}`;
  const context = (person: string, role: TenantContext["role"] = "director", tenant = id("a"), branchId: string | null = null): TenantContext => ({ userId: id(person), tenantId: tenant, role, jobTitle: role, branchId });
  const as = <T>(identity: TenantContext, work: () => Promise<T>) => store.run(identity, work);
  const director = () => context("director");
  const manager = () => context("manager", "manager", id("a"), id("a1"));
  const broker1 = () => context("broker1", "broker", id("a"), id("a1"));
  const broker2 = () => context("broker2", "broker", id("a"), id("a2"));
  const other = () => context("other", "director", id("b"));
  // Phones unique per run: 11-digit national numbers built from the run id.
  const seed = Number.parseInt(run.replace(/\D/g, "").slice(0, 6).padEnd(6, "1"), 10) % 1_000_000;
  const phone = (n: number) => `(21) 9${String((seed + n * 7919) % 100_000_000).padStart(8, "0")}`;
  const payload = (n: number, extra: Record<string, unknown> = {}) => ({ requestId: crypto.randomUUID(), referrerName: "Indicador sintético", referrerUserId: null, referrerContact: "", channel: "cliente", referredName: `Indicado sintético ${n}`, referredPhone: phone(n), consent: true, notes: "", ownerId: null, ...extra });
  const row = async (referralId: string) => (await db.select().from(schema.erpReferrals).where(and(eq(schema.erpReferrals.tenantId, id("a")), eq(schema.erpReferrals.id, referralId))))[0];

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
    referrals = await import("./referrals");
    await db.insert(schema.tenants).values([{ id: id("a"), name: "Empresa A sintética", slug: id("a") }, { id: id("b"), name: "Empresa B sintética", slug: id("b") }]);
    await db.insert(schema.branches).values([{ id: id("a1"), tenantId: id("a"), name: "Unidade A1" }, { id: id("a2"), tenantId: id("a"), name: "Unidade A2" }, { id: id("b1"), tenantId: id("b"), name: "Unidade B1" }]);
    for (const person of ["director", "manager", "broker1", "broker2", "other"]) {
      const role = ["director", "other"].includes(person) ? "director" : person === "manager" ? "manager" : "broker";
      await db.insert(schema.user).values({ id: id(person), name: `Teste ${person}`, email: `${id(person)}@example.invalid` });
      await db.insert(schema.tenantMemberships).values({ id: id(`membership-${person}`), tenantId: person === "other" ? id("b") : id("a"), userId: id(person), role, jobTitle: role, branchId: person === "broker2" ? id("a2") : ["broker1", "manager"].includes(person) ? id("a1") : null });
    }
    await db.insert(schema.leads).values([
      { id: id("lead1"), tenantId: id("a"), nome: "Negócio sintético 1", telefone: `55${phone(101).replace(/\D/g, "")}`, branchId: id("a1"), corretorId: id("broker1"), status: "negotiation" as const },
      { id: id("lead2"), tenantId: id("a"), nome: "Negócio sintético 2", telefone: phone(102), branchId: id("a1"), corretorId: id("broker1"), status: "negotiation" as const },
      { id: id("lead3"), tenantId: id("a"), nome: "Negócio sintético 3", telefone: phone(103), branchId: id("a2"), corretorId: id("broker2"), status: "negotiation" as const },
      { id: id("lead4"), tenantId: id("b"), nome: "Negócio sintético 4", telefone: phone(104), branchId: id("b1"), corretorId: id("other"), status: "converted" as const },
    ]);
    const { FEATURE_FLAGS } = await import("@/shared/feature-flags/catalog");
    enableModules = async () => {
      for (const [key, value] of [[FEATURE_FLAGS.ERP_OPERATIONAL.key, "true"], [FEATURE_FLAGS.ERP_MODULES.key, JSON.stringify(["implantations", "imports", "finance", "referrals"])]]) await db.insert(schema.systemSettings).values({ key, value }).onConflictDoUpdate({ target: schema.systemSettings.key, set: { value } });
    };
    await enableModules();
    for (const tenantId of [id("a"), id("b")]) await db.insert(schema.erpModuleSettings).values({ tenantId, moduleKey: "referrals", enabled: true, roles: ["director", "manager", "supervisor", "broker"], updatedBy: id("director") });
  }, 30000);
  // Another ERP DB suite rewrites the global module list; reassert it for each scenario.
  beforeEach(async () => { await enableModules(); });
  afterAll(async () => { if (db) await db.$client.end({ timeout: 5 }); });

  it("keeps tenants and brokers isolated while the unit manager sees the unit", async () => {
    const mine = await as(broker1(), () => referrals.registerReferral(payload(1)));
    expect((await row(mine)).ownerId).toBe(id("broker1")); expect((await row(mine)).branchId).toBe(id("a1"));
    expect((await as(broker2(), () => referrals.getReferrals({}))).rows.some((item) => item.id === mine)).toBe(false);
    expect((await as(other(), () => referrals.getReferrals({}))).rows).toEqual([]);
    expect((await as(manager(), () => referrals.getReferrals({}))).rows.map((item) => item.id)).toContain(mine);
    await expect(as(broker2(), () => referrals.changeReferralStatus({ id: mine, expectedVersion: 1, status: "validated", reason: "", leadId: null }))).rejects.toThrow("escopo");
    await expect(as(other(), () => referrals.changeReferralStatus({ id: mine, expectedVersion: 1, status: "validated", reason: "", leadId: null }))).rejects.toThrow("escopo");
    await expect(as(broker1(), () => referrals.registerReferral(payload(2, { ownerId: id("broker2") })))).rejects.toThrow("gestão");
    await expect(as(manager(), () => referrals.registerReferral(payload(3, { ownerId: id("broker2") })))).rejects.toThrow("escopo");
    const assigned = await as(director(), () => referrals.registerReferral(payload(4, { ownerId: id("broker2") })));
    expect((await row(assigned)).branchId).toBe(id("a2"));
  });

  it("deduplicates in scope with a link and out of scope without revealing data", async () => {
    await as(broker1(), () => referrals.registerReferral(payload(10)));
    const inside = await as(broker1(), () => referrals.registerReferral(payload(10, { referredPhone: `+55 ${phone(10)}` })).catch((error: unknown) => error));
    expect(inside).toBeInstanceOf(referrals.ReferralDuplicateError);
    expect((inside as InstanceType<typeof referrals.ReferralDuplicateError>).href).toMatch(/^\/indicacoes\?id=/);
    const outside = await as(broker2(), () => referrals.registerReferral(payload(10)).catch((error: unknown) => error));
    expect((outside as Error).message).toBe("Já existe um atendimento para este contato; fale com a gestão.");
    expect((outside as InstanceType<typeof referrals.ReferralDuplicateError>).href).toBeNull();
    const ownLead = await as(broker1(), () => referrals.registerReferral(payload(101)).catch((error: unknown) => error));
    expect((ownLead as InstanceType<typeof referrals.ReferralDuplicateError>).href).toBe(`/leads/${id("lead1")}`);
    await expect(as(broker2(), () => referrals.registerReferral(payload(101)))).rejects.toThrow("fale com a gestão");
    expect(await as(other(), () => referrals.registerReferral({ ...payload(101), referredPhone: phone(101) }))).toBeTypeOf("string");
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.erpReferrals).where(and(eq(schema.erpReferrals.tenantId, id("a")), eq(schema.erpReferrals.phoneDigits, phone(10).replace(/\D/g, ""))));
    expect(total).toBe(1);
  });

  it("is idempotent per request, including concurrent submissions", async () => {
    const input = payload(20);
    const first = await as(broker1(), () => referrals.registerReferral(input));
    expect(await as(broker1(), () => referrals.registerReferral(input))).toBe(first);
    const concurrent = payload(21);
    const results = await as(broker1(), () => Promise.all([referrals.registerReferral(concurrent), referrals.registerReferral(concurrent)]));
    expect(results[0]).toBe(results[1]);
    const racing = await as(broker1(), () => Promise.allSettled([referrals.registerReferral(payload(22)), referrals.registerReferral(payload(22))]));
    expect(racing.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });

  it("rejects stale versions and requires a converted lead to convert, with audit", async () => {
    const referralId = await as(broker1(), () => referrals.registerReferral(payload(30)));
    await as(broker1(), () => referrals.changeReferralStatus({ id: referralId, expectedVersion: 1, status: "validated", reason: "", leadId: null }));
    await expect(as(broker1(), () => referrals.changeReferralStatus({ id: referralId, expectedVersion: 1, status: "contacting", reason: "", leadId: null }))).rejects.toThrow("mudou");
    await as(broker1(), () => referrals.changeReferralStatus({ id: referralId, expectedVersion: 2, status: "contacting", reason: "", leadId: null }));
    await expect(as(broker1(), () => referrals.linkReferralLead({ id: referralId, expectedVersion: 3, leadId: id("lead3") }))).rejects.toThrow("escopo");
    await expect(as(broker1(), () => referrals.linkReferralLead({ id: referralId, expectedVersion: 3, leadId: id("lead4") }))).rejects.toThrow("escopo");
    await as(broker1(), () => referrals.linkReferralLead({ id: referralId, expectedVersion: 3, leadId: id("lead2") }));
    expect(await row(referralId)).toMatchObject({ status: "opportunity", leadId: id("lead2"), version: 4 });
    const second = await as(broker1(), () => referrals.registerReferral(payload(31)));
    await expect(as(broker1(), () => referrals.linkReferralLead({ id: second, expectedVersion: 1, leadId: id("lead2") }))).rejects.toThrow("outra indicação");
    await expect(as(broker1(), () => referrals.changeReferralStatus({ id: referralId, expectedVersion: 4, status: "converted", reason: "", leadId: null }))).rejects.toThrow("conversão");
    await db.update(schema.leads).set({ status: "converted" }).where(and(eq(schema.leads.tenantId, id("a")), eq(schema.leads.id, id("lead2"))));
    await as(broker1(), () => referrals.changeReferralStatus({ id: referralId, expectedVersion: 4, status: "converted", reason: "", leadId: null }));
    expect((await row(referralId)).status).toBe("converted");
    const events = await db.select({ action: schema.erpEvents.action, metadata: schema.erpEvents.metadata }).from(schema.erpEvents)
      .where(and(eq(schema.erpEvents.tenantId, id("a")), eq(schema.erpEvents.entityType, "erp_referral"), eq(schema.erpEvents.entityId, referralId)));
    expect(events.map((event) => event.action).sort()).toEqual(["erp.referral.lead_linked", "erp.referral.registered", "erp.referral.status_changed", "erp.referral.status_changed", "erp.referral.status_changed"]);
    expect(events.find((event) => (event.metadata as { after?: { status?: string } }).after?.status === "converted")?.metadata).toMatchObject({ before: { status: "opportunity", version: 4 }, after: { status: "converted", version: 5 } });
    const timeline = await as(broker1(), () => referrals.getReferralTimeline({ id: referralId, page: 1 }));
    expect(timeline.total).toBe(5);
    expect(timeline.items.map((item) => item.label)[0]).toBe("Etapa alterada");
    await expect(as(broker2(), () => referrals.getReferralTimeline({ id: referralId, page: 1 }))).rejects.toThrow("escopo");
  });

  it("requires a reason to lose and reopen, and blocks reopening over an active contact", async () => {
    const referralId = await as(broker1(), () => referrals.registerReferral(payload(40)));
    await expect(as(broker1(), () => referrals.changeReferralStatus({ id: referralId, expectedVersion: 1, status: "lost", reason: "não", leadId: null }))).rejects.toThrow("motivo");
    await as(broker1(), () => referrals.changeReferralStatus({ id: referralId, expectedVersion: 1, status: "lost", reason: "Sem interesse no momento", leadId: null }));
    const replacement = await as(broker1(), () => referrals.registerReferral(payload(40)));
    expect(replacement).not.toBe(referralId);
    await expect(as(broker1(), () => referrals.changeReferralStatus({ id: referralId, expectedVersion: 2, status: "validated", reason: "Retomou o interesse", leadId: null }))).rejects.toThrow("outra indicação");
  });

  it("lets the database decide two concurrent links of the same lead, with a clear message", async () => {
    await db.insert(schema.leads).values({
      id: id("lead-race"), tenantId: id("a"), nome: "Negócio sintético concorrente", telefone: phone(150), branchId: id("a1"), corretorId: id("broker1"), status: "negotiation" as const,
    });
    const first = await as(broker1(), () => referrals.registerReferral(payload(51)));
    const second = await as(broker1(), () => referrals.registerReferral(payload(52)));
    const racing = await as(broker1(), () => Promise.allSettled([
      referrals.linkReferralLead({ id: first, expectedVersion: 1, leadId: id("lead-race") }),
      referrals.linkReferralLead({ id: second, expectedVersion: 1, leadId: id("lead-race") }),
    ]));
    expect(racing.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = racing.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toBeInstanceOf(Error);
    expect((rejected?.reason as Error).message).toBe(referrals.REFERRAL_LEAD_TAKEN_MESSAGE);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.erpReferrals)
      .where(and(eq(schema.erpReferrals.tenantId, id("a")), eq(schema.erpReferrals.leadId, id("lead-race"))));
    expect(total).toBe(1);
  });

  it("maps a raw unique violation of the active-lead index to the same message", async () => {
    const error = { message: "failed query", cause: { code: "23505", constraint_name: "erp_referrals_tenant_active_lead_unique" } };
    expect(referrals.isActiveLeadConflict(error)).toBe(true);
    expect(referrals.isActiveLeadConflict({ code: "23505", constraint_name: "other_unique" })).toBe(false);
  });
});
