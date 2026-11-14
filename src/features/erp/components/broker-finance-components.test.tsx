// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a> }));
vi.mock("./broker-finance-charts", () => ({ BrokerFinanceMonthChart: ({ label }: { label: string }) => <div role="img" aria-label={label} /> }));

import { monthSeries, type BrokerFinanceDetail, type BrokerFinanceInsights, type BrokerFinanceSummary } from "../broker-finance-core";
import { BrokerFinanceScreen } from "./broker-finance-screen";
import { BrokerFinanceSummaryCard } from "./broker-finance-summary-card";

const money = (text: string | null) => (text ?? "").replace(/\s/g, " ");
const summary: BrokerFinanceSummary = { period: "2026-11", periodLabel: "novembro de 2026", receivableCents: 150_000, receivedThisMonthCents: 42_500, openAdvancesCents: null };
const insights: BrokerFinanceInsights = {
  received: monthSeries("2026-06", 6, new Map([["2026-10", 50_000], ["2026-11", 42_500]])),
  forecast: monthSeries("2026-11", 6, new Map([["2026-12", 30_000]])),
  receivedTotalCents: 92_500,
  forecastTotalCents: 30_000,
  salesWithCommission: 3,
  nextInstallment: { referenceMonth: "2026-12", amountCents: 30_000, clientName: "Cliente Sintético B" },
};
const detail = (overrides: Partial<BrokerFinanceDetail> = {}): BrokerFinanceDetail => ({
  summary,
  insights,
  commissions: {
    page: 1, pageSize: 20, hasNext: true,
    rows: [
      { id: "c-1", clientName: "Cliente Sintético A", product: "Operadora Y · Plano X", installment: 1, referenceMonth: "2026-10", amountCents: 50_000, state: "paga", stateLabel: "Paga", source: "erp" },
      { id: "c-2", clientName: "Cliente Sintético B", product: null, installment: 2, referenceMonth: "2026-11", amountCents: 30_000, state: "prevista", stateLabel: "Prevista", source: "cronograma" },
    ],
  },
  payouts: [{ id: "p-1", competence: "2026-10", occurredOn: "2026-11-05", netCents: 50_000, receiptNumber: "R-0001", receiptHref: "/financeiro/recibos/p-1" }],
  receiptsHref: "/financeiro/recibos",
  ...overrides,
});

afterEach(cleanup);

describe("BrokerFinanceSummaryCard (atalho do Início)", () => {
  it("é uma faixa só com o valor a receber que leva ao Meu financeiro", () => {
    render(<BrokerFinanceSummaryCard summary={summary} />);
    const link = screen.getByRole("link", { name: /Meu financeiro/ });
    expect(link.getAttribute("href")).toBe("/meu-financeiro");
    expect(money(link.textContent)).toContain("R$ 1.500,00 a receber");
    expect(screen.queryByText("Recebido no mês")).toBeNull();
  });
  it("sem valor a receber conferido, convida a ver comissões e repasses", () => {
    render(<BrokerFinanceSummaryCard summary={{ ...summary, receivableCents: null }} />);
    expect(screen.getByRole("link", { name: /Meu financeiro/ }).textContent).toContain("Ver comissões e repasses");
  });
  it("sem resumo (sem acesso ou chave desligada) não desenha nada", () => {
    const { container } = render(<BrokerFinanceSummaryCard summary={null} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("BrokerFinanceScreen", () => {
  it("pronto: números com período, comissões com estado textual e repasse com recibo", () => {
    render(<BrokerFinanceScreen state={{ status: "ready", data: detail() }} />);
    expect(screen.getByRole("heading", { level: 1, name: "Meu financeiro" })).toBeTruthy();
    expect(screen.getByText("Pagamentos conferidos em novembro de 2026")).toBeTruthy();
    expect(screen.getByText("Sem dado")).toBeTruthy();
    const commissions = screen.getByRole("region", { name: "Comissões por venda" });
    expect(within(commissions).getByText("Paga")).toBeTruthy();
    expect(within(commissions).getByText("Prevista")).toBeTruthy();
    expect(within(commissions).getByText(/Operadora Y · Plano X · 1ª parcela/)).toBeTruthy();
    expect(within(commissions).getByRole("link", { name: "Próximas" }).getAttribute("href")).toBe("/meu-financeiro?pagina=2");
    const payouts = screen.getByRole("region", { name: "Repasses e recibos" });
    expect(within(payouts).getByText("Repasse de outubro de 2026")).toBeTruthy();
    expect(within(payouts).getByText(/Pago em 05\/11\/2026 · Recibo R-0001/)).toBeTruthy();
    expect(within(payouts).getByRole("link", { name: /Ver recibo/ }).getAttribute("href")).toBe("/financeiro/recibos/p-1");
  });
  it("mostra a evolução: recebido e previsto por mês e os indicadores", () => {
    render(<BrokerFinanceScreen state={{ status: "ready", data: detail() }} />);
    const evolution = screen.getByRole("region", { name: "Evolução" });
    expect(within(evolution).getByRole("img", { name: "Comissões recebidas por mês" })).toBeTruthy();
    expect(within(evolution).getByRole("img", { name: "Parcelas previstas por mês" })).toBeTruthy();
    expect(money(within(evolution).getByText("Vendas com comissão").nextElementSibling?.textContent ?? null)).toBe("3");
    expect(money(within(evolution).getByText("Próxima parcela").nextElementSibling?.textContent ?? null)).toBe("R$ 300,00");
    expect(within(evolution).getByText(/Cliente Sintético B · dez/i)).toBeTruthy();
  });
  it("sem os gráficos (falha ao carregar), o resto da tela continua", () => {
    render(<BrokerFinanceScreen state={{ status: "ready", data: detail({ insights: null }) }} />);
    expect(screen.queryByRole("region", { name: "Evolução" })).toBeNull();
    expect(screen.getByRole("region", { name: "Comissões por venda" })).toBeTruthy();
  });
  it("vazio: explica que nenhuma comissão foi registrada", () => {
    render(<BrokerFinanceScreen state={{ status: "ready", data: detail({ commissions: { page: 1, pageSize: 20, hasNext: false, rows: [] }, payouts: [], receiptsHref: null }) }} />);
    expect(screen.getByText("Nenhuma comissão registrada ainda")).toBeTruthy();
    expect(screen.getByText("Nenhum repasse conferido ainda")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Próximas" })).toBeNull();
  });
  it("repasse sem rota de recibo liberada não ganha link", () => {
    render(<BrokerFinanceScreen state={{ status: "ready", data: detail({ payouts: [{ id: "p-1", competence: "2026-10", occurredOn: "2026-11-05", netCents: 50_000, receiptNumber: "R-0001", receiptHref: null }], receiptsHref: null }) }} />);
    expect(screen.queryByRole("link", { name: /recibo/i })).toBeNull();
  });
  it("sem acesso: explica que a direção libera o financeiro", () => {
    render(<BrokerFinanceScreen state={{ status: "denied" }} />);
    expect(screen.getByText(/liberado pela direção/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar ao Início" }).getAttribute("href")).toBe("/dashboard");
  });
  it("erro: alerta com tentar de novo", () => {
    render(<BrokerFinanceScreen state={{ status: "error" }} />);
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível carregar seu financeiro");
    expect(screen.getByRole("link", { name: "Tentar novamente" }).getAttribute("href")).toBe("/meu-financeiro");
  });
});
