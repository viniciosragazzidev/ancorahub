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
vi.mock("@/features/supervisor-workspace/chat", () => ({ buildSupervisorLeadThreads: vi.fn(), buildSupervisorThreads: vi.fn() }));
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
        { id: "broker-1", openCount: 2 },
        { id: "broker-2", openCount: 0 },
      ],
    });
  });

  it("builds unit lead and team conversations with scoped counts and destinations", async () => {
    const rail = await getChatRailData();

    expect(rail?.viewerName).toBe("Ana Gestora");
    expect(rail?.assistants).toHaveLength(2);
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
      shape: "nuvem",
    });
    expect(rail?.assistants.every((thread) => thread.at !== null)).toBe(true);
    expect(mocks.getManagerLiteLeads).toHaveBeenCalledWith(expect.objectContaining({ tenantId: "tenant-1", branchId: "branch-1" }));
  });
});
