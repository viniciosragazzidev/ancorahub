// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/goals/lite-goals-actions", () => ({ saveLiteGoalAction: vi.fn() }));
vi.mock("@/components/arc/action-button/action-button", () => ({ ActionButton: ({ label }: { label: string }) => <button type="button">{label}</button> }));
vi.mock("@/components/arc/input/input", () => ({ Input: ({ label, id }: { label: string; id: string }) => <label htmlFor={id}>{label}<input id={id} /></label> }));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({ default: () => null }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button> }));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({ BottomSheet: () => null }));

import { InsightsSection } from "./insights-section";
import { goalLine, GoalsSection } from "./goals-section";
import { brokersNeedPhrase, teamsNeedPhrase } from "./needs-you-phrase";
import type { TeamGoalsView } from "@/features/goals/lite-goals-queries";

afterEach(() => cleanup());

const view: TeamGoalsView = {
  period: "2026-10",
  team: { id: "g-team", scope: "team", scopeId: "sup-ana", name: "Vendas da equipe", targetType: "sales_count", targetValue: 29, period: "2026-10", current: 18, percentage: 62 },
  brokers: [
    { brokerId: "b-1", name: "Bruno", goal: { id: "g-b1", scope: "broker", scopeId: "b-1", name: "Cotações", targetType: "quotes_count", targetValue: 8, period: "2026-10", current: 6, percentage: 75 } },
    { brokerId: "b-2", name: "Carla", goal: null },
  ],
};

describe("frases de exceção do Início", () => {
  it("speaks in singular and plural, and says nobody needs you when there is no one", () => {
    expect(teamsNeedPhrase(0)).toBe("Todas as equipes em dia");
    expect(teamsNeedPhrase(2)).toBe("2 equipes precisam de atenção");
    expect(brokersNeedPhrase(0)).toBe("Ninguém precisa de você agora");
    expect(brokersNeedPhrase(1)).toBe("1 corretor precisa de você");
    expect(brokersNeedPhrase(3)).toBe("3 corretores precisam de você");
  });
});

describe("linha de meta", () => {
  it("reads 'current of target unit · percent' and says 'até' for response time", () => {
    expect(goalLine(view.brokers[0]!.goal!)).toBe("6 de 8 cotações · 75%");
    expect(goalLine({ ...view.brokers[0]!.goal!, targetType: "response_minutes", targetValue: 4, current: 8, percentage: 50 })).toBe("Agora 8 min · meta até 4 min · 50%");
  });
});

describe("seção Metas", () => {
  it("shows the team goal and each broker goal, with edit only where the viewer may", () => {
    render(<GoalsSection supervisorId="sup-ana" view={view} canEditTeam canEditBrokers={false} />);

    expect(screen.getByText("18 de 29 vendas · 62%")).toBeTruthy();
    expect(screen.getByText("6 de 8 cotações · 75%")).toBeTruthy();
    expect(screen.getByText("Sem meta neste mês")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Definir meta" })).toBeNull();
  });

  it("lets the supervisor define a goal for a broker without one", () => {
    render(<GoalsSection supervisorId="sup-ana" view={view} canEditTeam canEditBrokers />);

    expect(screen.getByRole("button", { name: "Definir meta" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Definir meta" }));
  });

  it("offers 'Definir meta da equipe' when the team has no goal this month", () => {
    render(<GoalsSection supervisorId="sup-ana" view={{ ...view, team: null }} canEditTeam canEditBrokers={false} />);

    expect(screen.getByRole("button", { name: "Definir meta da equipe" })).toBeTruthy();
  });
});

describe("destaques da equipe", () => {
  it("renders nothing without a highlight", () => {
    const { container } = render(<InsightsSection insights={[]} />);

    expect(container.textContent).toBe("");
  });

  it("renders up to the given highlights with a tone label", () => {
    render(<InsightsSection insights={[{ id: "x", subjectType: "broker", subjectId: "m", tone: "positive", message: "Maria reduziu o tempo de aceite em 32%.", weight: 32 }]} />);

    expect(screen.getByText("Maria reduziu o tempo de aceite em 32%.")).toBeTruthy();
    expect(screen.getByText("Bom sinal")).toBeTruthy();
  });
});
