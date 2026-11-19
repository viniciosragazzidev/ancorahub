import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";

vi.mock("server-only", () => ({}));

const testUrl = process.env.ERP_TEST_DATABASE_URL;

/** Base de frios do Call Âncora contra o PostgreSQL isolado de testes (nunca produção). */
describe.skipIf(!testUrl)("Call Âncora: base de frios no PostgreSQL isolado", () => {
  let db: ReturnType<typeof import("@/shared/db").getDatabase>;
  let schema: typeof import("@/shared/db").schema;
  let coldBase: typeof import("./cold-base");
  let coldOutcome: typeof import("./cold-outcome");
  const run = crypto.randomUUID();
  const id = (suffix: string) => `${run}-${suffix}`;
  const tenantId = id("tenant");

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
    coldBase = await import("./cold-base");
    coldOutcome = await import("./cold-outcome");

    await db.insert(schema.tenants).values({ id: tenantId, name: "Corretora sintética", slug: tenantId });
    await db.insert(schema.branches).values([
      { id: id("hub"), tenantId, name: "Matriz sintética" },
      { id: id("unit"), tenantId, name: "Unidade sintética" },
    ]);
    for (const person of ["broker1", "broker2"]) {
      await db.insert(schema.user).values({ id: id(person), name: `Corretor ${person}`, email: `${id(person)}@example.invalid` });
      await db.insert(schema.tenantMemberships).values({ id: id(`m-${person}`), tenantId, userId: id(person), role: "broker", jobTitle: "broker", branchId: id("unit") });
    }
    await db.insert(schema.leadQueues).values([
      { id: id("cold"), tenantId, branchId: id("hub"), name: "Leads Frios", slug: id("cold") },
      { id: id("hot"), tenantId, branchId: id("hub"), name: "Leads Quentes", slug: id("hot") },
    ]);
    const lead = (n: string, overrides: Partial<typeof schema.leads.$inferInsert> = {}) => ({
      id: id(n), tenantId, branchId: id("hub"), queueId: id("cold"), nome: `Frio ${n}`, telefone: "(21) 99999-0000", qualificationStatus: "cold",
      createdAt: new Date(Date.UTC(2026, 10, 1, 12, Number(n.replace(/\D/g, "")) || 0)), ...overrides,
    });
    await db.insert(schema.leads).values([
      lead("lead1"),
      lead("lead2"),
      lead("lead3", { telefone: "123" }),
      lead("lead4", { corretorId: id("broker1") }),
      lead("lead5", { status: "lost" }),
      lead("lead6", { queueId: id("hot"), qualificationStatus: "hot" }),
      lead("lead7", { archivedAt: new Date() }),
      lead("lead8"),
      lead("lead9"),
      // Segurado (manual_hold) entra na base geral de frios.
      lead("lead11", { distributionStatus: "manual_hold" }),
    ]);
    // lead8: "Número errado" antigo; lead9: tentativa há 1 h (dentro das 4 h).
    await db.insert(schema.leadInteractions).values([
      { id: id("i8"), leadId: id("lead8"), userId: id("broker1"), tipo: "note", conteudo: "Call Âncora: Número errado", metadata: { source: "call_ancora", outcome: "wrong_number" }, createdAt: new Date(Date.now() - 48 * 3_600_000) },
      { id: id("i9"), leadId: id("lead9"), userId: id("broker1"), tipo: "note", conteudo: "Call Âncora: Não atendeu", metadata: { source: "call_ancora", outcome: "no_answer" }, createdAt: new Date(Date.now() - 3_600_000) },
    ]);
  }, 30_000);

  afterAll(async () => { if (db) await db.$client.end({ timeout: 5 }); });

  it("pool: frios sem corretor, telefone válido, mais antigos primeiro, sem os já descartados", async () => {
    const contacts = await coldBase.fetchColdCandidates({ tenantId, excludeLeadIds: [] });
    expect(contacts.map((contact) => contact.id)).toEqual([id("lead1"), id("lead2"), id("lead11")]);
    expect(contacts[0]).toMatchObject({ source: "cold_base", dialable: true, phone: "+5521999990000" });
  });

  it("3 tentativas tiram o lead do pool", async () => {
    await db.insert(schema.leads).values({ id: id("lead10"), tenantId, branchId: id("hub"), queueId: id("cold"), nome: "Frio 10", telefone: "21988887777", qualificationStatus: "cold", createdAt: new Date(Date.UTC(2026, 9, 1)) });
    const old = new Date(Date.now() - 10 * 3_600_000);
    await db.insert(schema.leadInteractions).values([1, 2, 3].map((n) => ({ id: id(`i10-${n}`), leadId: id("lead10"), userId: id("broker1"), tipo: "note" as const, conteudo: "Call Âncora: Não atendeu", metadata: { source: "call_ancora", outcome: "no_answer" }, createdAt: old })));
    const contacts = await coldBase.fetchColdCandidates({ tenantId, excludeLeadIds: [] });
    expect(contacts.map((contact) => contact.id)).not.toContain(id("lead10"));
  });

  it("dois 'Com interesse' ao mesmo tempo: só um corretor fica com o lead", async () => {
    const lastCall = { causeCode: 3, causeLabel: "O outro lado desligou", reachedActive: true, talkSeconds: 95, autoOutcome: null, rule: null, dialToActiveMs: 9000, sim: null };
    const results = await Promise.all(["broker1", "broker2"].map((broker) => coldOutcome.recordColdOutcome({
      tenantId, brokerId: id(broker), leadId: id("lead1"), outcome: "interested", auto: false, lastCall,
    })));
    expect(results.filter((result) => result.assigned)).toHaveLength(1);
    expect(results.filter((result) => result.conflict === coldOutcome.CALL_ANCORA_LEAD_TAKEN_MESSAGE)).toHaveLength(1);

    const [lead] = await db.select({ corretorId: schema.leads.corretorId, assignmentSource: schema.leads.assignmentSource, branchId: schema.leads.branchId }).from(schema.leads).where(eq(schema.leads.id, id("lead1")));
    const winner = results[0].assigned ? id("broker1") : id("broker2");
    expect(lead).toMatchObject({ corretorId: winner, assignmentSource: "call_ancora", branchId: id("unit") });

    const events = await db.select({ action: schema.leadDistributionEvents.action, reason: schema.leadDistributionEvents.reason }).from(schema.leadDistributionEvents).where(eq(schema.leadDistributionEvents.leadId, id("lead1")));
    expect(events).toEqual([expect.objectContaining({ action: "assigned", reason: expect.stringContaining("Call Âncora") })]);
    const notes = await db.select({ metadata: schema.leadInteractions.metadata }).from(schema.leadInteractions).where(eq(schema.leadInteractions.leadId, id("lead1")));
    expect(notes).toHaveLength(2);
  });

  it("Com interesse em lead segurado (manual_hold) atribui e tira da retenção", async () => {
    const result = await coldOutcome.recordColdOutcome({ tenantId, brokerId: id("broker2"), leadId: id("lead11"), outcome: "interested", auto: false, lastCall: null });
    expect(result.assigned).toBe(true);
    const [lead] = await db.select({ corretorId: schema.leads.corretorId, distributionStatus: schema.leads.distributionStatus }).from(schema.leads).where(eq(schema.leads.id, id("lead11")));
    expect(lead).toEqual({ corretorId: id("broker2"), distributionStatus: "assigned" });
    expect(await coldBase.isColdLeadStillFree(tenantId, id("lead11"))).toBe(false);
  });

  it("Sem interesse e Número errado não mudam o dono; Número errado tira do pool", async () => {
    await coldOutcome.recordColdOutcome({ tenantId, brokerId: id("broker1"), leadId: id("lead2"), outcome: "wrong_number", auto: false, lastCall: null });
    const [lead] = await db.select({ corretorId: schema.leads.corretorId }).from(schema.leads).where(eq(schema.leads.id, id("lead2")));
    expect(lead.corretorId).toBeNull();
    const [note] = await db.select({ metadata: schema.leadInteractions.metadata }).from(schema.leadInteractions).where(and(eq(schema.leadInteractions.leadId, id("lead2")), eq(schema.leadInteractions.userId, id("broker1"))));
    expect(note.metadata).toMatchObject({ source: "call_ancora", outcome: "wrong_number" });
    const contacts = await coldBase.fetchColdCandidates({ tenantId, excludeLeadIds: [] });
    expect(contacts.map((contact) => contact.id)).not.toContain(id("lead2"));
  });
});
