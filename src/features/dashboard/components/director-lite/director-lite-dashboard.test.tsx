// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("@/components/lite/motion/capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// Fixtures: os construtores de exemplo da prévia devolvem `CommandCenterData` tipado.
import { buildCommandCenter, emptyCommandCenter } from "@/app/dev/diretor-dashboard-preview/_components/data";

import { displacementOf, readMotion } from "@/components/lite/motion/capture-motion";

import { DirectorLiteDashboard } from "./director-lite-dashboard";

const NOW = new Date("2026-10-24T16:42:00.000Z");
const BRANCHES = [
  { id: "branch-centro", name: "Centro" },
  { id: "branch-barra", name: "Barra da Tijuca" },
];

afterEach(() => {
  cleanup();
  motionState.reduce = false;
});

describe("DirectorLiteDashboard", () => {
  it("shows the operation section with the real numbers of the turn", () => {
    const data = buildCommandCenter("today", "all", NOW);
    render(<DirectorLiteDashboard data={data} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.getByRole("heading", { name: "Turno de hoje, desde ontem às 19h" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver leads/ })).toBeInTheDocument();
  });

  it("marks the active period and links the others with their query", () => {
    const data = buildCommandCenter("today", "all", NOW);
    render(<DirectorLiteDashboard data={data} period="7d" branchId="branch-centro" branches={BRANCHES} now={NOW} />);
    const periods = within(screen.getByRole("navigation", { name: "Período" }));
    expect(periods.getByRole("link", { name: "7 dias" })).toHaveAttribute("aria-current", "true");
    expect(periods.getByRole("link", { name: "Hoje" })).toHaveAttribute("href", "/dashboard?periodo=hoje&unidade=branch-centro");
    expect(periods.getByRole("link", { name: "30 dias" })).toHaveAttribute("href", "/dashboard?periodo=30&unidade=branch-centro");
  });

  it("offers all units and marks the chosen one", () => {
    const data = buildCommandCenter("today", "all", NOW);
    render(<DirectorLiteDashboard data={data} period="today" branchId="branch-barra" branches={BRANCHES} now={NOW} />);
    const units = within(screen.getByRole("navigation", { name: "Unidade" }));
    expect(units.getByRole("link", { name: "Todas as unidades" })).not.toHaveAttribute("aria-current");
    expect(units.getByRole("link", { name: "Barra da Tijuca" })).toHaveAttribute("aria-current", "true");
    expect(units.getByRole("link", { name: "Centro" })).toHaveAttribute("href", "/dashboard?periodo=hoje&unidade=branch-centro");
  });

  it("shows the empty states of an empty company", () => {
    const data = emptyCommandCenter(NOW);
    render(<DirectorLiteDashboard data={data} period="today" branchId={null} branches={[]} now={NOW} />);
    expect(screen.getByText("Nada pendente")).toBeInTheDocument();
    expect(screen.getByText("Nenhum lead no período")).toBeInTheDocument();
  });

  it("moves nothing with reduced motion: no y, x or scale at rest in any animated block", () => {
    motionState.reduce = true;
    const data = buildCommandCenter(7, "all", NOW);
    const { container } = render(<DirectorLiteDashboard data={data} period="30d" branchId={null} branches={BRANCHES} now={NOW} />);
    const animated = Array.from(container.querySelectorAll("[data-initial]"));
    expect(animated.length).toBeGreaterThan(0);
    for (const element of animated) {
      expect(displacementOf(readMotion(element).initial)).toEqual([]);
    }
  });

  it("moves blocks in with motion on, so the reduced test really checks something", () => {
    motionState.reduce = false;
    const data = buildCommandCenter(7, "all", NOW);
    const { container } = render(<DirectorLiteDashboard data={data} period="30d" branchId={null} branches={BRANCHES} now={NOW} />);
    const moving = Array.from(container.querySelectorAll("[data-initial]")).filter((element) => displacementOf(readMotion(element).initial).length > 0);
    expect(moving.length).toBeGreaterThan(0);
  });
});

describe("painel do diretor: cabeçalho, abas e lead novo", () => {
  it("mostra a saudação, a data e as três abas", () => {
    const data = buildCommandCenter("today", "all", NOW);
    render(<DirectorLiteDashboard data={data} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.getByRole("heading", { name: "Olá" })).toBeInTheDocument();
    const tabs = within(screen.getByRole("navigation", { name: "Abas do painel" }));
    expect(tabs.getByRole("link", { name: "Visão da operação" })).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("link", { name: "Qualidade dos leads" })).toHaveAttribute("href", "/dashboard?tab=quality");
    expect(tabs.getByRole("link", { name: "Funil de qualificação" })).toHaveAttribute("href", "/dashboard?tab=funnel");
  });

  it("anuncia e destaca só o lead que chegou numa atualização nova", () => {
    const first = buildCommandCenter("today", "all", NOW);
    const { rerender } = render(<DirectorLiteDashboard data={first} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    const second = { ...first, recentLeads: [{ id: "lead-novo", name: "Maria Nova", status: "new", branchName: "Centro", createdAt: NOW.toISOString() }, ...first.recentLeads] };
    rerender(<DirectorLiteDashboard data={second} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.getByText("Novo lead: Maria Nova")).toBeInTheDocument();
    expect(screen.getByText("Novo lead: Maria Nova").closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("não anuncia nada na primeira carga nem quando a lista não muda", () => {
    const data = buildCommandCenter("today", "all", NOW);
    const { rerender } = render(<DirectorLiteDashboard data={data} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    rerender(<DirectorLiteDashboard data={{ ...data }} period="today" branchId={null} branches={BRANCHES} now={NOW} />);
    expect(screen.queryByText(/Novo lead:/)).not.toBeInTheDocument();
  });
});
