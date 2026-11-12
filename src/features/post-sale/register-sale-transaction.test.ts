import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  accessContext: vi.fn(),
  buildLeadScope: vi.fn(),
  leadsRouteAllowed: vi.fn(),
  selectRows: [] as unknown[][],
  inserts: [] as Array<{ table: unknown; values: unknown }>,
  recordStageChange: vi.fn(),
  enqueueMetaConversionEvent: vi.fn(),
  publishNotification: vi.fn(),
  directorNotice: vi.fn(),
  automation: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return { ...actual, getDatabase: () => database };
});
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context }));
vi.mock("@/shared/auth/permissions", () => ({ hasPermission: () => true }));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: async () => "true" }));
vi.mock("@/features/commissions/commission-rules-service", () => ({ generateCommissionSchedule: async () => [] }));
vi.mock("@/features/leads/stage-history", () => ({ recordStageChangeForLead: mocks.recordStageChange, stageActorType: () => "broker" }));
vi.mock("@/features/notifications/send-push-helper", () => ({ publishNotification: mocks.publishNotification }));
vi.mock("@/features/notifications/realtime-sync", () => ({ publishDomainInvalidation: vi.fn() }));
vi.mock("@/features/meta-ads/meta-conversion-service", () => ({ enqueueMetaConversionEvent: mocks.enqueueMetaConversionEvent }));
vi.mock("@/features/leads/sale-details-core", () => ({ isValidCpf: () => true }));
vi.mock("@/shared/auth/access-context", () => ({ resolveAccessContext: mocks.accessContext }));
vi.mock("@/features/leads/lead-authorization", () => ({ buildLeadScopeWhere: mocks.buildLeadScope }));
vi.mock("@/features/custom-roles/service", () => ({ hasEffectiveRouteAccess: mocks.leadsRouteAllowed }));
vi.mock("@/features/leads/closing-outcome-notice", () => ({ notifyDirectorsClosingOutcome: vi.fn() }));
vi.mock("@/features/leads/lead-converted-director-alert", () => ({ notifyDirectorsLeadConverted: mocks.directorNotice }));
vi.mock("@/features/automations/engine", () => ({ triggerInstantAutomation: mocks.automation }));

import { schema } from "@/shared/db";
import { registerSaleAction } from "./actions";

function nextRows() {
  return mocks.selectRows.shift() ?? [];
}

const database = {
  select: vi.fn(() => {
    const query = {
      from: () => query,
      where: () => query,
      leftJoin: () => query,
      orderBy: () => query,
      groupBy: () => query,
      limit: () => query,
      for: () => query,
      then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(nextRows()).then(resolve, reject),
    };
    return query;
  }),
  insert: (table: unknown) => ({
    values: (values: unknown) => {
      mocks.inserts.push({ table, values });
      return { onConflictDoNothing: async () => undefined };
    },
  }),
  update: () => ({ set: () => ({ where: async () => undefined }) }),
  transaction: vi.fn(async (callback: (tx: typeof database) => unknown) => callback(database)),
};

describe("register sale transaction for a lead converted by AI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inserts = [];
    mocks.selectRows = [
      [{
        id: "lead-ai", tenantId: "tenant-1", branchId: "unit-1", corretorId: "broker-1", planId: null,
        nome: "Andrea", telefone: "5511999999999", email: null, status: "converted",
        qualificationDetails: { aiSaleDetected: { registrationPending: true } }, formData: {},
      }],
      [{ id: "holder-1", name: "Andrea", isHolder: true }],
      [{ id: "confirmation-1", status: "approved" }],
      [],
      [],
      [{ status: "converted", stageEnteredAt: new Date("2026-11-09T12:00:00Z"), qualificationDetails: { aiSaleDetected: { registrationPending: true } } }],
      [],
      [{ id: "client-existing", branchId: "unit-1", corretorId: "broker-1" }],
      [{ id: "client-existing" }],
      [],
    ];
    mocks.context.mockResolvedValue({ tenantId: "tenant-1", userId: "broker-1", role: "broker", jobTitle: "broker", branchId: "unit-1" });
    mocks.accessContext.mockResolvedValue({ permissions: new Set(["acessar_leads", "alterar_status_lead"]), scope: { teamScoped: false } });
    mocks.buildLeadScope.mockReturnValue(undefined);
    mocks.leadsRouteAllowed.mockResolvedValue(true);
    mocks.automation.mockResolvedValue(undefined);
  });

  it("reuses the lead's client and skips conversion events already emitted by the AI", async () => {
    const result = await registerSaleAction({
      leadId: "lead-ai",
      policyNumber: "POL-ANDREA",
      coverageStartDate: "2026-11-15",
      contractTermMonths: 12,
      paymentMethod: "boleto",
      renewalType: "reajuste_operadora",
      renewalContactPreference: "whatsapp",
      approvedValue: 250,
      confirmationDocumentId: "confirmation-1",
    });
    await Promise.resolve();

    expect(result).toMatchObject({ success: true, activeCustomerId: expect.any(String) });
    expect(database.transaction).toHaveBeenCalledOnce();
    expect(mocks.inserts.filter((item) => item.table === schema.clients)).toHaveLength(0);
    expect(mocks.inserts.filter((item) => item.table === schema.sales)).toHaveLength(1);
    expect(mocks.recordStageChange).not.toHaveBeenCalled();
    expect(mocks.enqueueMetaConversionEvent).not.toHaveBeenCalled();
    expect(mocks.publishNotification).not.toHaveBeenCalled();
    expect(mocks.directorNotice).toHaveBeenCalledWith(expect.objectContaining({ leadId: "lead-ai", registration: true }));
  });

  it.each([
    ["director", false],
    ["manager", false],
    ["supervisor", true],
  ])("lets %s initialize the titular only after resolving their lead scope", async (role, teamScoped) => {
    const lead = {
      id: "lead-scoped", tenantId: "tenant-1", branchId: "unit-1", corretorId: "broker-1", planId: null,
      nome: "Andrea", telefone: "5511999999999", email: null, status: "documentation_pending",
      qualificationDetails: {}, formData: {},
    };
    mocks.context.mockResolvedValue({ tenantId: "tenant-1", userId: `${role}-1`, role, jobTitle: role, branchId: "unit-1", supervisorTeamScope: teamScoped });
    mocks.accessContext.mockResolvedValue({ permissions: new Set(["acessar_leads", ...(role === "supervisor" ? [] : ["alterar_status_lead"])]), scope: { teamScoped } });
    mocks.leadsRouteAllowed.mockResolvedValue(true);
    mocks.selectRows = [[lead], [lead], []];

    const { ensureLeadHolderAction } = await import("./actions");
    const result = await ensureLeadHolderAction("lead-scoped");

    expect(result).toMatchObject({ success: true, created: true });
    expect(mocks.buildLeadScope).toHaveBeenCalledWith(expect.objectContaining({ scope: { teamScoped } }));
    expect(mocks.inserts.some((item) => item.table === schema.leadBeneficiaries)).toBe(true);
  });
});
