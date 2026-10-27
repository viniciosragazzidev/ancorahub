import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const schema = { webhookDeliveries: Symbol("deliveries"), leads: Symbol("leads"), leadInteractions: Symbol("interactions"), auditLogs: Symbol("audit"), leadDistributionEvents: Symbol("events") };
  const inserts: Array<{ table: symbol; values: Record<string, unknown> }> = [];
  const updates: Array<{ table: symbol; values: Record<string, unknown> }> = [];
  let existingLeadRows: Array<Record<string, unknown>> = [];
  const createQueryMock = () => Object.assign(Promise.resolve(existingLeadRows), { limit: vi.fn(async () => existingLeadRows) });
  const calls: string[] = [];
  const select = vi.fn(() => { calls.push("select"); return { from: vi.fn(() => ({ where: vi.fn(() => createQueryMock()) })) }; });
  const execute = vi.fn(async (query: unknown) => { calls.push("execute"); return [query]; });
  const db = {
    insert: vi.fn((table: symbol) => ({ values: vi.fn((values: Record<string, unknown>) => {
      inserts.push({ table, values });
      return { onConflictDoNothing: () => ({ returning: async () => [{ id: "reserved" }] }), then: (resolve: (value: undefined) => unknown) => Promise.resolve(undefined).then(resolve) };
    }) })),
    update: vi.fn((table: symbol) => ({ set: vi.fn((values: Record<string, unknown>) => ({ where: vi.fn(async () => { updates.push({ table, values }); }) })) })),
    select,
    execute,
    transaction: vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)),
  };
  return { schema, inserts, updates, db, select, execute, calls, existingLeadRows: () => existingLeadRows, setExistingLeadRows: (rows: Array<Record<string, unknown>>) => { existingLeadRows = rows; }, resolveIdempotency: vi.fn(), resolveBranch: vi.fn(), enqueueTx: vi.fn(), enqueue: vi.fn() };
});

vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.schema }));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => "and"), eq: vi.fn(() => "eq"), isNull: vi.fn(() => "isNull"),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values })),
}));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: vi.fn(async () => "false") }));
vi.mock("@/features/ai-qualification/service", () => ({ startAiQualificationForLead: vi.fn() }));
vi.mock("@/features/leads/webhooks/services/lead-effect-outbox", () => ({ enqueueLeadEffectTx: state.enqueueTx, enqueueLeadEffect: state.enqueue }));
vi.mock("@/features/leads/webhooks/services/resolve-lead-webhook-idempotency", () => ({ resolveLeadWebhookIdempotency: state.resolveIdempotency }));
vi.mock("@/features/leads/webhooks/services/resolve-webhook-branch", () => ({ resolveWebhookBranch: state.resolveBranch, WebhookBranchNotFoundError: class WebhookBranchNotFoundError extends Error {} }));

import { createLeadFromWebhookSync } from "../services/create-lead-from-webhook-sync";

const input = { tenantId: "tenant-a", branchId: "branch-a", credentialId: "credential-a", createdByUserId: "director-a", idempotencyKey: "delivery-a", requestMetadata: { requestId: "request-a", userAgent: "test", receivedAt: new Date("2026-07-20T12:00:00Z") } };
const payload = { nome: " Maria da Silva ", telefone: "+55 (11) 99999-9999", email: " MARIA@EXAMPLE.COM " };

function inserted(table: symbol) { return state.inserts.filter((item) => item.table === table).map((item) => item.values); }

describe("createLeadFromWebhookSync", () => {
  beforeEach(() => { vi.clearAllMocks(); state.inserts.length = 0; state.updates.length = 0; state.calls.length = 0; state.setExistingLeadRows([]); state.resolveIdempotency.mockResolvedValue({ status: "new" }); });

  it("commits lead, audit, timeline, distribution event and effects without calling providers", async () => {
    const result = await createLeadFromWebhookSync({ ...input, payload });
    expect(result).toMatchObject({ success: true, duplicate: false });
    expect(inserted(state.schema.leads)).toEqual([expect.objectContaining({ tenantId: "tenant-a", branchId: "branch-a", corretorId: null, nome: "Maria da Silva", telefone: "+5511999999999", distributionStatus: "queued" })]);
    expect(inserted(state.schema.auditLogs)).toHaveLength(1);
    expect(inserted(state.schema.leadInteractions)).toHaveLength(1);
    expect(inserted(state.schema.leadDistributionEvents)).toEqual([expect.objectContaining({ action: "queued", strategy: "outbox" })]);
    expect(state.enqueueTx).toHaveBeenCalledTimes(2);
  });

  it("takes this phone's turn in the tenant before looking for an existing lead", async () => {
    await createLeadFromWebhookSync({ ...input, payload });
    const [lock] = state.execute.mock.calls[0] as [{ text: string; values: unknown[] }];
    expect(lock.text).toContain("pg_advisory_xact_lock");
    expect(lock.values).toEqual(["tenant-a", "99999999"]);
    expect(state.calls.indexOf("execute")).toBeLessThan(state.calls.indexOf("select"));
  });

  it("persists Meta source details with the lead", async () => {
    const result = await createLeadFromWebhookSync({
      ...input,
      payload,
      leadSource: { channel: "meta_lead_ads", externalId: "meta-1", metadata: { pageId: "page-1", tipoCnpj: "MEI" } },
    });
    expect(result.success).toBe(true);
    expect(inserted(state.schema.leads)[0]).toMatchObject({
      sourceChannel: "meta_lead_ads",
      sourceMetadata: { pageId: "page-1", tipoCnpj: "MEI" },
    });
  });

  it("persists an explicitly classified Meta product and its display metadata", async () => {
    await createLeadFromWebhookSync({
      ...input,
      payload,
      leadSource: {
        channel: "meta_lead_ads", externalId: "meta-pme", leadType: "PME",
        metadata: { tipoPlano: "Plano PME", tipoPlanoStatus: "provided", operadora: "SulAmérica" },
      },
    });

    expect(inserted(state.schema.leads)[0]).toMatchObject({
      tipo: "PME",
      sourceMetadata: { tipoPlano: "Plano PME", tipoPlanoStatus: "provided", operadora: "SulAmérica" },
    });
  });

  it("marks an unanswered Meta product as unknown without changing other intake defaults", async () => {
    await createLeadFromWebhookSync({
      ...input,
      payload,
      leadSource: { channel: "meta_lead_ads", externalId: "meta-no-product", metadata: { tipoPlanoStatus: "not_provided" } },
    });
    await createLeadFromWebhookSync({ ...input, idempotencyKey: "delivery-b", payload });

    expect(inserted(state.schema.leads)[0]).toMatchObject({ sourceMetadata: { tipoPlanoStatus: "not_provided" } });
    expect(inserted(state.schema.leads)[0]).not.toHaveProperty("tipo");
    expect(inserted(state.schema.leads)[1]).not.toHaveProperty("tipo");
  });

  it("merges Meta source details into an existing lead without erasing prior metadata", async () => {
    state.setExistingLeadRows([{
      id: "lead-existing",
      status: "new",
      telefone: "+5511999999999",
      sourceMetadata: { legacyKey: "preserved", campaignName: "Campaign old" },
    }]);

    const result = await createLeadFromWebhookSync({
      ...input,
      payload,
      leadSource: { channel: "meta_lead_ads", externalId: "meta-2", metadata: { pageId: "page-1", campaignName: null, tipoCnpj: "MEI" } },
    });

    expect(result).toEqual({ success: true, leadId: "lead-existing", duplicate: true });
    expect(state.updates.find((update) => update.table === state.schema.leads)?.values.sourceMetadata).toEqual({
      legacyKey: "preserved",
      campaignName: "Campaign old",
      pageId: "page-1",
      tipoCnpj: "MEI",
    });
  });

  it("does not overwrite an existing product classification when a duplicate Meta lead omits that answer", async () => {
    state.setExistingLeadRows([{
      id: "lead-existing",
      status: "new",
      telefone: "+5511999999999",
      tipo: "PME",
      sourceMetadata: { tipoPlano: "PME", tipoPlanoStatus: "provided", operadora: "Amil" },
    }]);

    await createLeadFromWebhookSync({
      ...input,
      payload,
      leadSource: { channel: "meta_lead_ads", externalId: "meta-duplicate", metadata: { tipoPlano: null, tipoPlanoStatus: "not_provided", operadora: null } },
    });

    const update = state.updates.find((entry) => entry.table === state.schema.leads)?.values;
    expect(update).not.toHaveProperty("tipo");
    expect(update?.sourceMetadata).toEqual({ tipoPlano: "PME", tipoPlanoStatus: "provided", operadora: "Amil" });
  });

  it("updates an existing lead's classification only when Meta supplies a recognized product answer", async () => {
    state.setExistingLeadRows([{
      id: "lead-existing",
      status: "new",
      telefone: "+5511999999999",
      tipo: "PF",
      sourceMetadata: { tipoPlanoStatus: "not_provided" },
    }]);

    await createLeadFromWebhookSync({
      ...input,
      payload,
      leadSource: {
        channel: "meta_lead_ads", externalId: "meta-product-update", leadType: "PME",
        metadata: { tipoPlano: "PME", tipoPlanoStatus: "provided" },
      },
    });

    expect(state.updates.find((entry) => entry.table === state.schema.leads)?.values).toMatchObject({
      tipo: "PME",
      sourceMetadata: { tipoPlano: "PME", tipoPlanoStatus: "provided" },
    });
  });

  it("returns the existing lead before creating effects on a replay", async () => {
    state.resolveIdempotency.mockResolvedValue({ status: "replay", leadId: "lead-existing" });
    await expect(createLeadFromWebhookSync({ ...input, payload })).resolves.toEqual({ success: true, leadId: "lead-existing", duplicate: true });
    expect(state.inserts).toHaveLength(0);
  });

  it("rejects a reused key with different content", async () => {
    state.resolveIdempotency.mockResolvedValue({ status: "conflict" });
    await expect(createLeadFromWebhookSync({ ...input, payload })).resolves.toEqual({ success: false, code: "IDEMPOTENCY_CONFLICT" });
  });

  it("silently discards honeypot input", async () => {
    await expect(createLeadFromWebhookSync({ ...input, payload: { ...payload, website: "bot" } })).resolves.toEqual({ success: true, leadId: "honeypot-discarded", duplicate: false });
    expect(state.inserts).toHaveLength(0);
  });
});
