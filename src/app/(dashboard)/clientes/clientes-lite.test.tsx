// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientesLite, type ClientLiteRow } from "./clientes-lite";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("period=30"),
  usePathname: () => "/clientes",
}));
vi.mock("@/components/dashboard/metric-card", () => ({ StatCard: ({ label, value }: { label: string; value: string | number }) => <div data-testid="stat">{label}: {value}</div> }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const client = (index: number, overrides: Partial<ClientLiteRow> = {}): ClientLiteRow => ({
  id: `c${index}`, name: `Cliente ${index}`, phone: `+55 11 9999-00${String(index).padStart(2, "0")}`, email: null,
  convertedAt: "2026-10-20T15:00:00.000Z", brokerName: "Ana Souza", branchName: "Centro", ...overrides,
});
const metrics = { totalClients: 12, conversionRate: "10.0", avgClientsPerBroker: 12, upcomingRenewals: 2, recentConversions: 12, totalBrokers: 1 };
const branches = [{ id: "b1", name: "Centro" }, { id: "b2", name: "Zona Norte" }];

describe("clientes Lite", () => {
  it("mostra os números, pagina de 10 em 10, busca e abre o perfil", () => {
    const clients = Array.from({ length: 12 }, (_, index) => client(index + 1));
    clients[11] = client(12, { name: "Nazareth Pereira", brokerName: null, branchName: null });
    render(<ClientesLite clients={clients} metrics={metrics} period={30} branches={branches} />);
    expect(screen.getAllByTestId("stat")[0]).toHaveTextContent("Total de clientes: 12");
    const table = () => document.querySelector('[data-lite="table"]') as HTMLElement;
    expect(within(table()).getAllByRole("row")).toHaveLength(11);
    fireEvent.click(screen.getAllByRole("button", { name: "Próxima página" })[0]!);
    expect(within(table()).getAllByRole("row")).toHaveLength(3);
    expect(within(table()).getByText("Sem responsável")).toBeInTheDocument();
    expect(within(table()).getAllByText("20/10/2026")).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar cliente" }), { target: { value: "nazareth" } });
    expect(within(table()).getAllByRole("row")).toHaveLength(2);
    expect(within(table()).getByRole("link", { name: "Ver perfil" })).toHaveAttribute("href", "/clientes/c12");
    fireEvent.click(within(table()).getAllByRole("row")[1]!);
    expect(push).toHaveBeenLastCalledWith("/clientes/c12");
  });

  it("unidade e período vão para a URL como os seletores atuais", () => {
    render(<ClientesLite clients={[client(1)]} metrics={metrics} period={30} branches={branches} />);
    fireEvent.click(screen.getByRole("button", { name: /^Unidade/ }));
    fireEvent.click(screen.getByRole("option", { name: "Zona Norte" }));
    expect(push).toHaveBeenCalledWith("/clientes?period=30&branch=b2", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: /^Período/ }));
    fireEvent.click(screen.getByRole("option", { name: "7 dias" }));
    expect(replace).toHaveBeenCalledWith("/clientes?period=7", { scroll: false });
  });

  it("sem unidades a escolher, esconde o seletor; sem clientes, mostra o vazio com atalho para leads", () => {
    render(<ClientesLite clients={[]} metrics={{ ...metrics, totalClients: 0 }} period={30} branches={[branches[0]!]} />);
    expect(screen.queryByRole("button", { name: /^Unidade/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Nenhum cliente convertido ainda" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ir para leads/ })).toHaveAttribute("href", "/leads");
  });
});
