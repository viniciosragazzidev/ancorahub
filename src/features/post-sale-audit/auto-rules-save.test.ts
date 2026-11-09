import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "A régua automática não está salvando" (09/11): exercita a action com exatamente o que a tela
 * manda, passando pelo schema, pela checagem de referências e pelo upsert real do store (banco falso).
 */
const state = vi.hoisted(() => ({
  context: { tenantId: "tenant-1", userId: "director-1", role: "director", branchId: null, jobTitle: null, customRoleId: null } as Record<string, unknown>,
  inserts: [] as Array<{ table: unknown; values: Record<string, unknown>; conflict?: { target: unknown; set: Record<string, unknown> } }>,
  selectRows: [] as unknown[][],
  insertError: null as unknown,
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: vi.fn(async () => state.context) }));
vi.mock("@/features/custom-roles/service", () => ({ hasEffectiveCapability: vi.fn(async () => true) }));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: vi.fn(async () => "true"), getSystemSetting: vi.fn(async () => null), setSystemSetting: vi.fn() }));
vi.mock("@/features/communication-channels/outbound-service", () => ({ enqueueMetaTemplateMessage: vi.fn(), enqueuePostSaleSurveyWahaMessage: vi.fn() }));
vi.mock("./auto-sweep", () => ({ previewAutoRule: vi.fn() }));
vi.mock("./conversation", () => ({ sendPostSaleNudge: vi.fn() }));
vi.mock("./campaign-retry-service", () => ({ loadPostSaleCampaignCounts: vi.fn(), retryFailedPostSaleSurveys: vi.fn() }));
vi.mock("./queries", () => ({ loadLatestPostSaleLeadSurvey: vi.fn(), loadPostSaleAlertTarget: vi.fn(), loadPostSaleBrokerReport: vi.fn(), loadPostSaleBrokerSummary: vi.fn(), loadPostSaleOpenAlerts: vi.fn() }));
vi.mock("./audience", () => ({ resolvePostSaleAudience: vi.fn() }));
vi.mock("@/shared/db", async () => {
  const { schema } = await vi.importActual<typeof import("@/shared/db/client")>("@/shared/db/client");
  const chain = (rows: unknown[]) => {
    const thenable = { then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve) };
    return { from: () => ({ where: () => thenable }) };
  };
  return {
    schema,
    getDatabase: () => ({
      select: () => chain(state.selectRows.shift() ?? []),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => {
          const entry: (typeof state.inserts)[number] = { table, values };
          state.inserts.push(entry);
          const done = Promise.resolve(undefined);
          return Object.assign(done, {
            onConflictDoUpdate: (conflict: { target: unknown; set: Record<string, unknown> }) => {
              entry.conflict = conflict;
              return {
                returning: async () => {
                  if (state.insertError) throw state.insertError;
                  return [{ ...values, updatedAt: values.updatedAt }];
                },
              };
            },
          });
        },
      }),
    }),
  };
});

import { schema } from "@/shared/db/client";
import { savePostSaleAutoRuleAction } from "./actions";
import { autoRuleSavePayload, defaultAutoRuleSettings, parseAutoRuleRow } from "./auto-rules";

describe("savePostSaleAutoRuleAction com o que a tela manda", () => {
  beforeEach(() => {
    state.inserts.length = 0;
    state.selectRows = [];
    state.insertError = null;
    state.context = { tenantId: "tenant-1", userId: "director-1", role: "director", branchId: null, jobTitle: null, customRoleId: null };
  });

  it("liga a R1 com os padrões (sem piloto, sem filtros) e grava a linha com todas as colunas da 0224", async () => {
    const payload = autoRuleSavePayload(parseAutoRuleRow("R1", null), { delay: "1", limit: "60", enabled: true });
    const result = await savePostSaleAutoRuleAction(payload);

    expect(result).toEqual({ ok: true, data: expect.objectContaining({ key: "R1", enabled: true, delayBusinessDays: 1, dailyLimit: 60, pilot: { queueIds: [], brokerIds: [] } }) });
    const rule = state.inserts.find((entry) => entry.table === schema.postSaleRules);
    expect(rule?.values).toMatchObject({
      tenantId: "tenant-1",
      key: "R1",
      enabled: true,
      delayBusinessDays: 1,
      dailyLimit: 60,
      filters: { queueIds: [], branchIds: [], leadTypes: [] },
      pilot: { queueIds: [], brokerIds: [] },
      updatedBy: "director-1",
    });
    expect(typeof rule?.values.id).toBe("string");
    expect(rule?.conflict?.target).toEqual([schema.postSaleRules.tenantId, schema.postSaleRules.key]);
    expect(rule?.conflict?.set).toMatchObject({ enabled: true, updatedBy: "director-1" });
    expect(state.inserts.some((entry) => entry.table === schema.auditLogs && entry.values.acao === "post_sale.auto_rule.updated")).toBe(true);
  });

  it("a chave sozinha (sem rascunho) manda os números salvos e passa no schema", async () => {
    const payload = autoRuleSavePayload({ ...defaultAutoRuleSettings("R3"), enabled: true });
    expect(payload).toEqual({ key: "R3", enabled: true, delayBusinessDays: 3, dailyLimit: 60, filters: { queueIds: [], branchIds: [], leadTypes: [] }, pilot: { queueIds: [], brokerIds: [] } });
    const result = await savePostSaleAutoRuleAction(payload);
    expect(result.ok).toBe(true);
  });

  it("campo vazio no rascunho volta ao valor salvo em vez de virar 0 e falhar", () => {
    const payload = autoRuleSavePayload(defaultAutoRuleSettings("R2"), { delay: "", limit: " " });
    expect(payload).toMatchObject({ delayBusinessDays: 5, dailyLimit: 60 });
  });

  it("piloto com fila existente passa pela checagem de referências", async () => {
    state.selectRows = [[{ id: "queue-1" }]];
    const settings = { ...defaultAutoRuleSettings("R1"), pilot: { queueIds: ["queue-1"], brokerIds: [] } };
    const result = await savePostSaleAutoRuleAction(autoRuleSavePayload(settings, { delay: "1", limit: "20", enabled: true }));
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ enabled: true, pilot: { queueIds: ["queue-1"], brokerIds: [] }, dailyLimit: 20 }) });
  });

  it("limite acima de 60 volta com mensagem clara (visível na tela)", async () => {
    const result = await savePostSaleAutoRuleAction(autoRuleSavePayload(defaultAutoRuleSettings("R1"), { delay: "1", limit: "80", enabled: true }));
    expect(result).toEqual({ ok: false, error: "O limite diário pode ser de até 60." });
  });

  it("gestor não salva", async () => {
    state.context = { ...state.context, role: "manager", branchId: "branch-1" };
    const result = await savePostSaleAutoRuleAction(autoRuleSavePayload(defaultAutoRuleSettings("R1"), { delay: "1", limit: "60", enabled: true }));
    expect(result).toEqual({ ok: false, error: "Apenas diretores podem alterar a régua automática." });
    expect(state.inserts).toHaveLength(0);
  });

  it("erro do banco vira mensagem genérica, nunca silêncio", async () => {
    state.insertError = Object.assign(new Error("connection reset"), { code: "08006" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await savePostSaleAutoRuleAction(autoRuleSavePayload(defaultAutoRuleSettings("R1"), { delay: "1", limit: "60", enabled: true }));
    expect(result).toEqual({ ok: false, error: "Não foi possível concluir a operação agora." });
    spy.mockRestore();
  });
});
