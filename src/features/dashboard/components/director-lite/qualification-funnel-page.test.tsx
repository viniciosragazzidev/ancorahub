// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: true }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("@/components/lite/motion/capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});

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

afterEach(() => cleanup());

describe("filtros da aba Funil Lite", () => {
  it("mantém o período e a unidade nas opções e expõe só as unidades recebidas do servidor", () => {
    render(<DirectorLiteQualificationFunnelPage data={data} branchId="branch-autorizada" branches={branches} />);
    expect(within(screen.getByRole("navigation", { name: "Abas do painel" })).getByRole("link", { name: "Visão da operação" })).toHaveAttribute("href", "/dashboard?periodo=30&unidade=branch-autorizada");
    const periods = within(screen.getByRole("navigation", { name: "Período" }));
    expect(periods.getByRole("link", { name: "30 dias" })).toHaveAttribute("aria-current", "true");
    expect(periods.getByRole("link", { name: "7 dias" })).toHaveAttribute("href", "/dashboard?tab=funnel&period=7&unidade=branch-autorizada");
    const units = within(screen.getByRole("navigation", { name: "Unidade" }));
    expect(units.getByRole("link", { name: "Centro" })).toHaveAttribute("aria-current", "true");
    expect(units.getByRole("link", { name: "Todas as unidades" })).toHaveAttribute("href", "/dashboard?tab=funnel&period=30");
    expect(units.queryByRole("link", { name: "Unidade de outro tenant" })).not.toBeInTheDocument();
  });

  it("limita o período de 90 dias ao maior período disponível ao voltar para a visão da operação", () => {
    render(<DirectorLiteQualificationFunnelPage data={{ ...data, period: 90 }} branchId={null} branches={[]} />);
    expect(within(screen.getByRole("navigation", { name: "Abas do painel" })).getByRole("link", { name: "Visão da operação" })).toHaveAttribute("href", "/dashboard?periodo=30");
  });

  it("oculta o filtro de unidade se o servidor não autorizou comparação", () => {
    render(<DirectorLiteQualificationFunnelPage data={data} branchId={null} branches={[]} />);
    expect(screen.queryByRole("navigation", { name: "Unidade" })).not.toBeInTheDocument();
  });
});
