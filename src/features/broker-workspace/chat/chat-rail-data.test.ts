import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequiredTenantContext: vi.fn(),
  getLiteAudience: vi.fn(),
  getManagerLiteLeads: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.getRequiredTenantContext }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: mocks.getLiteAudience }));
vi.mock("@/features/supervisor-workspace/manager-lite-queries", () => ({ getManagerLiteLeads: mocks.getManagerLiteLeads }));
vi.mock("@/features/broker-workspace/queries", () => ({ getBrokerWorkspaceData: vi.fn() }));
vi.mock("@/features/engagement/journey-queries", () => ({ getBrokerJourneyData: vi.fn() }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: {}, getFeatureFlag: vi.fn() }));
vi.mock("@/features/supervisor-workspace/chat", () => ({ buildSupervisorLeadThreads: vi.fn(), buildSupervisorThreads: vi.fn(), buildTeamLeadThreads: (leads: Array<{ id: string }>) => leads.map((lead) => ({ id: `lead:${lead.id}` })) }));
vi.mock("@/features/supervisor-workspace/lite-queries", () => ({ getSupervisorLiteRadar: vi.fn() }));
vi.mock("@/features/supervisor-workspace/queries", () => ({ getSupervisorWorkspaceData: vi.fn() }));
vi.mock("./assistant-scripts", () => ({ buildAssistantThreads: vi.fn(), buildLeadThreads: vi.fn() }));

import { getChatRailData } from "./chat-rail-data";

describe("manager desktop chat rail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequiredTenantContext.mockResolvedValue({ userId: "manager-1", tenantId: "tenant-1", role: "manager", jobTitle: "manager", branchId: "branch-1" });
    mocks.getLiteAudience.mockResolvedValue("manager");
    mocks.getManagerLiteLeads.mockResolvedValue({
      viewerName: "Ana Gestora",
      leads: [
        { id: "lead-1", ownerId: "broker-1" },
        { id: "lead-2", ownerId: null },
        { id: "lead-3", ownerId: null },
      ],
      team: [
        { id: "broker-1", openCount: 2, late: 0 },
        { id: "broker-2", openCount: 0, late: 1 },
      ],
      brokersWithoutWhatsApp: 1,
    });
  });

  it("builds unit lead and team conversations with scoped counts and destinations", async () => {
    const rail = await getChatRailData();

    expect(rail?.viewerName).toBe("Ana Gestora");
    expect(rail?.assistants).toHaveLength(5);
    expect(rail?.assistants[0]).toMatchObject({
      name: "Leads da unidade",
      preview: "2 leads aguardando distribuição manual.",
      pinned: true,
      waitingYou: true,
      href: "/leads",
      shape: "favo",
    });
    expect(rail?.assistants[1]).toMatchObject({
      name: "Minha unidade",
      preview: "1 corretor em atendimento na unidade.",
      href: "/equipe",
      shape: "mochi",
      waitingYou: true,
    });
    // "Desempenho da unidade" comes back with its own page (plan E5); it must not duplicate Minha unidade.
    expect(rail?.assistants.some((thread) => thread.name === "Desempenho da unidade")).toBe(false);
    // Desktop has no "Mais" sheet, so Clientes is reachable from the rail.
    expect(rail?.assistants[2]).toMatchObject({ name: "Clientes da unidade", href: "/clientes" });
    expect(rail?.assistants[3]).toMatchObject({ name: "Mensagens da unidade", href: "/mensagens" });
    expect(rail?.assistants[4]).toMatchObject({ name: "Notificações", href: "/notificacoes", shape: "jack" });
    expect(rail?.leadsBadgeCount).toBe(2);
    expect(rail?.leads).toHaveLength(3);
    expect(rail?.managerUnitSummary).toMatchObject({ leads: 3, unassigned: 2, activeBrokers: 2, brokersWithoutWhatsApp: 1, late: 1 });
    expect(rail?.assistants.every((thread) => thread.at !== null)).toBe(true);
    expect(mocks.getManagerLiteLeads).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-1", branchId: "branch-1" }));
  });
});
