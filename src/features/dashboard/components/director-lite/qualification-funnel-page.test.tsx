// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: true, push: vi.fn() }));
vi.stubGlobal("matchMedia", (media: string) => ({
  matches: motionState.reduce,
  media,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("@/components/lite/motion/capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: motionState.push }) }));

import type { QualificationFunnel } from "@/features/qualification-turbo/funnel";

import { DirectorLiteQualificationFunnelPage } from "./qualification-funnel-page";

const data: QualificationFunnel = {
  period: 30,
  since: "2026-09-24T00:00:00.000Z",
  stages: [{ key: "arrived", label: "Chegaram", count: 0 }],
  medianMinutesToReply: null,
  now: [],
  lossReasons: [],
  variants: [],
  touches: [],
  cost: null,
};
const branches = [{ id: "branch-autorizada", name: "Centro" }];
const now = new Date("2026-10-24T12:00:00.000Z");

afterEach(() => cleanup());

describe("filtros da aba Funil Lite", () => {
  it("mantém o período e a unidade nas opções e expõe só as unidades recebidas do servidor", () => {
    render(<DirectorLiteQualificationFunnelPage data={data} branchId="branch-autorizada" branches={branches} firstName="Renata" now={now} />);
    expect(screen.getByRole("heading", { level: 1, name: "Olá, Renata" })).toBeInTheDocument();
    const tabs = within(screen.getByRole("navigation", { name: "Abas do painel" }));
    expect(tabs.getByRole("link", { name: "Visão da operação" })).toHaveAttribute("href", "/dashboard?periodo=30&unidade=branch-autorizada");
    expect(tabs.getByRole("link", { name: "Qualidade dos leads" })).toHaveAttribute("href", "/dashboard?tab=quality&periodo=30&unidade=branch-autorizada");
    const periods = within(screen.getByRole("navigation", { name: "Período" }));
    expect(periods.getByRole("link", { name: "30 dias" })).toHaveAttribute("aria-current", "true");
    expect(periods.getByRole("link", { name: "7 dias" })).toHaveAttribute("href", "/dashboard?tab=funnel&period=7&unidade=branch-autorizada");
    const unit = screen.getByRole("combobox", { name: "Unidade" }) as HTMLSelectElement;
    expect(unit.value).toBe("branch-autorizada");
    expect(within(unit).getByRole("option", { name: "Centro" })).toBeInTheDocument();
    expect(within(unit).queryByRole("option", { name: "Unidade de outro tenant" })).not.toBeInTheDocument();
    fireEvent.change(unit, { target: { value: "" } });
    expect(motionState.push).toHaveBeenCalledWith("/dashboard?tab=funnel&period=30");
  });

  it("limita o período de 90 dias ao maior período disponível ao voltar para a visão da operação", () => {
    render(<DirectorLiteQualificationFunnelPage data={{ ...data, period: 90 }} branchId={null} branches={[]} firstName="Renata" now={now} />);
    expect(within(screen.getByRole("navigation", { name: "Abas do painel" })).getByRole("link", { name: "Visão da operação" })).toHaveAttribute("href", "/dashboard?periodo=30");
  });

  it("oculta o filtro de unidade se o servidor não autorizou comparação", () => {
    render(<DirectorLiteQualificationFunnelPage data={data} branchId={null} branches={[]} firstName="Renata" now={now} />);
    expect(screen.queryByRole("combobox", { name: "Unidade" })).not.toBeInTheDocument();
  });
});
