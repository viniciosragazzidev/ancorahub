// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  flags: {} as Record<string, string>,
  liteEnabled: true,
  journeyData: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => ({ role: "broker", tenantId: "t-1", userId: "u-1" }) }));
vi.mock("@/features/broker-workspace/lite-audience", () => ({ getLiteAudience: async () => "broker" }));
vi.mock("@/components/light/light-routes", () => ({ isLightRouteAllowed: () => true }));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: async (flag: { key: string }) => mocks.flags[flag.key] ?? "false" }));
vi.mock("@/features/broker-performance/queries", () => ({
  isBrokerPerformanceLiteEnabled: async () => mocks.liteEnabled,
  getBrokerPerformance: async () => ({
    period: "7d",
    today: "2026-11-13",
    current: { leads: 4, quotes: 2, sales: 1, revenue: 900, slaRate: 75, slaLeads: 4 },
    previous: { leads: 3, quotes: 2, sales: 1, revenue: 800, slaRate: 100, slaLeads: 3 },
    series: [],
    carriers: [],
    goal: null,
  }),
}));
vi.mock("@/features/broker-workspace/queries", () => ({
  getBrokerWorkspaceData: async () => ({ today: { receivedToday: 2, acceptedToday: 1, inServiceNow: 1, slaAtRiskNow: 0 }, goal: null }),
}));
vi.mock("@/features/broker-workspace/chat/chat-rail-data", () => ({ getCachedBrokerJourneyData: mocks.journeyData }));
vi.mock("@/features/journey/components/journey-entry-card", () => ({ JourneyEntryCard: () => <section data-testid="journey-card">Minha jornada</section> }));
vi.mock("@/features/broker-performance/components/broker-performance-lite", () => ({
  BrokerPerformanceLite: ({ composition, journey }: { composition?: string; journey?: React.ReactNode }) => (
    <div data-testid="lite" data-composition={composition ?? "classic"}>{journey}</div>
  ),
}));

import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

import BrokerPerformancePage from "./page";

const renderPage = async () => render(await BrokerPerformancePage({ searchParams: Promise.resolve({}) }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.flags = {};
  mocks.liteEnabled = true;
  mocks.journeyData.mockResolvedValue(null);
});

describe("/desempenho", () => {
  it("com a chave ligada, usa a composição por resultados e põe Minha jornada dentro dela", async () => {
    mocks.flags = { [FEATURE_FLAGS.BROKER_NAV_REORG.key]: "true", [FEATURE_FLAGS.BROKER_JOURNEY.key]: "true" };
    await renderPage();
    const lite = screen.getByTestId("lite");
    expect(lite.getAttribute("data-composition")).toBe("results");
    expect(lite.contains(screen.getByTestId("journey-card"))).toBe(true);
  });

  it("com a chave ligada e a Jornada desligada, mantém a composição sem o cartão", async () => {
    mocks.flags = { [FEATURE_FLAGS.BROKER_NAV_REORG.key]: "true" };
    await renderPage();
    expect(screen.getByTestId("lite").getAttribute("data-composition")).toBe("results");
    expect(screen.queryByTestId("journey-card")).toBeNull();
    expect(mocks.journeyData).not.toHaveBeenCalled();
  });

  it("com a chave desligada, fica como antes", async () => {
    mocks.flags = { [FEATURE_FLAGS.BROKER_NAV_REORG.key]: "false", [FEATURE_FLAGS.BROKER_JOURNEY.key]: "true" };
    await renderPage();
    expect(screen.getByTestId("lite").getAttribute("data-composition")).toBe("classic");
    expect(screen.queryByTestId("journey-card")).toBeNull();
  });

  it("sem o Desempenho Lite, segue o resumo do dia antigo", async () => {
    mocks.liteEnabled = false;
    mocks.flags = { [FEATURE_FLAGS.BROKER_NAV_REORG.key]: "true", [FEATURE_FLAGS.BROKER_JOURNEY.key]: "true" };
    await renderPage();
    expect(screen.queryByTestId("lite")).toBeNull();
    expect(screen.getByRole("heading", { name: "Seu dia" })).toBeTruthy();
    expect(screen.getByTestId("journey-card")).toBeTruthy();
  });
});
