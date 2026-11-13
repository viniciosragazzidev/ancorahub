// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/relatorios/producao",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/ui/ds-bar-chart", () => ({ DsBarChart: () => <div data-testid="chart" /> }));
vi.mock("@/components/arc/segmented-control/segmented-control", () => ({
  default: ({ options, value, label }: { options: { value: string; label: string }[]; value: string; label: string }) => <div role="radiogroup" aria-label={label}>
    {options.map((option) => <button key={option.value} type="button" role="radio" aria-checked={option.value === value}>{option.label}</button>)}
  </div>,
}));

import { ErpSkinProvider } from "../ui/skin-context";
import type { ErpSkin } from "../ui/skin";
import { AnalyticsSettings, CarrierView, GoalsView, ProductionView } from "./analytics-views";

afterEach(cleanup);

const metric = { id: "production_count", version: 1, label: "Vendas", unit: "count", fact: "Vendas (sales)", dateBasis: "Data da venda", description: "Cada venda conta uma vez." } as const;
const generatedAt = "2026-11-12T15:00:00.000Z";
const production = {
  from: "2026-10", to: "2026-11", unit: "", units: [{ id: "u1", name: "Centro" }], visibility: { values: false, cash: false }, generatedAt,
  rows: [
    { month: "2026-10", partial: false, count: 3, cancelled: 1, cents: null, implanted: 2, cash: null },
    { month: "2026-11", partial: true, count: 5, cancelled: 0, cents: null, implanted: 0, cash: null },
  ],
  totals: { count: 8, cancelled: 1, implanted: 2, cents: null, cash: null }, drillHref: null, metrics: [metric],
} as unknown as Parameters<typeof ProductionView>[0]["report"];
const carriers = {
  from: "2026-09", to: "2026-11", unit: "", units: [], visibility: { values: true, cash: false }, generatedAt,
  rows: [
    { carrierId: "c1", name: "Operadora Sintética", count: 2, cancelled: 0, share: 6667, cents: 30000, valueShare: 7500 },
    { carrierId: null, name: "Não informada", count: 1, cancelled: 1, share: 3333, cents: 10000, valueShare: 2500 },
  ],
  totals: { count: 3, cancelled: 1, cents: 40000 }, metrics: [metric],
} as unknown as Parameters<typeof CarrierView>[0]["report"];
const goals = {
  rows: [{
    id: "g1", name: "Meta empresa", scopeLabel: "Empresa", owner: null, targetType: "sales_count", period: "2026-11",
    startDate: "2026-11-01T03:00:00.000Z", endDate: "2026-12-01T02:59:59.000Z", status: "Vigente", hideMoney: false,
    target: { kind: "count", value: "10" }, current: { kind: "count", value: "4" }, percentage: "40", calculatedAt: generatedAt,
  }],
  visibility: { values: true, cash: false }, generatedAt, manageHref: "/gestao",
} as unknown as Parameters<typeof GoalsView>[0]["goals"];

const skins: ErpSkin[] = ["standard", "lite"];

describe.each(skins)("analytics screens (%s skin)", (skin) => {
  const mount = (node: React.ReactNode) => render(<ErpSkinProvider skin={skin}>{node}</ErpSkinProvider>);

  it("production: perspectives as a segmented control, KPI row, month list and hidden values", () => {
    mount(<ProductionView report={production} />);
    const perspectives = screen.getByLabelText("Perspectivas de inteligência");
    expect(within(perspectives).getByText("Produção")).toBeInTheDocument();
    expect(within(perspectives).getByText("Análise diária")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Perspectivas de inteligência" })).toBeNull();
    expect(screen.getAllByText("Sem acesso a valores").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Outubro de 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mês em andamento").length).toBeGreaterThan(0);
    expect(screen.queryByText("Valor vendido", { selector: "th, th *" })).toBeNull();
    expect(screen.queryByText("Memória de cálculo")).toBeNull();
  });

  it("carriers: one row per carrier, values when allowed", () => {
    mount(<CarrierView report={carriers} />);
    expect(screen.getAllByText("Operadora Sintética").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Não informada").length).toBeGreaterThan(0);
    expect(screen.getAllByText("66,7%").length).toBeGreaterThan(0);
  });

  it("goals: list rows with progress and the row opens the drawer", async () => {
    mount(<GoalsView goals={goals} />);
    expect(screen.getAllByText("Meta empresa").length).toBeGreaterThan(0);
    expect(screen.getAllByText("40%").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Nova|Criar/ })).toBeNull();
    fireEvent.click(screen.getAllByText("Meta empresa")[0]);
    expect(await screen.findByText("Progresso calculado em")).toBeInTheDocument();
  });

  it("calculation memory opens from the options menu into the drawer", async () => {
    mount(<AnalyticsSettings metrics={[metric]} generatedAt={generatedAt} links={[{ id: "vendas", label: "Abrir lista de vendas", href: "/vendas" }]} perspective="producao" />);
    fireEvent.click(screen.getByRole("button", { name: /Opções/ }));
    fireEvent.click(await screen.findByText("Memória de cálculo"));
    expect(await screen.findByText(/Cada venda conta uma vez/)).toBeInTheDocument();
    expect(screen.getByText(/production_count v1/)).toBeInTheDocument();
  });
});
