import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), flag: vi.fn(), journey: vi.fn(), summaries: vi.fn(), workspace: vi.fn(), audience: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: { BROKER_JOURNEY: "journey" }, getFeatureFlag: mocks.flag }));
vi.mock("@/features/broker-workspace/experience-mode", () => ({ getExperienceMode: async () => "LIGHT" }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: mocks.audience }));
vi.mock("@/features/broker-workspace/queries", () => ({ getBrokerWorkspaceData: mocks.workspace }));
vi.mock("@/features/broker-workspace/chat/chat-rail-data", () => ({ getCachedBrokerJourneyData: mocks.journey, getCachedSupervisorWorkspaceData: vi.fn() }));
vi.mock("@/features/engagement/journey-queries", () => ({ getJourneyDailySummaries: mocks.summaries }));
vi.mock("@/features/supervisor-workspace/chat", () => ({ buildSupervisorScript: vi.fn() }));
vi.mock("@/components/chat/assistant-chat", () => ({ AssistantChat: () => null }));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); }, notFound: () => { throw new Error("not_found"); } }));
import Page from "./page";
const request = () => Page({ params: Promise.resolve({ assistant: "jornada" }) });
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue({ role: "broker", tenantId: "tenant-text", userId: "broker-text" }); mocks.flag.mockResolvedValue("true"); mocks.journey.mockResolvedValue(null); mocks.summaries.mockResolvedValue([]); mocks.audience.mockResolvedValue("supervisor"); });
it("opens Jornada with only the authenticated broker's journey data", async () => {
  expect(await request()).toBeTruthy();
  expect(mocks.journey).toHaveBeenCalledWith("tenant-text", "broker-text");
  expect(mocks.summaries).toHaveBeenCalledWith("tenant-text", "broker-text");
  expect(mocks.workspace).not.toHaveBeenCalled();
});
it("redirects to Início with the flag off, without a self-redirect loop or data reads", async () => {
  mocks.flag.mockResolvedValue("false");
  await expect(request()).rejects.toThrow("redirect:/dashboard");
  expect(mocks.journey).not.toHaveBeenCalled(); expect(mocks.summaries).not.toHaveBeenCalled();
});
it("denies supervisor access to the broker-only assistant", async () => {
  mocks.context.mockResolvedValue({ role: "supervisor" });
  await expect(request()).rejects.toThrow("not_found");
  expect(mocks.journey).not.toHaveBeenCalled();
});
it("handles unavailable tables without redirecting the conversation to itself", async () => {
  mocks.journey.mockRejectedValue(new Error("missing migration"));
  expect(await request()).toBeTruthy();
});
