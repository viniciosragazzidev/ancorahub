import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRequiredTenantContext: vi.fn(),
  getRequiredSession: vi.fn(),
  getLiteAudience: vi.fn(),
  getManagerLiteLeads: vi.fn(),
  getBrokerWorkspaceData: vi.fn(),
  getFeatureFlag: vi.fn(),
  isActivePlatformAdmin: vi.fn(),
  isBrokerMyWalletEnabled: vi.fn(),
  buildAssistantThreads: vi.fn(),
  buildLeadThreads: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.getRequiredTenantContext }));
vi.mock("@/shared/auth/session", () => ({ getRequiredSession: mocks.getRequiredSession }));
vi.mock("@/features/super-admin/view-as", () => ({ isActivePlatformAdmin: mocks.isActivePlatformAdmin }));
vi.mock("@/features/call-ancora/visibility", () => ({ canUseCallAncora: ({ role, featureEnabled, platformAdmin, development }: { role: string; featureEnabled: boolean; platformAdmin: boolean; development: boolean }) => development || platformAdmin || (role === "broker" && featureEnabled) }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: mocks.getLiteAudience }));
vi.mock("@/features/supervisor-workspace/manager-lite-queries", () => ({ getManagerLiteLeads: mocks.getManagerLiteLeads }));
vi.mock("@/features/broker-workspace/queries", () => ({ getBrokerWorkspaceData: mocks.getBrokerWorkspaceData }));
vi.mock("@/features/engagement/journey-queries", () => ({ getBrokerJourneyData: vi.fn() }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: {
  BROKER_JOURNEY: { key: "journey" }, BROKER_DUTY_CALENDAR: { key: "duty" }, BROKER_NAV_REORG: { key: "nav", defaultValue: "false" }, CALL_ANCORA_VISUAL: { key: "call-ancora" },
}, getFeatureFlag: mocks.getFeatureFlag }));
vi.mock("@/features/supervisor-workspace/chat", () => ({ buildSupervisorLeadThreads: vi.fn(), buildSupervisorThreads: vi.fn(), buildTeamLeadThreads: (leads: Array<{ id: string }>) => leads.map((lead) => ({ id: `lead:${lead.id}` })) }));
vi.mock("@/features/supervisor-workspace/lite-queries", () => ({ getSupervisorLiteRadar: vi.fn() }));
vi.mock("@/features/supervisor-workspace/queries", () => ({ getSupervisorWorkspaceData: vi.fn() }));
vi.mock("@/features/customers/broker-my-wallet-flag", () => ({ isBrokerMyWalletEnabled: mocks.isBrokerMyWalletEnabled }));
vi.mock("./assistant-scripts", () => ({ buildAssistantThreads: mocks.buildAssistantThreads, buildLeadThreads: mocks.buildLeadThreads }));

import { getChatRailData } from "./chat-rail-data";

describe("manager desktop chat rail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRequiredTenantContext.mockResolvedValue({ userId: "manager-1", tenantId: "tenant-1", role: "manager", jobTitle: "manager", branchId: "branch-1" });
    mocks.getRequiredSession.mockResolvedValue({ user: { id: "broker-1" } });
    mocks.isActivePlatformAdmin.mockResolvedValue(false);
    mocks.isBrokerMyWalletEnabled.mockResolvedValue(false);
    mocks.getBrokerWorkspaceData.mockResolvedValue({ viewer: { name: "Beatriz", userId: "broker-1" }, queue: [], duty: null, agenda: [], today: { unreadNotifications: 0 }, goal: null, updatedAt: new Date("2026-11-19T12:00:00.000Z") });
    mocks.getFeatureFlag.mockImplementation(async (flag: { key: string }) => flag.key === "call-ancora" ? "true" : "false");
    mocks.buildAssistantThreads.mockReturnValue([]);
    mocks.buildLeadThreads.mockReturnValue([]);
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
    expect(rail?.assistants[4]).toMatchObject({ name: "Notificações", href: "/notificacoes", shape: "sasa" });
    expect(rail?.leadsBadgeCount).toBe(2);
    expect(rail?.leads).toHaveLength(3);
    expect(rail?.managerUnitSummary).toMatchObject({ leads: 3, unassigned: 2, activeBrokers: 2, brokersWithoutWhatsApp: 1, late: 1 });
    expect(rail?.assistants.every((thread) => thread.at !== null)).toBe(true);
    expect(mocks.getManagerLiteLeads).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-1", branchId: "branch-1" }));
  });

  it.each([
    ["a flag do corretor", false, true],
    ["flag desligada para corretor", false, false],
    ["admin ativo em Ver como", true, false],
  ])("aplica o gate do Call Âncora no rail por %s", async (_label, platformAdmin, featureEnabled) => {
    mocks.getRequiredTenantContext.mockResolvedValue({ userId: "broker-1", tenantId: "tenant-1", role: "broker", jobTitle: "broker", branchId: "branch-1", viewAs: platformAdmin ? { adminUserId: "admin-1" } : null });
    mocks.isActivePlatformAdmin.mockResolvedValue(platformAdmin);
    mocks.getFeatureFlag.mockImplementation(async (flag: { key: string }) => flag.key === "call-ancora" && featureEnabled ? "true" : "false");

    await getChatRailData();

    expect(mocks.buildAssistantThreads).toHaveBeenCalledWith(expect.objectContaining({ capabilities: expect.objectContaining({ callAncora: platformAdmin || featureEnabled }) }));
  });
});
