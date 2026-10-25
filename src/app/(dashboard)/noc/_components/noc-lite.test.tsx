// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }), usePathname: () => "/noc", useSearchParams: () => new URLSearchParams() }));

import { NOC_FIXTURE, NOC_NOW } from "./noc-fixtures";
import { NocLite, formatSeconds, relativeTime } from "./noc-lite";

afterEach(cleanup);

describe("NocLite", () => {
  it("anomalias com resolver e ignorar, mapa e tabela de unidades com os mesmos destinos", () => {
    render(<NocLite data={NOC_FIXTURE} period={30} now={NOC_NOW} />);
    const alerts = within(screen.getByRole("region", { name: "Anomalias na operação" }));
    expect(alerts.getByText("Anomalia na operação: Niterói 1")).toBeInTheDocument();
    expect(alerts.getAllByRole("link", { name: /Resolver fila/ })[0]).toHaveAttribute("href", "/leads/distribuicao");
    fireEvent.click(alerts.getAllByRole("button", { name: "Ignorar" })[0]!);
    expect(screen.queryByText("Anomalia na operação: Barra da Tijuca")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Detalhes da unidade Centro" })).toHaveAttribute("href", "/unidades/br-centro");
    expect(screen.getAllByRole("link", { name: "Ver leads da unidade Centro" })[0]).toHaveAttribute("href", "/leads?branch=br-centro");
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar unidade no NOC" }), { target: { value: "niter" } });
    const table = document.querySelector('[data-lite="table"]') as HTMLElement;
    expect(table.querySelectorAll("tbody tr")).toHaveLength(1);
    fireEvent.click(within(table).getByText("Recebimento pausado"));
    expect(push).toHaveBeenCalledWith("/leads?branch=br-niteroi");
  });

  it("período na URL como o seletor atual (replace, 30 some) e atalho do próximo lead", () => {
    render(<NocLite data={NOC_FIXTURE} period={30} now={NOC_NOW} urgentLead={{ id: "l9", nome: "Ana", reason: "Alta intenção" }} />);
    expect(screen.getByRole("link", { name: "Próximo lead: Ana" })).toHaveAttribute("href", "/leads/l9");
    fireEvent.click(screen.getByRole("button", { name: /^Período/ }));
    fireEvent.click(screen.getByRole("option", { name: "7 dias" }));
    expect(replace).toHaveBeenCalledWith("/noc?period=7", { scroll: false });
  });

  it("textos sem travessão: tempo sem dado e tempo relativo contra o servidor", () => {
    expect(formatSeconds(null)).toBe("Sem dado");
    expect(formatSeconds(312)).toBe("5min 12s");
    expect(relativeTime("2026-10-25T01:20:00.000Z", NOC_NOW)).toBe("há 10 min");
    render(<NocLite data={NOC_FIXTURE} period={30} now={NOC_NOW} />);
    expect(document.body.textContent).not.toContain("—");
  });
});
