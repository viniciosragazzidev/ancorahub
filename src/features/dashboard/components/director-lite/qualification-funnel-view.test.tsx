// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const motionState = vi.hoisted(() => ({ reduce: false }));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  const { captureMotion } = await import("@/components/lite/motion/capture-motion");
  return { ...actual, motion: captureMotion(), useReducedMotion: () => motionState.reduce };
});

import type { QualificationFunnel } from "@/features/qualification-turbo/funnel";

import { QualificationFunnelView } from "./qualification-funnel-view";

const fixture: QualificationFunnel = {
  period: 7,
  since: "2026-10-17T00:00:00.000Z",
  stages: [
    { key: "arrived", label: "Chegaram", count: 1234 },
    { key: "sent", label: "1ª mensagem enviada", count: 1000 },
    { key: "delivered", label: "Entregue", count: 900 },
    { key: "read", label: "Lida", count: 800 },
    { key: "replied", label: "Respondeu", count: 500 },
    { key: "qualified", label: "Qualificado", count: 321 },
    { key: "assigned", label: "Com corretor", count: 250 },
    { key: "converted", label: "Venda", count: 25 },
  ],
  medianMinutesToReply: 45,
  now: [{ key: "qualifying", label: "Em qualificação", count: 86, hint: "Conversando com a assistente agora" }],
  lossReasons: [{ label: "Preço acima do esperado", count: 24 }],
  variants: [{ approach: "Saudação", variant: "a", label: "Olá, posso ajudar?", sent: 1000, replied: 500, qualified: 321, rate: 0.5, low: 0.47, high: 0.53 }],
  touches: [{ touch: "t0", label: "1ª mensagem", sent: 1000, repliesAfter: 300 }],
  cost: { total: 1234.5, marketing: 1000, utility: 234.5, templatesDelivered: 3000, perQualified: 3.84, source: "meta" },
};

afterEach(() => {
  cleanup();
  motionState.reduce = false;
  delete document.documentElement.dataset.reduceMotion;
});

describe("funil de qualificação Lite", () => {
  it("renderiza as métricas recebidas, números pt-BR e pluralização", () => {
    const { container } = render(<QualificationFunnelView data={fixture} unitName="Centro" />);
    expect(container.textContent).toContain("1.234");
    expect(container.textContent).toContain("Últimos 7 dias, Centro");
    expect(container.textContent).toContain("500 leads");
    expect(screen.getByRole("table", { name: "Resultados das variantes da primeira mensagem" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Situação atual dos leads do período" })).toBeInTheDocument();
  });

  it("mostra Hoje como período operacional, sem rótulo de sete dias", () => {
    const { container } = render(<QualificationFunnelView data={{ ...fixture, period: "today" }} unitName="Centro" />);
    expect(container.textContent).toContain("Hoje, Centro");
    expect(container.textContent).toContain("chegaram hoje, etapa por etapa");
    expect(container.textContent).not.toContain("Últimos today dias");
  });

  it("mostra vazio explícito quando a coorte não tem leads", () => {
    const empty: QualificationFunnel = {
      ...fixture,
      stages: fixture.stages.map((stage) => ({ ...stage, count: 0 })),
      medianMinutesToReply: null,
      now: [],
      lossReasons: [],
      variants: [],
      touches: [],
      cost: null,
    };
    render(<QualificationFunnelView data={empty} unitName={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum lead chegou neste período");
    expect(screen.getByText("Tente ampliar o período ou escolher outra unidade.")).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Resultados das variantes da primeira mensagem" })).not.toBeInTheDocument();
  });

  it("com movimento reduzido do site, mostra os valores finais sem odômetro", () => {
    document.documentElement.dataset.reduceMotion = "1";
    const { container } = render(<QualificationFunnelView data={fixture} unitName="Centro" />);
    expect(container.textContent).toContain("1.234");
    expect(container.querySelectorAll('span[style*="inline-flex"]').length).toBe(0);
  });
});
