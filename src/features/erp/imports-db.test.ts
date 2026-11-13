import fs from "node:fs/promises";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import type { TenantContext } from "@/shared/auth/types";

const contexts = vi.hoisted(() => ({ get: (() => { throw new Error("Test identity not selected"); }) as () => TenantContext }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => contexts.get() }));
const testUrl = process.env.ERP_TEST_DATABASE_URL;

describe.skipIf(!testUrl)("ERP imports against isolated PostgreSQL", () => {
  let db: ReturnType<typeof import("@/shared/db").getDatabase>;
  let schema: typeof import("@/shared/db").schema;
  let imports: typeof import("./imports");
  const store = new AsyncLocalStorage<TenantContext>();
  const run = crypto.randomUUID();
  const id = (suffix: string) => `${run}-${suffix}`;
  const director = (person: string): TenantContext => ({ userId: id(person), tenantId: id("t"), role: "director", jobTitle: "director", branchId: null });
  /** Operations cargo delegated to unit u1 only. */
  const unitOperator: () => TenantContext = () => ({
    userId: id("operator"), tenantId: id("t"), role: "broker", jobTitle: "operations", branchId: id("u1"), customRoleId: id("cargo"), customRoleScope: "branch",
  });
  const as = <T>(identity: TenantContext, work: () => Promise<T>) => store.run(identity, work);
  const csv = (rows: string[]) => new File([`negocio_id;referencia;etapa;apolice;inicio_cobertura;evidencia_id;motivo\n${rows.join("\n")}\n`], "lote.csv");

  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5442"
      || url.pathname !== "/erp_test" || url.username !== "erp_test") throw new Error("Refusing any database outside isolated ERP test host.");
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
    imports = await import("./imports");
    await db.insert(schema.tenants).values({ id: id("t"), name: "Empresa sintética de importação", slug: id("t") });
    await db.insert(schema.branches).values([{ id: id("u1"), tenantId: id("t"), name: "Unidade 1" }, { id: id("u2"), tenantId: id("t"), name: "Unidade 2" }]);
    for (const person of ["director", "reviewer", "broker", "operator"]) {
      await db.insert(schema.user).values({ id: id(person), name: `Teste ${person}`, email: `${id(person)}@example.invalid` });
      const operator = person === "operator";
      await db.insert(schema.tenantMemberships).values({ id: id(`membership-${person}`), tenantId: id("t"), userId: id(person),
        role: ["director", "reviewer"].includes(person) ? "director" : "broker", jobTitle: operator ? "operations" : person === "broker" ? "broker" : "director",
        branchId: ["broker", "operator"].includes(person) ? id("u1") : null });
    }
    await db.insert(schema.customRoles).values({ id: id("cargo"), tenantId: id("t"), name: id("cargo"), scope: "branch", status: "active" });
    await db.insert(schema.customRolePermissions).values(["erp_view_operations", "erp_manage_operations", "erp_import_data"]
      .map((permissionKey) => ({ id: crypto.randomUUID(), customRoleId: id("cargo"), permissionKey })));
    await db.update(schema.tenantMemberships).set({ customRoleId: id("cargo") }).where(eq(schema.tenantMemberships.id, id("membership-operator")));
    await db.insert(schema.tenantManagerBranches).values({ id: id("tmb"), tenantId: id("t"), userId: id("operator"), branchId: id("u1") });
    await db.insert(schema.leads).values([1, 2, 3, 4].map((n) => ({ id: id(`lead${n}`), tenantId: id("t"), nome: `Negócio sintético ${n}`, telefone: "00000000000",
      branchId: n === 4 ? id("u2") : id("u1"), corretorId: id("broker"), status: "documentation_pending" as const })));
    const { FEATURE_FLAGS } = await import("@/shared/feature-flags/catalog");
    for (const [key, value] of [[FEATURE_FLAGS.ERP_OPERATIONAL.key, "true"],
      [FEATURE_FLAGS.ERP_MODULES.key, JSON.stringify(["implantations", "finance", "imports", "referrals", "incentives", "analytics", "tv"])]]) {
      await db.insert(schema.systemSettings).values({ key, value }).onConflictDoUpdate({ target: schema.systemSettings.key, set: { value } });
    }
    await db.insert(schema.erpModuleSettings).values(["implantations", "imports"].map((moduleKey) => ({ tenantId: id("t"), moduleKey, enabled: true,
      roles: ["director", "operations"], updatedBy: id("director") })));
  }, 30000);
  afterAll(async () => { if (db) await db.$client.end({ timeout: 5 }); });

  it("validates a multi-row batch in one pass and keeps row-level messages", async () => {
    const file = csv([`${id("lead1")};A;submitted;;;;Teste`, `${id("lead2")};B;submitted;;;;Teste`, `${id("lead1")};C;submitted;;;;Teste`]);
    await expect(as(director("director"), () => imports.previewErpImport("implantations", file))).rejects.toThrow("linha 4 está repetido");
    const missing = csv([`${id("lead1")};A;submitted;;;;Teste`, `${id("lead-x")};B;submitted;;;;Teste`]);
    await expect(as(director("director"), () => imports.previewErpImport("implantations", missing))).rejects.toThrow("Negócio não encontrado no seu escopo.");
  });

  it("supersedes a rejected batch with the same file: same id, new version, new author, audited", async () => {
    const file = csv([`${id("lead2")};LOTE;submitted;;;;Teste importação`]);
    const first = await as(director("director"), () => imports.previewErpImport("implantations", file));
    await as(director("reviewer"), () => imports.reviewErpImport({ id: first.id, version: 1, decision: "reject", reason: "Conferência pediu ajuste", confirmed: false }));
    const again = await as(director("reviewer"), () => imports.previewErpImport("implantations", file));
    expect(again).toEqual({ id: first.id, alreadyApplied: false, superseded: true });
    const [batch] = await db.select().from(schema.erpImports).where(and(eq(schema.erpImports.id, first.id), eq(schema.erpImports.tenantId, id("t"))));
    expect(batch).toMatchObject({ status: "preview", version: 3, createdBy: id("reviewer"), reviewedBy: null, reviewReason: null });
    const events = await db.select({ action: schema.erpEvents.action }).from(schema.erpEvents)
      .where(and(eq(schema.erpEvents.tenantId, id("t")), eq(schema.erpEvents.entityId, first.id)));
    expect(events.map((event) => event.action)).toEqual(expect.arrayContaining(["erp.import.previewed", "erp.import.reject", "erp.import.superseded"]));
    // The new author cannot apply their own preview; the original preparer now can.
    const review = { id: first.id, version: 3, decision: "apply", reason: "Conferido em teste", confirmed: true };
    await expect(as(director("reviewer"), () => imports.reviewErpImport(review))).rejects.toThrow("outra pessoa");
    await as(director("director"), () => imports.reviewErpImport(review));
    expect((await as(director("director"), () => imports.previewErpImport("implantations", file))).alreadyApplied).toBe(true);
  });

  it("answers neutrally when the same file exists in a batch outside the viewer's units", async () => {
    const file = csv([`${id("lead4")};FORA;submitted;;;;Teste escopo`]);
    const batch = await as(director("director"), () => imports.previewErpImport("implantations", file));
    const leak = as(unitOperator(), () => imports.previewErpImport("implantations", file));
    await expect(leak).rejects.toThrow(imports.EXISTING_BATCH_OUTSIDE_SCOPE);
    await expect(as(unitOperator(), () => imports.previewErpImport("implantations", file))).rejects.not.toThrow(batch.id);
    const inside = csv([`${id("lead3")};DENTRO;submitted;;;;Teste escopo`]);
    const own = await as(unitOperator(), () => imports.previewErpImport("implantations", inside));
    const visible = (await as(unitOperator(), () => imports.getErpImports())).rows.map((row) => row.id);
    expect(visible).toContain(own.id);
    expect(visible).not.toContain(batch.id);
  });
});
