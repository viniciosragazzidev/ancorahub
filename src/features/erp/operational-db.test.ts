import fs from "node:fs/promises";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";

const contexts = vi.hoisted(() => ({ get: (() => { throw new Error("Test identity not selected"); }) as () => TenantContext }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => contexts.get() }));
// The services and authorization resolve real cargo grants, scopes and database transactions.
// Only the outer authenticated-session adapter is supplied by the test; HTTP auth is separate QA.
const testUrl = process.env.ERP_TEST_DATABASE_URL;
const enabled = !!testUrl;

describe.skipIf(!enabled)("ERP services against isolated PostgreSQL", () => {
  let db: ReturnType<typeof import("@/shared/db").getDatabase>;
  let schema: typeof import("@/shared/db").schema;
  let implantations: typeof import("./implantations");
  let finance: typeof import("./finance");
  let imports: typeof import("./imports");
  let offsets: typeof import("./offsets");
  let closing: typeof import("./closing");
  const store = new AsyncLocalStorage<TenantContext>();
  const id = (suffix: string) => `${run}-${suffix}`;
  const run = crypto.randomUUID();
  const context = (person: string, role: TenantContext["role"] = "director", tenant = id("a"), branchId: string | null = null): TenantContext => ({ userId: id(person), tenantId: tenant, role, jobTitle: role, branchId });
  const as = <T>(identity: TenantContext, work: () => Promise<T>) => store.run(identity, work);

  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5442" || url.pathname !== "/erp_test" || url.username !== "erp_test") throw new Error("Refusing any database outside isolated ERP test host.");
    const root = process.env.ERP_TEST_ROOT; if (!root) throw new Error("Missing marked test root.");
    const marker = JSON.parse(await fs.readFile(path.join(root, "provenance.json"), "utf8"));
    if (marker.purpose !== "ancorahub-erp-synthetic-tests") throw new Error("Unmarked database root.");
    process.env.DATABASE_URL = testUrl; process.env.SUPABASE_DB_URL = testUrl; delete process.env.DATABASE_SSL;
    ({ getDatabase: dbFactory, schema } = await import("@/shared/db"));
    db = dbFactory();
    const result = await db.execute(sql`SHOW data_directory`);
    if (path.resolve(String(result[0].data_directory)).toLowerCase() !== path.resolve(root, "data-erp-test").toLowerCase()) throw new Error("Unexpected test server directory.");
    contexts.get = () => { const identity = store.getStore(); if (!identity) throw new Error("No synthetic session"); return identity; };
    implantations = await import("./implantations"); finance = await import("./finance"); imports = await import("./imports"); offsets = await import("./offsets"); closing = await import("./closing");
    await db.insert(schema.tenants).values([{ id: id("a"), name: "Empresa A sintética", slug: id("a") }, { id: id("b"), name: "Empresa B sintética", slug: id("b") }]);
    await db.insert(schema.branches).values([{ id: id("a1"), tenantId: id("a"), name: "Unidade A1" }, { id: id("a2"), tenantId: id("a"), name: "Unidade A2" }, { id: id("b1"), tenantId: id("b"), name: "Unidade B1" }]);
    for (const person of ["director", "reviewer", "broker1", "broker2", "manager", "other", "preparer", "approver"]) {
      await db.insert(schema.user).values({ id: id(person), name: `Teste ${person}`, email: `${id(person)}@example.invalid` });
      await db.insert(schema.tenantMemberships).values({ id: id(`membership-${person}`), tenantId: person === "other" ? id("b") : id("a"), userId: id(person), role: ["director", "reviewer", "other"].includes(person) ? "director" : person === "manager" ? "manager" : "broker", jobTitle: ["preparer", "approver"].includes(person) ? "finance" : person === "manager" ? "manager" : ["director", "reviewer", "other"].includes(person) ? "director" : "broker", branchId: person === "broker2" ? id("a2") : ["broker1", "manager"].includes(person) ? id("a1") : null });
    }
    for (const [person, capability] of [["preparer", "erp_prepare_finance"], ["approver", "erp_approve_finance"]]) {
      const cargoId = id(`cargo-${person}`);
      await db.insert(schema.customRoles).values({ id: cargoId, tenantId: id("a"), name: cargoId, scope: "tenant", status: "active" });
      await db.insert(schema.customRolePermissions).values(["erp_view_finance", capability].map((permissionKey) => ({ id: crypto.randomUUID(), customRoleId: cargoId, permissionKey })));
      await db.update(schema.tenantMemberships).set({ customRoleId: cargoId }).where(eq(schema.tenantMemberships.id, id(`membership-${person}`)));
    }
    await db.insert(schema.leads).values([1, 2, 3, 4].map((n) => ({ id: id(`lead${n}`), tenantId: n === 4 ? id("b") : id("a"), nome: `Negócio sintético ${n}`, telefone: "00000000000", branchId: n === 4 ? id("b1") : n === 2 ? id("a2") : id("a1"), corretorId: n === 4 ? id("other") : n === 2 ? id("broker2") : id("broker1"), status: "documentation_pending" as const })));
    await db.insert(schema.sales).values({ id: id("sale"), tenantId: id("a"), leadId: id("lead1"), brokerId: id("broker1"), saleDate: new Date("2026-11-12T12:00:00Z"), saleValue: "150.00", createdBy: id("director") });
    const { FEATURE_FLAGS } = await import("@/shared/feature-flags/catalog");
    for (const [key, value] of [[FEATURE_FLAGS.ERP_OPERATIONAL.key, "true"], [FEATURE_FLAGS.ERP_MODULES.key, JSON.stringify(["implantations", "imports", "finance"])]]) await db.insert(schema.systemSettings).values({ key, value }).onConflictDoUpdate({ target: schema.systemSettings.key, set: { value } });
    for (const tenantId of [id("a"), id("b")]) await db.insert(schema.erpModuleSettings).values(["implantations", "imports", "finance"].map((moduleKey) => ({ tenantId, moduleKey, enabled: true, roles: ["director", "manager", "supervisor", "broker", "finance"], updatedBy: id("director") })));
  }, 30000);
  let dbFactory: typeof import("@/shared/db").getDatabase;
  afterAll(async () => { if (db) await db.$client.end({ timeout: 5 }); });
  const implantation = (lead: number, version = 0) => ({ leadId: id(`lead${lead}`), expectedVersion: version, status: "submitted", reference: "TESTE", policyNumber: "", coverageStartsOn: null, evidenceDocumentId: null, reason: "Conferência sintética" });
  const functional = (person: "preparer" | "approver"): TenantContext => ({ ...context(person, "broker"), jobTitle: "finance", customRoleId: id(`cargo-${person}`), customRoleScope: "tenant" });
  async function proof(entryId: string) {
    const documentId = crypto.randomUUID();
    await db.insert(schema.erpDocuments).values({ id: documentId, tenantId: id("a"), ownerId: id("director"), branchId: id("a1"), moduleKey: "finance", financialEntryId: entryId, state: "ready", objectKey: `documents/${id("a")}/erp/${documentId}.pdf`, fileName: "evidencia-sintetica.pdf", contentType: "application/pdf", byteLength: 20, sha256: "0".repeat(64), createdBy: id("director") });
    await db.update(schema.erpFinancialEntries).set({ evidenceDocumentId: documentId }).where(and(eq(schema.erpFinancialEntries.id, entryId), eq(schema.erpFinancialEntries.tenantId, id("a"))));
    return documentId;
  }
  function expensePayload() { return { requestId: crypto.randomUUID(), reference: crypto.randomUUID(), kind: "expense", saleId: null, branchId: id("a1"), beneficiaryId: null, amountCents: 10000, dueOn: "2026-11-12", competence: "2026-11", description: "Despesa de teste", evidenceDocumentId: null }; }
  async function approvedEntry(kind: "advance" | "broker_commission", amountCents: number) {
    const entryId = await as(context("director"), () => finance.prepareFinancialEntry({ ...expensePayload(), kind, amountCents, saleId: kind === "broker_commission" ? id("sale") : null, beneficiaryId: id("broker1") }));
    const evidenceDocumentId = await proof(entryId);
    await as(context("reviewer"), () => finance.reviewFinancialEntry({ id: entryId, expectedVersion: 1, decision: "approve", reason: "Valores sintéticos conferidos" }));
    return { entryId, evidenceDocumentId };
  }
  it("denies forged cross-tenant and broker writes and limits a unit manager", async () => {
    await expect(as(context("director"), () => implantations.saveImplantation(implantation(4)))).rejects.toThrow("escopo");
    await expect(as(context("broker1", "broker", id("a"), id("a1")), () => implantations.saveImplantation(implantation(1)))).rejects.toThrow("cargo");
    const rows = await as(context("manager", "manager", id("a"), id("a1")), () => implantations.getImplantations({}));
    expect(rows.rows.map((row) => row.leadId)).toEqual(expect.arrayContaining([id("lead1"), id("lead3")]));
    expect(rows.rows.some((row) => [id("lead2"), id("lead4")].includes(row.leadId))).toBe(false);
  });
  it("allows exactly one concurrent update for the same expected version", async () => {
    const results = await as(context("director"), () => Promise.allSettled([implantations.saveImplantation(implantation(1)), implantations.saveImplantation(implantation(1))]));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
  it("previews once, requires another reviewer and applies an import once", async () => {
    const file = new File([`negocio_id;referencia;etapa;apolice;inicio_cobertura;evidencia_id;motivo\n${id("lead3")};LOTE;submitted;;;;Teste importação\n`], "sintetico.csv");
    const batch = await as(context("director"), () => imports.previewErpImport("implantations", file));
    expect((await as(context("director"), () => imports.previewErpImport("implantations", file))).id).toBe(batch.id);
    const review = { id: batch.id, version: 1, decision: "apply", reason: "Conferido em teste", confirmed: true };
    await expect(as(context("director"), () => imports.reviewErpImport(review))).rejects.toThrow("outra pessoa");
    await as(context("reviewer"), () => imports.reviewErpImport(review));
    await as(context("reviewer"), () => imports.reviewErpImport(review));
    const [row] = await db.select().from(schema.erpImplantations).where(and(eq(schema.erpImplantations.tenantId, id("a")), eq(schema.erpImplantations.leadId, id("lead3"))));
    expect(row.version).toBe(1);
  });
  it("uses real delegated finance grants and denies self-approval", async () => {
    const payload = { requestId: crypto.randomUUID(), reference: crypto.randomUUID(), kind: "expense", saleId: null, branchId: id("a1"), beneficiaryId: null, amountCents: 10000, dueOn: "2026-11-12", competence: "2026-11", description: "Despesa de teste", evidenceDocumentId: null };
    const entryId = await as(functional("preparer"), () => finance.prepareFinancialEntry(payload));
    expect(await as(functional("preparer"), () => finance.prepareFinancialEntry(payload))).toBe(entryId);
    await expect(as(functional("preparer"), () => finance.reviewFinancialEntry({ id: entryId, expectedVersion: 1, decision: "approve", reason: "Conferido em teste" }))).rejects.toThrow("cargo");
    await expect(as(context("director"), () => finance.reviewFinancialEntry({ id: entryId, expectedVersion: 1, decision: "approve", reason: "Conferido em teste" }))).rejects.toThrow("evidência");
    const evidenceDocumentId = await proof(entryId);
    await as(functional("approver"), () => finance.reviewFinancialEntry({ id: entryId, expectedVersion: 1, decision: "approve", reason: "Conferido em teste" }));
    const prepare = () => finance.prepareSettlement({ requestId: crypto.randomUUID(), entryId, amountCents: 6000, occurredOn: "2026-11-12", evidenceDocumentId, reason: "Pagamento sintético" });
    const results = await as(functional("preparer"), () => Promise.allSettled([prepare(), prepare()]));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const first = results.find((result) => result.status === "fulfilled"); if (!first || first.status !== "fulfilled") throw new Error("Missing prepared settlement");
    await as(functional("approver"), () => finance.reviewSettlement({ id: first.value, decision: "confirm", reason: "Conferido em teste" }));
    const detail = await as(functional("preparer"), () => finance.getFinancialEntry(entryId)); expect(detail.settledCents).toBe(6000);
    await expect(as(context("other", "director", id("b")), () => finance.getFinancialEntry(entryId))).rejects.toThrow("escopo");
    const reversal = await as(functional("preparer"), () => finance.prepareSettlementReversal({ settlementId: first.value, requestId: crypto.randomUUID(), occurredOn: "2026-11-12", evidenceDocumentId, reason: "Estorno sintético" }));
    await as(functional("approver"), () => finance.reviewSettlement({ id: reversal, decision: "confirm", reason: "Estorno conferido" }));
    expect((await as(functional("preparer"), () => finance.getFinancialEntry(entryId))).settledCents).toBe(0);
  });
  it("reserves funded advances, prevents double cash and protects personal financial data", async () => {
    const advance = await approvedEntry("advance", 10000); const commission = await approvedEntry("broker_commission", 15000);
    const funding = await as(context("director"), () => finance.prepareSettlement({ ...advance, requestId: crypto.randomUUID(), amountCents: 10000, occurredOn: "2026-11-12", reason: "Adiantamento sintético concedido" }));
    await as(context("reviewer"), () => finance.reviewSettlement({ id: funding, decision: "confirm", reason: "Concessão comprovada em teste" }));
    const makeOffset = () => offsets.prepareOffset({ requestId: crypto.randomUUID(), advanceEntryId: advance.entryId, commissionEntryId: commission.entryId, amountCents: 6000, occurredOn: "2026-11-12", reason: "Compensação sintética autorizada" });
    const results = await as(context("director"), () => Promise.allSettled([makeOffset(), makeOffset()]));
    expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    const allocation = results.find((row) => row.status === "fulfilled"); if (!allocation || allocation.status !== "fulfilled") throw new Error("Missing offset");
    await expect(as(context("director"), () => offsets.reviewOffset({ id: allocation.value, decision: "confirm", reason: "Teste de autorrevisão" }))).rejects.toThrow("outra pessoa");
    await as(context("reviewer"), () => offsets.reviewOffset({ id: allocation.value, decision: "confirm", reason: "Compensação conferida" }));
    await expect(as(context("director"), () => finance.prepareSettlement({ ...commission, requestId: crypto.randomUUID(), amountCents: 10000, occurredOn: "2026-11-12", reason: "Repasse sintético excedente" }))).rejects.toThrow("saldo");
    const netPayment = await as(context("director"), () => finance.prepareSettlement({ ...commission, requestId: crypto.randomUUID(), amountCents: 9000, occurredOn: "2026-11-12", reason: "Repasse líquido sintético" }));
    await as(context("reviewer"), () => finance.reviewSettlement({ id: netPayment, decision: "confirm", reason: "Repasse conferido" }));
    const personal = await as(context("broker1", "broker", id("a"), id("a1")), () => finance.getFinancialEntry(commission.entryId));
    expect(personal.cashCents).toBe(9000); expect(personal.offsetCents).toBe(6000); expect(personal.settledCents).toBe(15000);
    expect(personal.documents).toEqual([]); expect(personal.movements.every((row) => row.evidenceDocumentId === null && row.reason === null)).toBe(true);
    await expect(as(context("broker2", "broker", id("a"), id("a2")), () => finance.getFinancialEntry(commission.entryId))).rejects.toThrow("escopo");
    await expect(as(context("director"), () => finance.prepareSettlementReversal({ settlementId: funding, requestId: crypto.randomUUID(), occurredOn: "2026-11-12", evidenceDocumentId: advance.evidenceDocumentId, reason: "Estorno com saldo já comprometido" }))).rejects.toThrow("compensações");
    const reverse = await as(context("director"), () => offsets.prepareOffsetReversal({ id: allocation.value, requestId: crypto.randomUUID(), occurredOn: "2026-11-12", reason: "Reversão sintética autorizada" }));
    await as(context("reviewer"), () => offsets.reviewOffset({ id: reverse, decision: "confirm", reason: "Reversão conferida" }));
    expect((await as(context("director"), () => finance.getFinancialEntry(commission.entryId))).settledCents).toBe(9000);
    await expect(db.update(schema.erpFinancialEntries).set({ amountCents: 1 }).where(and(eq(schema.erpFinancialEntries.tenantId, id("a")), eq(schema.erpFinancialEntries.id, commission.entryId)))).rejects.toThrow();
  });
  it("requires an independent closing, detects changed facts and freezes closed periods", async () => {
    const ownEntry = await as(context("director"), () => finance.prepareFinancialEntry(expensePayload()));
    await expect(as(context("director"), () => finance.reviewFinancialEntry({ id: ownEntry, expectedVersion: 1, decision: "approve", reason: "Teste de autorrevisão" }))).rejects.toThrow("outra pessoa");
    await as(context("reviewer"), () => finance.reviewFinancialEntry({ id: ownEntry, expectedVersion: 1, decision: "reject", reason: "Teste concluído, não prosseguir" }));
    await as(context("director"), () => closing.prepareClosing({ competence: "2026-11", expectedVersion: 0, reason: "Conferência sintética do mês" }));
    await expect(as(context("director"), () => closing.reviewClosing({ competence: "2026-11", expectedVersion: 1, decision: "close", reason: "Teste de autorrevisão" }))).rejects.toThrow("outra pessoa");
    const lateEntry = await as(context("director"), () => finance.prepareFinancialEntry(expensePayload()));
    await as(context("reviewer"), () => finance.reviewFinancialEntry({ id: lateEntry, expectedVersion: 1, decision: "reject", reason: "Teste de mudança após prévia" }));
    await expect(as(context("reviewer"), () => closing.reviewClosing({ competence: "2026-11", expectedVersion: 1, decision: "close", reason: "Conferência sintética" }))).rejects.toThrow("mudaram");
    await as(context("director"), () => closing.prepareClosing({ competence: "2026-11", expectedVersion: 1, reason: "Nova conferência sintética do mês" }));
    await as(context("reviewer"), () => closing.reviewClosing({ competence: "2026-11", expectedVersion: 2, decision: "close", reason: "Fechamento sintético aprovado" }));
    await expect(as(context("director"), () => finance.prepareFinancialEntry(expensePayload()))).rejects.toThrow("fechado");
    await as(context("reviewer"), () => closing.reviewClosing({ competence: "2026-11", expectedVersion: 3, decision: "reopen", reason: "Reabertura sintética auditável" }));
    const [row] = await db.select().from(schema.erpClosings).where(and(eq(schema.erpClosings.tenantId, id("a")), eq(schema.erpClosings.competence, "2026-11")));
    expect(row.status).toBe("reopened"); expect(row.version).toBe(4);
  });
  it("prevents changing or deleting immutable ERP audit events", async () => {
    await expect(db.execute(sql`UPDATE erp_events SET action = 'tampered' WHERE tenant_id = ${id("a")}`)).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM erp_events WHERE tenant_id = ${id("a")}`)).rejects.toThrow();
  });
  it("rechecks an actual membership change even when the session adapter still returns the old role", async () => {
    await db.update(schema.tenantMemberships).set({ role: "broker", jobTitle: "broker", branchId: id("a1") }).where(eq(schema.tenantMemberships.id, id("membership-director")));
    try {
      await expect(as(context("director"), () => finance.prepareFinancialEntry(expensePayload()))).rejects.toThrow("cargo");
    } finally {
      await db.update(schema.tenantMemberships).set({ role: "director", jobTitle: "director", branchId: null }).where(eq(schema.tenantMemberships.id, id("membership-director")));
    }
  });
});
