import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  buildEssential: vi.fn(() => ({ firstName: "Renata" })),
  buildFunnel: vi.fn(() => ({ period: 30 })),
}));

vi.mock("@/features/dashboard/components/director-lite/director-lite-dashboard", () => ({ DirectorLiteDashboard: () => null }));
vi.mock("@/features/dashboard/components/director-lite/qualification-funnel-page", () => ({ DirectorLiteQualificationFunnelPage: () => null }));
vi.mock("../diretor-dashboard-preview/_components/essential-example", () => ({ buildEssential: state.buildEssential }));
vi.mock("../diretor-dashboard-preview/_components/data", () => ({ buildFunnel: state.buildFunnel }));
vi.mock("@/features/qualification-turbo/funnel", () => ({
  parseFunnelPeriod: (value: string | undefined) => value === "90" ? 90 : value === "30" ? 30 : 7,
}));

import { DirectorLiteDashboard } from "@/features/dashboard/components/director-lite/director-lite-dashboard";
import { DirectorLiteQualificationFunnelPage } from "@/features/dashboard/components/director-lite/qualification-funnel-page";

import DirectorDashboardRealPage from "./page";

beforeEach(() => {
  state.buildEssential.mockClear();
  state.buildFunnel.mockClear();
});

function findElement(element: unknown, type: unknown): { type: unknown; props: Record<string, unknown> } | null {
  if (!element || typeof element !== "object") return null;
  const candidate = element as { type?: unknown; props?: { children?: unknown } };
  if (candidate.type === type) return candidate as { type: unknown; props: Record<string, unknown> };
  const children = candidate.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findElement(child, type);
    if (found) return found;
  }
  return null;
}

describe("prévia do componente real do painel", () => {
  it("renderiza a aba Funil real com período e unidade de exemplo selecionados", async () => {
    const element = await DirectorDashboardRealPage({
      searchParams: Promise.resolve({ tab: "funnel", period: "30", unidade: "branch-barra" }),
    });
    const funnel = findElement(element, DirectorLiteQualificationFunnelPage);

    expect(state.buildFunnel).toHaveBeenCalledWith(30, "barra", expect.any(Date));
    expect(funnel?.props).toMatchObject({
      data: { period: 30 },
      branchId: "branch-barra",
      firstName: "Renata",
      branches: expect.arrayContaining([{ id: "branch-barra", name: "Barra da Tijuca" }]),
      now: expect.any(Date),
    });
  });

  it("mantém a aba Visão como padrão", async () => {
    const element = await DirectorDashboardRealPage({ searchParams: Promise.resolve({}) });
    const overview = findElement(element, DirectorLiteDashboard);

    expect(state.buildEssential).toHaveBeenCalledWith("today", "all", expect.any(Date));
    expect(overview).not.toBeNull();
  });
});
