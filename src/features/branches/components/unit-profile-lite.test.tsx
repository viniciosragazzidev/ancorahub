// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, replace, push: vi.fn() }), usePathname: () => "/unidades/b1", useSearchParams: () => new URLSearchParams() }));
const actions = vi.hoisted(() => ({ toggleBrokerAvailabilityAction: vi.fn(async () => ({ success: true })) }));
vi.mock("@/features/branches/actions", () => actions);
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { UnitProfileLite, type UnitProfileLiteData } from "./unit-profile-lite";
import { unitReportRange } from "./unit-reports-lite";

afterEach(cleanup);

const data: UnitProfileLiteData = {
  branch: { id: "b1", name: "Barra", status: "active", acceptingLeads: false, autoDistribute: true },
  metrics: { period: "outubro de 2026", totalLeads: 100, leadsConvertidos: 20, leadsPerdidos: 1, leadsAtivos: 50, leadsDistribuidos: 5, taxaConversao: 20, taxaPerda: 1, leadsTrend: [1, 2, 3, 4, 5, 6, 7] },
  members: [
    { userId: "u1", name: "Ana Souza", email: "ana@x.com", role: "broker", jobTitle: "broker", availabilityStatus: "available", membershipStatus: "active", activeLeads: 12 },
    { userId: "u2", name: "Marina", email: "marina@x.com", role: "manager", jobTitle: "manager", availabilityStatus: "available", membershipStatus: "active", activeLeads: 0 },
  ],
  topBrokers: [{ userId: "u1", name: "Ana Souza", totalLeads: 40, converted: 10, conversionRate: 25 }],
};

describe("UnitProfileLite", () => {
  it("mostra estado, números, ranking e os mesmos destinos", () => {
    render(<UnitProfileLite data={data} period={30} backHref="/equipe?visao=unidades" />);
    expect(screen.getByText("Pausada para leads")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar/ })).toHaveAttribute("href", "/equipe?visao=unidades");
    expect(screen.getByRole("link", { name: /Configurar distribuição/ })).toHaveAttribute("href", "/distribuicao?view=filas");
    expect(within(screen.getByRole("list", { name: "Ranking de corretores por conversão" })).getByText("25%")).toBeInTheDocument();
  });

  it("pausa o corretor pela mesma Server Action; gestor não tem o botão", async () => {
    render(<UnitProfileLite data={data} period={30} backHref="/equipe" />);
    const table = document.querySelector('[data-lite="table"]') as HTMLElement;
    expect(within(table).getAllByRole("button")).toHaveLength(1);
    await act(async () => { fireEvent.click(within(table).getByRole("button", { name: "Pausar recebimento de Ana Souza" })); });
    const formData = (actions.toggleBrokerAvailabilityAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(formData.get("brokerId")).toBe("u1");
    expect(refresh).toHaveBeenCalled();
  });

  it("período padrão do relatório usa o dia de Brasília", () => {
    // 01:30 UTC do dia 25 ainda é dia 24 em Brasília.
    expect(unitReportRange(30, new Date("2026-10-25T01:30:00.000Z"))).toEqual({ start: "2026-09-25", end: "2026-10-24" });
  });
});
