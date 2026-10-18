import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const query = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn(async () => []) };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  return { context: vi.fn(), audience: vi.fn(), select: vi.fn(() => query) };
});
vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({ and: (...values: unknown[]) => values, desc: (value: unknown) => value, eq: (...values: unknown[]) => values }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context }));
vi.mock("@/features/broker-workspace/experience-mode", () => ({ getExperienceMode: async () => "LIGHT" }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: mocks.audience }));
vi.mock("@/components/chat/assistant-chat", () => ({ AssistantChat: () => null }));
vi.mock("@/components/chat/mark-seen-on-view", () => ({ MarkSeenOnView: () => null }));
vi.mock("@/shared/db", () => ({ getDatabase: () => ({ select: mocks.select }), schema: { notifications: { id: "id", title: "title", message: "message", type: "type", readAt: "readAt", createdAt: "createdAt", leadId: "leadId" } } }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: { WHATSAPP_PLANTAO_NOTICE: "notice" }, getFeatureFlag: vi.fn(async () => "false") }));
vi.mock("@/app/(dashboard)/settings/whatsapp-actions", () => ({ getWhatsAppConnection: vi.fn(async () => null) }));
vi.mock("@/components/whatsapp/whatsapp-plantao-notice", () => ({ WhatsAppPlantaoNotice: () => null }));
vi.mock("next/navigation", () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); }, notFound: () => { throw new Error("not_found"); } }));

import Page from "./page";

const request = (assistant: string) => Page({ params: Promise.resolve({ assistant }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({ role: "broker", tenantId: "tenant-text", userId: "broker-text" });
  mocks.audience.mockResolvedValue("broker");
});

it.each([
  ["leads", "/minha-fila"],
  ["plantao", "/plantoes/agora"],
  ["agenda", "/agenda"],
  ["cotacao", "/cotacao"],
  ["desempenho", "/desempenho"],
  ["insights", "/conversas/broker"],
  ["jornada", "/jornada"],
])("redirects the old broker %s assistant URL to %s", async (assistant, href) => {
  await expect(request(assistant)).rejects.toThrow(`redirect:${href}`);
});

it.each([
  ["equipe", "/equipe/minha"],
  ["equipe-leads", "/leads"],
  ["equipe-plantao", "/equipe/plantao"],
  ["equipe-desempenho", "/equipe/desempenho"],
])( "redirects the old supervisor %s assistant URL to %s", async (assistant, href) => {
  mocks.context.mockResolvedValue({ role: "supervisor", tenantId: "tenant-text", userId: "supervisor-text" });
  mocks.audience.mockResolvedValue("supervisor");
  await expect(request(assistant)).rejects.toThrow(`redirect:${href}`);
});
it("keeps Jack in the assistant route and rejects assistants from another audience", async () => {
  const jack = await request("ancora");
  expect(jack).toBeTruthy();

  mocks.context.mockResolvedValue({ role: "supervisor", tenantId: "tenant-text", userId: "supervisor-text" });
  mocks.audience.mockResolvedValue("supervisor");
  await expect(request("leads")).rejects.toThrow("not_found");
});
