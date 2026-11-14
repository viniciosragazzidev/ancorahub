import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, sql, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

const mocks = vi.hoisted(() => ({
  flag: "true",
  platform: { enabled: true, modules: ["finance"] } as { enabled: boolean; modules: string[] },
  requireErpAccess: vi.fn(),
  auditErp: vi.fn(),
  access: { hasCargo: false, roleCapabilities: new Set<string>(), capabilities: new Set<string>(), routes: new Set<string>() },
  results: {} as Record<string, unknown[][]>,
  wheres: {} as Record<string, SQL[]>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async () => {
  const schema = await import("@/shared/db/schema");
  /** Fake query chain: the result is chosen by the table in `from`, and every `where` is kept for inspection. */
  const select = () => {
    let table = "";
    let result: unknown[] = [];
    const chain: Record<string, unknown> = new Proxy({}, {
      get(_target, prop) {
        if (prop === "then") return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
        return (...args: unknown[]) => {
          if (prop === "from") { table = getTableName(args[0] as never); result = mocks.results[table]?.shift() ?? []; }
          if (prop === "where") (mocks.wheres[table] ??= []).push(args[0] as SQL);
          return chain;
        };
      },
    });
    return chain;
  };
  return { getDatabase: () => ({ select }), schema };
});
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: async () => mocks.flag }));
vi.mock("./access", () => ({
  requireErpAccess: mocks.requireErpAccess,
  getErpPlatformState: async () => mocks.platform,
  getErpEffectiveAccess: async () => mocks.access,
  auditErp: mocks.auditErp,
  auditActor: (context: { userId: string; viewAs?: { adminUserId: string } }) => context.viewAs?.adminUserId ?? context.userId,
  // Marker: the test reads which ERP scope reached each query.
  erpScopeSql: (scope: { mode: string }) => sql.raw(`/*erp-scope:${scope.mode}*/ true`),
}));

import { ErpError } from "./contracts";
import { BROKER_FINANCE_AUDIT_ACTION, BROKER_FINANCE_SUMMARY_AUDIT_ACTION, getBrokerFinanceDetail, getBrokerFinanceSummary } from "./broker-finance";

const broker = { tenantId: "t-1", userId: "broker-1", role: "broker" as const, jobTitle: "broker", branchId: "b-1" };
const ownAccess = { context: broker, scope: { mode: "owners", ownerIds: ["broker-1"] } };
const now = new Date("2026-11-13T15:00:00Z");
const dialect = new PgDialect();
const render = (where: SQL) => dialect.sqlToQuery(where);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.flag = "true";
  mocks.platform = { enabled: true, modules: ["finance"] };
  mocks.requireErpAccess.mockResolvedValue(ownAccess);
  mocks.access = { hasCargo: false, roleCapabilities: new Set(["ver_comissao_propria"]), capabilities: new Set(["ver_comissao_propria"]), routes: new Set() };
  mocks.results = {};
  mocks.wheres = {};
});

describe("getBrokerFinanceSummary: quem pode ver", () => {
  it("com a chave desligada devolve null sem consultar o ERP", async () => {
    mocks.flag = "false";
    expect(await getBrokerFinanceSummary(broker, now)).toBeNull();
    expect(mocks.requireErpAccess).not.toHaveBeenCalled();
  });

  it("sem o módulo financeiro liberado pela plataforma devolve null", async () => {
    mocks.platform = { enabled: true, modules: ["analytics"] };
    expect(await getBrokerFinanceSummary(broker, now)).toBeNull();
    mocks.platform = { enabled: false, modules: ["finance"] };
    expect(await getBrokerFinanceSummary(broker, now)).toBeNull();
    expect(mocks.requireErpAccess).not.toHaveBeenCalled();
  });

  it("módulo inativo na empresa ou fora do perfil (recusa do ERP) devolve null", async () => {
    mocks.requireErpAccess.mockRejectedValue(new ErpError("Este módulo não está liberado para seu perfil nesta empresa."));
    expect(await getBrokerFinanceSummary(broker, now)).toBeNull();
    expect(mocks.requireErpAccess).toHaveBeenCalledWith("finance", "erp_view_finance");
  });

  it("sem ver_comissao_propria devolve null", async () => {
    mocks.access = { hasCargo: false, roleCapabilities: new Set(), capabilities: new Set(), routes: new Set() };
    expect(await getBrokerFinanceSummary(broker, now)).toBeNull();
  });

  it("com cargo sem a rota de Comissões devolve null", async () => {
    mocks.access = { hasCargo: true, roleCapabilities: new Set(["ver_comissao_propria"]), capabilities: new Set(["ver_comissao_propria"]), routes: new Set() };
    expect(await getBrokerFinanceSummary(broker, now)).toBeNull();
  });

  it("um contexto diferente da sessão nunca abre o financeiro de outra pessoa", async () => {
    expect(await getBrokerFinanceSummary({ ...broker, userId: "broker-2" }, now)).toBeNull();
  });

  it("erro que não é recusa do ERP sobe (a tela mostra o estado de erro)", async () => {
    mocks.requireErpAccess.mockRejectedValue(new Error("banco fora"));
    await expect(getBrokerFinanceSummary(broker, now)).rejects.toThrow("banco fora");
  });
});

describe("getBrokerFinanceSummary: números do próprio corretor", () => {
  it("usa o escopo do ERP e o beneficiário da sessão, e mostra Sem dado quando não há base", async () => {
    mocks.results = {
      erp_financial_entries: [[{ commissions: 3, receivable: 150_000, advances: 0, openAdvances: 0 }]],
      erp_settlements: [[{ value: 42_500 }]],
      erp_events: [[]],
    };
    const summary = await getBrokerFinanceSummary(broker, now);
    expect(summary).toEqual({ period: "2026-11", periodLabel: "novembro de 2026", receivableCents: 150_000, receivedThisMonthCents: 42_500, openAdvancesCents: null });
    for (const table of ["erp_financial_entries", "erp_settlements"]) {
      const query = render(mocks.wheres[table][0]);
      expect(query.sql).toContain("/*erp-scope:owners*/");
      expect(query.sql).toMatch(/"beneficiary_id" = \$\d+/);
      expect(query.params).toContain("broker-1");
      expect(query.params).toContain("t-1");
      expect(query.params).toContain("approved");
    }
    const month = render(mocks.wheres.erp_settlements[0]);
    expect(month.params).toEqual(expect.arrayContaining(["confirmed", "2026-11-01", "2026-12-01"]));
  });

  it("sem nenhuma comissão aprovada, a receber e recebido são Sem dado (nunca zero)", async () => {
    mocks.results = {
      erp_financial_entries: [[{ commissions: 0, receivable: 0, advances: 1, openAdvances: 30_000 }]],
      erp_settlements: [[{ value: 0 }]],
      erp_events: [[]],
    };
    const summary = await getBrokerFinanceSummary(broker, now);
    expect(summary?.receivableCents).toBeNull();
    expect(summary?.receivedThisMonthCents).toBeNull();
    expect(summary?.openAdvancesCents).toBe(30_000);
  });

  it("audita o resumo no máximo uma vez por hora", async () => {
    mocks.results = { erp_financial_entries: [[{ commissions: 1, receivable: 0, advances: 0, openAdvances: 0 }]], erp_settlements: [[{ value: 0 }]], erp_events: [[]] };
    await getBrokerFinanceSummary(broker, now);
    expect(mocks.auditErp).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: BROKER_FINANCE_SUMMARY_AUDIT_ACTION, actorId: "broker-1", entityId: "broker_finance" }));
    mocks.auditErp.mockClear();
    mocks.results = { erp_financial_entries: [[{ commissions: 1, receivable: 0, advances: 0, openAdvances: 0 }]], erp_settlements: [[{ value: 0 }]], erp_events: [[{ id: "recent" }]] };
    await getBrokerFinanceSummary(broker, now);
    expect(mocks.auditErp).not.toHaveBeenCalled();
  });
});

describe("getBrokerFinanceDetail", () => {
  const seed = (overrides: Partial<Record<string, unknown[][]>> = {}) => {
    mocks.results = {
      erp_financial_entries: [
        [{ commissions: 2, receivable: 80_000, advances: 1, openAdvances: 20_000 }],
        [
          { originCommissionId: "c-1", status: "approved", amountCents: 50_000, settledCents: 50_000 },
          { originCommissionId: "c-2", status: "rejected", amountCents: 30_000, settledCents: 0 },
          { originCommissionId: "c-2", status: "approved", amountCents: 31_000, settledCents: 0 },
        ],
      ],
      erp_settlements: [[{ value: 50_000 }]],
      commission_schedule: [[
        { id: "c-1", monthNumber: 1, referenceMonth: "2026-10", amount: "500.00", scheduleStatus: "pending", clientName: "Cliente Sintético A", planName: "Plano X", carrierName: "Operadora Y" },
        { id: "c-2", monthNumber: 2, referenceMonth: "2026-11", amount: "300.00", scheduleStatus: "pending", clientName: "Cliente Sintético A", planName: null, carrierName: null },
        { id: "c-3", monthNumber: 3, referenceMonth: "2026-12", amount: "300.00", scheduleStatus: "pending", clientName: "Cliente Sintético B", planName: null, carrierName: null },
      ]],
      erp_payouts: [[{ id: "p-1", competence: "2026-10", occurredOn: "2026-11-05", netCents: 50_000, receiptNumber: "R-0001" }]],
      ...overrides,
    };
  };

  it("lista só o que é do corretor, com estados prevista, conferida e paga, e audita a leitura", async () => {
    seed();
    const detail = await getBrokerFinanceDetail(broker, { page: 1 }, now);
    expect(detail?.commissions.rows.map((row) => [row.id, row.state, row.amountCents, row.product])).toEqual([
      ["c-1", "paga", 50_000, "Operadora Y · Plano X"],
      ["c-2", "conferida", 31_000, null],
      ["c-3", "prevista", 30_000, null],
    ]);
    expect(detail?.payouts).toEqual([{ id: "p-1", competence: "2026-10", occurredOn: "2026-11-05", netCents: 50_000, receiptNumber: "R-0001", receiptHref: "/financeiro/recibos/p-1" }]);
    const schedule = render(mocks.wheres.commission_schedule[0]);
    expect(schedule.sql).toMatch(/"sales"\."broker_id" = \$\d+/);
    expect(schedule.sql).toContain("/*erp-scope:owners*/");
    expect(schedule.params).toContain("broker-1");
    const payouts = render(mocks.wheres.erp_payouts[0]);
    expect(payouts.sql).toMatch(/"beneficiary_id" = \$\d+/);
    expect(payouts.params).toEqual(expect.arrayContaining(["broker-1", "settled"]));
    const linked = render(mocks.wheres.erp_financial_entries[1]);
    expect(linked.params).toEqual(expect.arrayContaining(["broker-1", "broker_commission"]));
    expect(mocks.auditErp).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: BROKER_FINANCE_AUDIT_ACTION, entityType: "erp_access", entityId: "broker_finance" }));
  });

  it("sem a rota de recibos, o repasse aparece sem link", async () => {
    mocks.access = { hasCargo: true, roleCapabilities: new Set(["ver_comissao_propria"]), capabilities: new Set(["ver_comissao_propria"]), routes: new Set(["route:erp-comissoes"]) };
    seed();
    const detail = await getBrokerFinanceDetail(broker, { page: 1 }, now);
    expect(detail?.payouts[0].receiptHref).toBeNull();
    expect(detail?.receiptsHref).toBeNull();
  });

  it("indica a próxima página quando há mais parcelas", async () => {
    const many = Array.from({ length: 21 }, (_, index) => ({ id: `c-${index}`, monthNumber: 1, referenceMonth: "2026-11", amount: "10.00", scheduleStatus: "pending", clientName: "Cliente", planName: null, carrierName: null }));
    seed({ commission_schedule: [many], erp_financial_entries: [[{ commissions: 0, receivable: 0, advances: 0, openAdvances: 0 }], []] });
    const detail = await getBrokerFinanceDetail(broker, { page: 2 }, now);
    expect(detail?.commissions.rows).toHaveLength(20);
    expect(detail?.commissions.hasNext).toBe(true);
    expect(detail?.commissions.page).toBe(2);
  });

  it("sem acesso devolve null e não audita", async () => {
    mocks.requireErpAccess.mockRejectedValue(new ErpError("Este módulo está desativado. Solicite a ativação ao administrador."));
    expect(await getBrokerFinanceDetail(broker, {}, now)).toBeNull();
    expect(mocks.auditErp).not.toHaveBeenCalled();
  });
});
