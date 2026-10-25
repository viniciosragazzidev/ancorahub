// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";

import { NegotiationsRadarTab } from "./negotiations-radar-tab";
import { RADAR_FIXTURES } from "./radar-fixtures";

const actions = vi.hoisted(() => ({ triggerManualConversationAnalysisAction: vi.fn(async () => ({ success: true })) }));
vi.mock("../actions", () => actions);
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("@/components/ui/sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ usePathname: () => "/leads", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderLite() {
  return render(
    <ArcScopeProvider enabled>
      <NegotiationsRadarTab
        leads={RADAR_FIXTURES}
        branches={[{ id: "branch-centro", name: "Centro" }]}
        brokers={[{ id: "b1", name: "Ana Souza", branchId: "branch-centro" }]}
        contextRole="director"
      />
    </ArcScopeProvider>,
  );
}

describe("Radar IA Lite", () => {
  it("usa o visual Lite com a chave, sem caixa alta, e os contadores filtram", () => {
    const { container } = renderLite();
    expect(container.querySelector('[data-skin="diretor"]')).not.toBeNull();
    expect(container.innerHTML).not.toContain("uppercase");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    const kpis = within(screen.getByRole("group", { name: "Filtrar o radar" }));
    fireEvent.click(kpis.getByRole("button", { name: /Risco de perda/ }));
    expect(kpis.getByRole("button", { name: /Risco de perda/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Alerta de risco para a supervisão")).toBeInTheDocument();
    fireEvent.click(kpis.getByRole("button", { name: /Pendente no corretor/ }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("busca por diagnóstico e mostra o vazio", () => {
    renderLite();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar no radar" }), { target: { value: "obstetrícia" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar no radar" }), { target: { value: "zzz" } });
    expect(screen.getByText("Nenhuma negociação encontrada")).toBeInTheDocument();
  });

  it("reanalisa com a mesma ação e copia o script sugerido", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => undefined) } });
    renderLite();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reanalisar conversa de Justiniano Albuquerque de Souza com IA" }));
    });
    expect(actions.triggerManualConversationAnalysisAction).toHaveBeenCalledWith("r1");
    expect(toast.success).toHaveBeenCalledWith("Diagnóstico da IA atualizado com sucesso!");
    fireEvent.click(screen.getAllByRole("button", { name: /Copiar script/ })[0]!);
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(screen.getByText("Copiado")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Ver ficha/ })[0]).toHaveAttribute("href", "/leads/r1");
  });
});
