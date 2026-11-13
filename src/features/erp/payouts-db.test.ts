import fs from "node:fs/promises";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";

const contexts = vi.hoisted(() => ({ get: (() => { throw new Error("Test identity not selected"); }) as () => TenantContext }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => contexts.get() }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const testUrl = process.env.ERP_TEST_DATABASE_URL;

describe.skipIf(!testUrl)("ERP commissions, payouts and receipts against isolated PostgreSQL", () => {
  let db: ReturnType<typeof import("@/shared/db").getDatabase>;
  let schema: typeof import("@/shared/db").schema;
  let finance: typeof import("./finance");
  let commissions: typeof import("./commissions");
  let payouts: typeof import("./payouts");
  let reconciliation: typeof import("./reconciliation");
  const store = new AsyncLocalStorage<TenantContext>();
  const run = crypto.randomUUID();
  const id = (suffix: string) => `${run}-${suffix}`;
  const context = (person: string, role: TenantContext["role"] = "director", tenant = id("a"), branchId: string | null = null): TenantContext => ({ userId: id(person), tenantId: tenant, role, jobTitle: role, branchId });
  const as = <T>(identity: TenantContext, work: () => Promise<T>) => store.run(identity, work);
  const broker = (person: "broker1" | "broker2") => context(person, "broker", id("a"), id("a1"));

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
    finance = await import("./finance"); commissions = await import("./commissions"); payouts = await import("./payouts"); reconciliation = await import("./reconciliation");
    await db.insert(schema.tenants).values([{ id: id("a"), name: "Empresa A sintética", slug: id("a") }, { id: id("b"), name: "Empresa B sintética", slug: id("b") }]);
    await db.insert(schema.branches).values([{ id: id("a1"), tenantId: id("a"), name: "Unidade A1" }, { id: id("b1"), tenantId: id("b"), name: "Unidade B1" }]);
    for (const person of ["director", "reviewer", "broker1", "broker2", "other"]) {
      await db.insert(schema.user).values({ id: id(person), name: `Teste ${person}`, email: `${id(person)}@example.invalid` });
      const role = person.startsWith("broker") ? "broker" : "director";
      await db.insert(schema.tenantMemberships).values({ id: id(`membership-${person}`), tenantId: person === "other" ? id("b") : id("a"), userId: id(person), role, jobTitle: role, branchId: role === "broker" ? id("a1") : null });
    }
    await db.insert(schema.leads).values({ id: id("lead1"), tenantId: id("a"), nome: "Negócio sintético", telefone: "00000000000", branchId: id("a1"), corretorId: id("broker1"), status: "converted" });
    await db.insert(schema.sales).values({ id: id("sale"), tenantId: id("a"), leadId: id("lead1"), brokerId: id("broker1"), saleDate: new Date("2026-11-02T12:00:00Z"), saleValue: "1000.00", createdBy: id("director") });
    await db.insert(schema.commissionSchedule).values([
      { id: id("cs1"), tenantId: id("a"), saleId: id("sale"), monthNumber: 1, referenceMonth: "2026-10", percentage: "10.00", amount: "100.00" },
      { id: id("cs2"), tenantId: id("a"), saleId: id("sale"), monthNumber: 2, referenceMonth: "2026-10", percentage: "5.00", amount: "50.25" },
    ]);
    const { FEATURE_FLAGS } = await import("@/shared/feature-flags/catalog");
    const { ERP_MODULE_KEYS } = await import("./contracts");
    for (const [key, value] of [[FEATURE_FLAGS.ERP_OPERATIONAL.key, "true"], [FEATURE_FLAGS.ERP_MODULES.key, JSON.stringify(ERP_MODULE_KEYS)]]) await db.insert(schema.systemSettings).values({ key, value }).onConflictDoUpdate({ target: schema.systemSettings.key, set: { value } });
    for (const tenantId of [id("a"), id("b")]) await db.insert(schema.erpModuleSettings).values([{ tenantId, moduleKey: "finance", enabled: true, roles: ["director", "manager", "supervisor", "broker", "finance"], updatedBy: id("director") }]);
  }, 30000);
  afterAll(async () => { if (db) await db.$client.end({ timeout: 5 }); });

  async function proof(input: { entryId?: string; ownerId: string; payoutId?: string }) {
    const documentId = crypto.randomUUID();
    await db.insert(schema.erpDocuments).values({ id: documentId, tenantId: id("a"), ownerId: input.ownerId, branchId: id("a1"), moduleKey: "finance", financialEntryId: input.entryId ?? null, payoutId: input.payoutId ?? null, state: "ready", objectKey: `documents/${id("a")}/erp/${documentId}.pdf`, fileName: "comprovante-sintetico.pdf", contentType: "application/pdf", byteLength: 20, sha256: "0".repeat(64), createdBy: id("director") });
    if (input.entryId) await db.update(schema.erpFinancialEntries).set({ evidenceDocumentId: documentId }).where(and(eq(schema.erpFinancialEntries.id, input.entryId), eq(schema.erpFinancialEntries.tenantId, id("a"))));
    return documentId;
  }

  it("brings the legacy schedule once, pays it through an independent payout and issues the receipt", async () => {
    expect(await as(context("director"), () => commissions.bringScheduleToConference({ saleId: id("sale") }))).toEqual({ created: 2, skipped: 0 });
    expect(await as(context("director"), () => commissions.bringScheduleToConference({ saleId: id("sale") }))).toEqual({ created: 0, skipped: 2 });
    await expect(as(broker("broker1"), () => commissions.bringScheduleToConference({ saleId: id("sale") }))).rejects.toThrow();
    const entries = await db.select().from(schema.erpFinancialEntries).where(and(eq(schema.erpFinancialEntries.tenantId, id("a")), inArray(schema.erpFinancialEntries.originCommissionId, [id("cs1"), id("cs2")])));
    expect(entries.map((entry) => entry.amountCents).sort((a, b) => a - b)).toEqual([5025, 10000]);
    expect(await commissions.isInstallmentControlledByErp(id("a"), id("cs1"))).toBe(true);
    for (const entry of entries) { await proof({ entryId: entry.id, ownerId: id("broker1") }); await as(context("reviewer"), () => finance.reviewFinancialEntry({ id: entry.id, expectedVersion: 1, decision: "approve", reason: "Parcela conferida em teste" })); }

    const overview = await as(broker("broker1"), () => commissions.getCommissionOverview({}));
    expect(overview.rows).toHaveLength(2); expect(overview.canBring).toBe(false);
    expect((await as(broker("broker2"), () => commissions.getCommissionOverview({}))).rows).toHaveLength(0);

    const candidates = await as(context("director"), () => payouts.getPayoutCandidates({}));
    expect(candidates.groups.find((group) => group.beneficiaryId === id("broker1"))?.items).toHaveLength(2);
    const requestId = crypto.randomUUID(); const ids = entries.map((entry) => entry.id);
    const payoutId = await as(context("director"), () => payouts.preparePayout({ requestId, beneficiaryId: id("broker1"), competence: "2026-11", entryIds: ids }));
    expect(await as(context("director"), () => payouts.preparePayout({ requestId, beneficiaryId: id("broker1"), competence: "2026-11", entryIds: ids }))).toBe(payoutId);
    await expect(as(context("director"), () => payouts.preparePayout({ requestId: crypto.randomUUID(), beneficiaryId: id("broker1"), competence: "2026-11", entryIds: [ids[0]] }))).rejects.toThrow("outro repasse");
    const loose = await proof({ ownerId: id("broker1") });
    const evidence = await proof({ ownerId: id("broker1"), payoutId });
    await expect(as(context("director"), () => finance.prepareSettlement({ requestId: crypto.randomUUID(), entryId: ids[0], amountCents: 100, occurredOn: "2026-11-12", evidenceDocumentId: evidence, reason: "Pagamento avulso" }))).rejects.toThrow("repasse");
    await expect(as(context("director"), () => payouts.reviewPayout({ id: payoutId, expectedVersion: 1, decision: "approve", reason: "Autoaprovação de teste" }))).rejects.toThrow("outra pessoa");
    await as(context("reviewer"), () => payouts.reviewPayout({ id: payoutId, expectedVersion: 1, decision: "approve", reason: "Repasse conferido" }));
    await expect(as(context("reviewer"), () => payouts.registerPayoutPayment({ id: payoutId, expectedVersion: 2, requestId: crypto.randomUUID(), occurredOn: "2026-11-12", evidenceDocumentId: evidence, reason: "Aprovador pagando" }))).rejects.toThrow("aprovou");
    await expect(as(context("director"), () => payouts.registerPayoutPayment({ id: payoutId, expectedVersion: 2, requestId: crypto.randomUUID(), occurredOn: "2026-11-12", evidenceDocumentId: loose, reason: "Comprovante solto" }))).rejects.toThrow("comprovante");
    const payment = { id: payoutId, expectedVersion: 2, requestId: crypto.randomUUID(), occurredOn: "2026-11-12", evidenceDocumentId: evidence, reason: "Pagamento sintético" };
    await as(context("director"), () => payouts.registerPayoutPayment(payment));
    expect(await as(context("director"), () => payouts.registerPayoutPayment(payment))).toBe(payoutId);
    await expect(as(context("director"), () => payouts.confirmPayoutPayment({ id: payoutId, expectedVersion: 3, decision: "confirm", reason: "Autoconferência de teste" }))).rejects.toThrow("outra pessoa");
    await as(context("reviewer"), () => payouts.confirmPayoutPayment({ id: payoutId, expectedVersion: 3, decision: "confirm", reason: "Comprovante conferido" }));

    const [payout] = await db.select().from(schema.erpPayouts).where(and(eq(schema.erpPayouts.tenantId, id("a")), eq(schema.erpPayouts.id, payoutId)));
    expect(payout.status).toBe("settled"); expect(payout.netCents).toBe(15025); expect(payout.receiptNumber).toBe("RP-2026-000001");
    const legacy = await db.select({ status: schema.commissionSchedule.status }).from(schema.commissionSchedule).where(inArray(schema.commissionSchedule.id, [id("cs1"), id("cs2")]));
    expect(legacy.every((row) => row.status === "paid")).toBe(true);
    for (const entryId of ids) expect((await as(context("director"), () => finance.getFinancialEntry(entryId))).settledCents).toBe(entries.find((entry) => entry.id === entryId)!.amountCents);

    const own = await as(broker("broker1"), () => payouts.getReceipt(payoutId));
    expect(own.receipt.netCents).toBe(15025); expect(own.receipt.items).toHaveLength(2); expect(own.digest).toHaveLength(64);
    await expect(as(broker("broker2"), () => payouts.getReceipt(payoutId))).rejects.toThrow("escopo");
    await expect(as(context("other", "director", id("b")), () => payouts.getReceipt(payoutId))).rejects.toThrow("escopo");
    await expect(db.update(schema.erpPayouts).set({ netCents: 1 }).where(and(eq(schema.erpPayouts.tenantId, id("a")), eq(schema.erpPayouts.id, payoutId)))).rejects.toThrow();
    expect((await as(broker("broker1"), () => payouts.getPayouts({}))).rows.map((row) => row.id)).toEqual([payoutId]);

    // Reversal of a payout settlement keeps the payout link; the receipt stays as issued and the commission is payable again.
    const [paid] = await db.select().from(schema.erpSettlements).where(and(eq(schema.erpSettlements.tenantId, id("a")), eq(schema.erpSettlements.payoutId, payoutId), eq(schema.erpSettlements.entryId, ids[0])));
    const reversal = await as(context("director"), () => finance.prepareSettlementReversal({ settlementId: paid.id, requestId: crypto.randomUUID(), occurredOn: "2026-11-12", evidenceDocumentId: evidence, reason: "Pagamento devolvido pelo banco" }));
    await as(context("reviewer"), () => finance.reviewSettlement({ id: reversal, decision: "confirm", reason: "Devolução conferida" }));
    const [reversed] = await db.select().from(schema.erpSettlements).where(and(eq(schema.erpSettlements.tenantId, id("a")), eq(schema.erpSettlements.id, reversal)));
    expect(reversed.payoutId).toBe(payoutId);
    expect((await as(context("director"), () => payouts.getPayoutCandidates({}))).groups.flatMap((group) => group.items.map((item) => item.id))).toContain(ids[0]);
    expect((await as(broker("broker1"), () => payouts.getReceipt(payoutId))).receipt.netCents).toBe(15025);
  });

  it("refuses approving money addressed to the approver", async () => {
    const entryId = await as(context("director"), () => finance.prepareFinancialEntry({ requestId: crypto.randomUUID(), reference: crypto.randomUUID(), kind: "advance", saleId: null, branchId: null, beneficiaryId: id("reviewer"), amountCents: 5000, dueOn: "2026-11-12", competence: "2026-11", description: "Adiantamento ao revisor", evidenceDocumentId: null }));
    await proof({ entryId, ownerId: id("reviewer") });
    await expect(as(context("reviewer"), () => finance.reviewFinancialEntry({ id: entryId, expectedVersion: 1, decision: "approve", reason: "Aprovando o próprio valor" }))).rejects.toThrow("Quem recebe");
  });

  it("lists legacy divergences in the reconciliation queue", async () => {
    await db.update(schema.commissionSchedule).set({ status: "chargeback_pending" }).where(eq(schema.commissionSchedule.id, id("cs1")));
    const data = await as(context("director"), () => reconciliation.getReconciliation());
    expect(data.issues.some((issue) => issue.group === "legacy" && issue.detail.includes("estorno"))).toBe(true);
    await expect(as(broker("broker1"), () => reconciliation.getReconciliation())).rejects.toThrow("delegação");
  });

  it("imports finance rows as submitted entries once, applied only by another person", async () => {
    await db.insert(schema.erpModuleSettings).values({ tenantId: id("a"), moduleKey: "imports", enabled: true, roles: ["director"], updatedBy: id("director") }).onConflictDoNothing();
    const imports = await import("./imports");
    const csv = `referencia;tipo;venda_id;unidade_id;beneficiario_id;valor;vencimento;competencia;descricao\nREC-${run.slice(0, 8)};recebível;${id("sale")};;;1.234,56;2026-11-20;2026-11;Comissão da operadora\nDESP-${run.slice(0, 8)};despesa;;${id("a1")};;80,00;2026-11-15;2026-11;Material de escritório\n`;
    const file = () => new File([csv], "financeiro.csv");
    const batch = await as(context("director"), () => imports.previewErpImport("finance", file()));
    expect((await as(context("director"), () => imports.previewErpImport("finance", file()))).id).toBe(batch.id);
    const detail = await as(context("director"), () => imports.getErpImport(batch.id));
    expect(detail.domain).toBe("finance"); expect(detail.financeRows.map((row) => row.amountCents).sort((a, b) => a - b)).toEqual([8000, 123456]);
    const review = { id: batch.id, version: 1, decision: "apply", reason: "Lote financeiro conferido", confirmed: true };
    await expect(as(context("director"), () => imports.reviewErpImport(review))).rejects.toThrow("outra pessoa");
    await as(context("reviewer"), () => imports.reviewErpImport(review));
    await as(context("reviewer"), () => imports.reviewErpImport(review));
    const created = await db.select().from(schema.erpFinancialEntries).where(and(eq(schema.erpFinancialEntries.tenantId, id("a")), inArray(schema.erpFinancialEntries.reference, [`REC-${run.slice(0, 8)}`, `DESP-${run.slice(0, 8)}`])));
    expect(created).toHaveLength(2); expect(created.every((entry) => entry.status === "submitted")).toBe(true);
    await expect(as(context("director"), () => imports.previewErpImport("finance", new File([csv.replace("80,00", "81,00")], "financeiro-2.csv")))).rejects.toThrow("já foi lançada");
    await expect(as(broker("broker1"), () => imports.previewErpImport("finance", file()))).rejects.toThrow();
  });
});
