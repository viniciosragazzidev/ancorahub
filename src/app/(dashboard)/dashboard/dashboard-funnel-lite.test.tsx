import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "director" as string,
  flag: true,
  units: [{ id: "77777777-7777-4777-8777-777777777777", name: "Centro" }],
  firstName: "Renata",
  getFunnel: vi.fn(),
}));

vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: async () => ({ role: state.role, tenantId: "tenant-funil", branchId: state.role === "manager" ? "unidade-gestor" : null }),
}));
vi.mock("@/shared/observability/request-timing", () => ({
  withRequestTiming: async (_route: string, work: () => Promise<unknown>) => ({ result: await work() }),
}));
vi.mock("@/features/broker-workspace/experience-mode", () => ({ getExperienceMode: async () => "NORMAL" }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: async () => null }));
vi.mock("@/features/reports/metrics/lead-quality-service", () => ({ canAccessLeadQualityCenter: async () => true }));
vi.mock("@/features/reports/metrics/lead-quality-period", () => ({ parseLeadQualityPeriod: () => 30, leadQualityWindow: () => ({ since: new Date(), until: null }), isLeadQualityRange: () => false, rangeDays: () => null }));
const queueA = "fila-a";
vi.mock("@/features/reports/metrics/lead-quality-export", () => ({ listLeadQualityQueues: async () => [{ id: "fila-a", name: "Fila A" }] }));
vi.mock("@/features/dashboard/entries/entries-by-turn", () => ({ getEntriesByTurn: async () => ({ turns: [], totals: { whatsapp: 0, form: 0, other: 0, total: 0 } }) }));
vi.mock("@/features/reports/components/lead-quality-center", () => ({ LeadQualityCenter: () => null }));
vi.mock("@/shared/feature-flags/catalog", () => ({ FEATURE_FLAGS: { REPORTING_CENTER: { key: "reporting" } } }));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: async () => "true" }));
vi.mock("@/features/qualification-turbo/funnel", () => ({
  parseFunnelPeriod: (value: string | undefined) => (value === "30" ? 30 : value === "90" ? 90 : 7),
  funnelPeriodForOverview: (period: "today" | "7d" | "30d") => period === "today" ? "today" : period === "7d" ? 7 : 30,
  getQualificationFunnel: (...args: unknown[]) => state.getFunnel(...args),
  funnelPeriodStart: () => new Date("2026-11-01T03:00:00.000Z"),
}));
// Funil profissional (05/11): os recortes extras têm teste próprio; aqui só não podem quebrar a aba.
vi.mock("@/features/funnel-insights/queries", () => ({ getFunnelInsights: async () => null }));
vi.mock("@/features/reports/metrics/narrow-scope", () => ({ parseBranchIdParam: (value: string | undefined) => value ?? null }));
vi.mock("@/features/director-lite/style-flag", () => ({ shouldUseDirectorLiteStyle: async () => !["broker", "supervisor"].includes(state.role) && state.flag }));
vi.mock("@/features/dashboard/director-lite-branches", () => ({
  getDashboardUnitFilter: async () => ({ canCompare: true, units: state.units }),
  resolveRequestedUnit: (requested: string | null, units: Array<{ id: string }>) => requested && units.some((unit) => unit.id === requested) ? requested : null,
}));
vi.mock("@/features/dashboard/today", () => ({ getCommandCenterData: async () => ({}) }));
vi.mock("@/features/dashboard/essential/essential-data", () => ({ getEssentialDashboard: async () => ({}) }));
vi.mock("@/features/dashboard/director-lite-viewer", () => ({ getDirectorLiteViewerFirstName: async () => state.firstName }));
vi.mock("@/features/dashboard/components/command-center", () => ({ CommandCenter: () => null }));

import DashboardPage from "./page";
import { QualificationFunnelView } from "@/features/qualification-turbo/components/qualification-funnel-view";
import { DirectorLiteQualificationFunnelPage } from "@/features/dashboard/components/director-lite/qualification-funnel-page";

const fixture = { period: 30, stages: [], since: "2026-10-01T00:00:00.000Z", medianMinutesToReply: null, now: [], lossReasons: [], variants: [], touches: [], cost: null };
const allowedUnit = "77777777-7777-4777-8777-777777777777";

beforeEach(() => {
  state.role = "director";
  state.flag = true;
  state.units = [{ id: allowedUnit, name: "Centro" }];
  state.getFunnel.mockReset().mockResolvedValue(fixture);
});
afterEach(() => vi.clearAllMocks());

describe("aba Funil de qualificação do Diretor Lite", () => {
  // 20/11/2026: o Funil filtra por intervalo e fila (não mais por unidade) e traz as entradas por turno.
  it("usa a tela Lite com o período e a fila escolhidos", async () => {
    const element = await DashboardPage({ searchParams: Promise.resolve({ tab: "funnel", periodo: "30", fila: queueA }) });
    expect(element.type).toBe(DirectorLiteQualificationFunnelPage);
    expect(element.props).toMatchObject({ queueId: queueA, branchId: null, data: fixture, firstName: "Renata", now: expect.any(Date) });
    expect(element.props.entries).toMatchObject({ totals: { total: 0 } });
    expect(state.getFunnel).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-funil", role: "director" }), 30, null, queueA, null);
  });

  it("mapeia Hoje para o período operacional", async () => {
    const element = await DashboardPage({ searchParams: Promise.resolve({ tab: "funnel", periodo: "hoje" }) });
    expect(element.type).toBe(DirectorLiteQualificationFunnelPage);
    expect(state.getFunnel).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-funil", role: "director" }), "today", null, null, null);
  });

  it("ignora fila desconhecida e consulta todas as filas", async () => {
    const element = await DashboardPage({ searchParams: Promise.resolve({ tab: "funnel", periodo: "7", fila: "outra" }) });
    expect(element.type).toBe(DirectorLiteQualificationFunnelPage);
    expect(element.props.queueId).toBeNull();
    expect(state.getFunnel).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-funil" }), 7, null, null, null);
  });

  it("com a chave desligada mantém a tela antiga e sua chamada sem filtro adicional", async () => {
    state.flag = false;
    const element = await DashboardPage({ searchParams: Promise.resolve({ tab: "funnel", period: "30", unidade: allowedUnit }) });
    expect(element.type).toBe(QualificationFunnelView);
    expect(element.props).toEqual({ data: fixture, showQualityTab: true });
    expect(state.getFunnel).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-funil" }), 30);
  });

  it("gestor também usa o funil Lite; a unidade dele vem da sessão (escopo do funil)", async () => {
    state.role = "manager";
    const element = await DashboardPage({ searchParams: Promise.resolve({ tab: "funnel", periodo: "7" }) });
    expect(element.type).toBe(DirectorLiteQualificationFunnelPage);
    expect(state.getFunnel).toHaveBeenCalledWith(expect.objectContaining({ role: "manager", branchId: "unidade-gestor" }), 7, null, null, null);
  });

  it("gestor com a chave desligada continua na aba antiga e sua unidade vem da sessão", async () => {
    state.role = "manager";
    state.flag = false;
    const element = await DashboardPage({ searchParams: Promise.resolve({ tab: "funnel", period: "7", unidade: allowedUnit }) });
    expect(element.type).toBe(QualificationFunnelView);
    expect(state.getFunnel).toHaveBeenCalledWith(expect.objectContaining({ role: "manager", branchId: "unidade-gestor" }), 7);
  });
});
