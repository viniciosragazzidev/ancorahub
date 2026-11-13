import fs from "node:fs/promises";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";

const contexts = vi.hoisted(() => ({ get: (() => { throw new Error("Test identity not selected"); }) as () => TenantContext }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => contexts.get() }));
const testUrl = process.env.ERP_TEST_DATABASE_URL;

/** Read services of the ledger screens (search, offsets choices, cash and list totals) against the isolated PostgreSQL. */
describe.skipIf(!testUrl)("ERP ledger reads against isolated PostgreSQL", () => {
  let db: ReturnType<typeof import("@/shared/db").getDatabase>;
  let schema: typeof import("@/shared/db").schema;
  let finance: typeof import("./finance");
  let offsets: typeof import("./offsets");
  let closing: typeof import("./closing");
  const store = new AsyncLocalStorage<TenantContext>();
  const run = crypto.randomUUID();
  const id = (suffix: string) => `${run}-${suffix}`;
  const context = (person: string): TenantContext => ({ userId: id(person), tenantId: id("t"), role: "director", jobTitle: "director", branchId: null });
  const as = <T>(identity: TenantContext, work: () => Promise<T>) => store.run(identity, work);

  beforeAll(async () => {
    const url = new URL(testUrl!);
    const local = ["127.0.0.1", "localhost"].includes(url.hostname) && url.port === "5442" && url.pathname === "/erp_test" && url.username === "erp_test";
    if (!local) throw new Error("Refusing any database outside the isolated ERP test server.");
    const root = process.env.ERP_TEST_ROOT;
    if (!root) throw new Error("Missing marked test root.");
    const marker = JSON.parse(await fs.readFile(path.join(root, "provenance.json"), "utf8"));
    if (marker.purpose !== "ancorahub-erp-synthetic-tests") throw new Error("Unmarked database root.");
    process.env.DATABASE_URL = testUrl;
    process.env.SUPABASE_DB_URL = testUrl;
    delete process.env.DATABASE_SSL;
    const shared = await import("@/shared/db");
    schema = shared.schema;
    db = shared.getDatabase();
    const result = await db.execute(sql`SHOW data_directory`);
    if (path.resolve(String(result[0].data_directory)).toLowerCase() !== path.resolve(root, "data-erp-test").toLowerCase()) throw new Error("Unexpected test server directory.");
    contexts.get = () => {
      const identity = store.getStore();
      if (!identity) throw new Error("No synthetic session");
      return identity;
    };
    finance = await import("./finance");
    offsets = await import("./offsets");
    closing = await import("./closing");
    await db.insert(schema.tenants).values({ id: id("t"), name: "Empresa sintética", slug: id("t") });
    await db.insert(schema.branches).values({ id: id("b1"), tenantId: id("t"), name: "Unidade sintética" });
    for (const person of ["director", "reviewer", "broker"]) {
      await db.insert(schema.user).values({ id: id(person), name: `Pessoa ${person}`, email: `${id(person)}@example.invalid` });
      const broker = person === "broker";
      await db.insert(schema.tenantMemberships).values({
        id: id(`m-${person}`), tenantId: id("t"), userId: id(person), role: broker ? "broker" : "director", jobTitle: broker ? "broker" : "director",
        branchId: broker ? id("b1") : null,
      });
    }
    await db.insert(schema.leads).values({
      id: id("lead"), tenantId: id("t"), nome: "Cliente 100%_sintético", telefone: "00000000000", branchId: id("b1"), corretorId: id("broker"),
      status: "documentation_pending" as const,
    });
    await db.insert(schema.sales).values({
      id: id("sale"), tenantId: id("t"), leadId: id("lead"), brokerId: id("broker"), saleDate: new Date("2026-11-12T12:00:00Z"), saleValue: "150.00", createdBy: id("director"),
    });
    const { FEATURE_FLAGS } = await import("@/shared/feature-flags/catalog");
    const flags = [
      [FEATURE_FLAGS.ERP_OPERATIONAL.key, "true"],
      [FEATURE_FLAGS.ERP_MODULES.key, JSON.stringify(["implantations", "finance", "imports", "referrals", "incentives", "analytics", "tv"])],
    ];
    for (const [key, value] of flags) await db.insert(schema.systemSettings).values({ key, value }).onConflictDoUpdate({ target: schema.systemSettings.key, set: { value } });
    await db.insert(schema.erpModuleSettings).values({
      tenantId: id("t"), moduleKey: "finance", enabled: true, roles: ["director", "manager", "supervisor", "broker", "finance"], updatedBy: id("director"),
    });
  }, 30000);
  afterAll(async () => { if (db) await db.$client.end({ timeout: 5 }); });

  async function proof(entryId: string) {
    const documentId = crypto.randomUUID();
    await db.insert(schema.erpDocuments).values({
      id: documentId, tenantId: id("t"), ownerId: id("director"), branchId: id("b1"), moduleKey: "finance", financialEntryId: entryId, state: "ready",
      objectKey: `documents/${id("t")}/erp/${documentId}.pdf`, fileName: "evidencia.pdf", contentType: "application/pdf", byteLength: 20,
      sha256: "0".repeat(64), createdBy: id("director"),
    });
    await db.update(schema.erpFinancialEntries).set({ evidenceDocumentId: documentId })
      .where(and(eq(schema.erpFinancialEntries.id, entryId), eq(schema.erpFinancialEntries.tenantId, id("t"))));
    return documentId;
  }
  async function approved(kind: "advance" | "broker_commission", amountCents: number) {
    const entryId = await as(context("director"), () => finance.prepareFinancialEntry({
      requestId: crypto.randomUUID(), reference: crypto.randomUUID(), kind, saleId: kind === "broker_commission" ? id("sale") : null, branchId: id("b1"),
      beneficiaryId: id("broker"), amountCents, dueOn: "2026-11-12", competence: "2026-11", description: "Lançamento sintético", evidenceDocumentId: null,
    }));
    const evidence = await proof(entryId);
    await as(context("reviewer"), () => finance.reviewFinancialEntry({ id: entryId, expectedVersion: 1, decision: "approve", reason: "Valores conferidos" }));
    return { entryId, evidence };
  }

  it("searches sales and beneficiaries by name with wildcards escaped", async () => {
    const sales = await as(context("director"), () => finance.searchFinanceSales("100%_sint"));
    expect(sales.map((row) => row.id)).toEqual([id("sale")]);
    expect(sales[0].brokerName).toBe("Pessoa broker");
    expect(await as(context("director"), () => finance.searchFinanceSales("%%"))).toEqual([]);
    const people = await as(context("director"), () => finance.searchFinanceBeneficiaries("pessoa bro"));
    expect(people.map((row) => row.id)).toEqual([id("broker")]);
  });

  it("offers only funded advances and open commissions, lists, totals and cash by period ranges", async () => {
    const advance = await approved("advance", 5000);
    const commission = await approved("broker_commission", 8000);
    let data = await as(context("director"), () => offsets.getOffsets({}));
    expect(data.choices.map((row) => row.id)).toEqual([commission.entryId]);
    expect(data.choices[0].availableCents).toBe(8000);

    const settlement = await as(context("director"), () => finance.prepareSettlement({
      requestId: crypto.randomUUID(), entryId: advance.entryId, amountCents: 5000, occurredOn: "2026-11-10", evidenceDocumentId: advance.evidence, reason: "Pagamento conferido",
    }));
    await as(context("reviewer"), () => finance.reviewSettlement({ id: settlement, decision: "confirm", reason: "Comprovante conferido" }));
    data = await as(context("director"), () => offsets.getOffsets({}));
    expect(data.choices.find((row) => row.id === advance.entryId)?.availableCents).toBe(5000);
    expect(data.total).toBe(0);

    const list = await as(context("director"), () => finance.getFinancialEntries({ kind: "advance" }));
    expect(list.rows.find((row) => row.id === advance.entryId)?.settledCents).toBe(5000);
    const cash = await as(context("director"), () => closing.getCashMovements("2026-11"));
    expect(cash.outgoing).toBe(5000);
    expect((await as(context("director"), () => closing.getCashMovements("2026-12"))).movementCount).toBe(0);
  });
});
