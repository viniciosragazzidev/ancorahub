// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SalesWorkspaceLite, type SaleLiteRow } from "./sales-workspace-lite";
import { SaleDetailLite } from "./[id]/sale-detail-lite";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams("period=30"),
  usePathname: () => "/vendas",
}));
const actions = vi.hoisted(() => ({
  bulkExportSalesAction: vi.fn(async () => ({ csvData: "id\n1", count: 2 })),
  markCommissionPaidAction: vi.fn(async () => ({ success: true })),
  markCommissionUnpaidAction: vi.fn(async () => ({})),
}));
vi.mock("@/features/sales/actions", () => actions);
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/dashboard/metric-card", () => ({ StatCard: ({ label, value }: { label: string; value: string | number }) => <div data-testid="stat">{label}: {value}</div> }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const sale = (id: string, leadName: string, status: string, saleValue: number): SaleLiteRow => ({
  id, leadId: `lead-${id}`, leadName, clientName: null, brokerId: "b1", brokerName: "Ana Souza", branchName: "Centro",
  planName: "Amil 400", carrierName: "Amil", saleDate: "2026-10-20T12:00:00.000Z", saleValue, status, createdAt: "2026-10-20T12:00:00.000Z",
});
const SALES = [sale("s1", "Justiniano Albuquerque de Souza", "active", 1200), sale("s2", "Cristiane Farizele", "cancelled", 800), sale("s3", "Nazareth Pereira", "active", 950)];

describe("vendas Lite", () => {
  it("mostra os números, filtra por status e busca, e leva aos detalhes", () => {
    render(<SalesWorkspaceLite sales={SALES} totalRevenue={2950} currentRole="director" period={30} branches={[{ id: "b1", name: "Centro" }, { id: "b2", name: "Barra" }]} />);
    expect(screen.getAllByTestId("stat")[0]).toHaveTextContent("Total de vendas: 3");
    const table = () => document.querySelector('[data-lite="table"]') as HTMLElement;
    expect(within(table()).getAllByRole("row")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: /^Status/ }));
    fireEvent.click(screen.getByRole("option", { name: "Canceladas" }));
    expect(within(table()).getAllByRole("row")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /^Status/ }));
    fireEvent.click(screen.getByRole("option", { name: "Todas as vendas" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar vendas" }), { target: { value: "nazareth" } });
    expect(within(table()).getAllByRole("row")).toHaveLength(2);
    expect(within(table()).getByRole("link", { name: "Ver detalhes da venda de Nazareth Pereira" })).toHaveAttribute("href", "/vendas/s3");
  });

  it("unidade e período vão para a URL como os seletores atuais", () => {
    render(<SalesWorkspaceLite sales={SALES} totalRevenue={2950} currentRole="director" period={30} branches={[{ id: "b1", name: "Centro" }, { id: "b2", name: "Barra" }]} />);
    fireEvent.click(screen.getByRole("button", { name: /^Unidade/ }));
    fireEvent.click(screen.getByRole("option", { name: "Barra" }));
    expect(push).toHaveBeenCalledWith("/vendas?period=30&branch=b2", { scroll: false });
    fireEvent.click(screen.getByRole("button", { name: /^Período/ }));
    fireEvent.click(screen.getByRole("option", { name: "7 dias" }));
    expect(replace).toHaveBeenCalledWith("/vendas?period=7", { scroll: false });
  });

  it("exporta as vendas selecionadas pela mesma Server Action", async () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    render(<SalesWorkspaceLite sales={SALES} totalRevenue={2950} currentRole="director" period={30} branches={[]} />);
    const table = document.querySelector('[data-lite="table"]') as HTMLElement;
    fireEvent.click(within(table).getByRole("checkbox", { name: "Selecionar venda Cristiane Farizele" }));
    const bar = within(screen.getByRole("region", { name: "Ações em lote" }));
    await act(async () => {
      fireEvent.click(bar.getByRole("button", { name: "Exportar CSV" }));
    });
    const formData = (actions.bulkExportSalesAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(formData.getAll("saleId")).toEqual(["s2"]);
  });

  it("detalhe: cronograma com marcar paga e reverter só para quem gerencia", () => {
    const item = (id: string, monthNumber: number, status: "pending" | "paid") => ({ id, saleId: "s1", monthNumber, referenceMonth: `2026-${10 + monthNumber}`, dueDate: null, percentage: "50", amount: "600", status, paidAt: status === "paid" ? "2026-10-21T12:00:00.000Z" : null, paidBy: null, paidByName: status === "paid" ? "Marina Exemplo" : null, notes: null });
    const detail = { id: "s1", leadId: "lead-s1", leadName: "Justiniano Albuquerque de Souza", clientName: "Justiniano", brokerName: "Ana Souza", branchName: "Centro", planName: "Amil 400", carrierName: "Amil", ruleName: null, status: "active", saleDate: "2026-10-20T12:00:00.000Z", saleValue: 1200, notes: "Cliente pediu boleto." };
    const { rerender } = render(<SaleDetailLite sale={detail} schedule={[item("p1", 1, "paid"), item("p2", 2, "pending")]} canManage />);
    expect(screen.getByRole("heading", { level: 2, name: "Justiniano Albuquerque de Souza" })).toBeInTheDocument();
    const table = document.querySelector('[data-lite="table"]') as HTMLElement;
    expect(within(table).getByRole("button", { name: "Marcar paga" })).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Reverter" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Repasse concluído" })).toHaveAttribute("aria-valuenow", "50");
    rerender(<SaleDetailLite sale={detail} schedule={[item("p1", 1, "paid")]} canManage={false} />);
    expect(screen.queryByRole("button", { name: "Reverter" })).not.toBeInTheDocument();
  });
});
