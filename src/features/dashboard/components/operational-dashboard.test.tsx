// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/dashboard-header", () => ({
  DashboardHeader: ({ title, rightSlot }: { title: string; rightSlot?: React.ReactNode }) => <header><span>{title}</span>{rightSlot}</header>,
}));
vi.mock("@/components/period-select", () => ({ PeriodSelect: () => <select aria-label="Período do dashboard" /> }));
vi.mock("@/components/ui/ds-bar-chart", () => ({ DsBarChart: () => <div data-testid="flow-chart" /> }));

import type { DashboardViewData } from "../service";
import { OperationalDashboard } from "./operational-dashboard";

const model: DashboardViewData = {
  header: { title: "Visão da operação", description: "Atenção agora na operação" },
  metrics: [
    { id: "leads-received", label: "Leads recebidos", value: 612, description: "Últimos 30 dias" },
    { id: "conversion", label: "Conversão", value: "11,4%", description: "No período" },
    { id: "attention", label: "Precisam de atenção", value: 7, description: "Exceções operacionais", tone: "warning" },
    { id: "sales", label: "Vendas", value: 23, description: "No período" },
  ],
  attention: [
    { id: "late", title: "Aceite atrasado", description: "2 passaram do SLA", count: 6, href: "/leads/distribuicao", tone: "danger" },
    { id: "orphan", title: "Sem corretor", description: "Aguardando fila", count: 1, href: "/leads?broker=none", tone: "warning" },
  ],
  primary: { id: "unit-health", title: "Saúde das unidades" },
  trend: [{ date: "2026-09-25", received: 20, converted: 2 }, { date: "2026-09-26", received: 22, converted: 3 }],
  units: [{ id: "u1", name: "Matriz", received: 40, converted: 5 }],
  brokers: [{ id: "b1", name: "Marina Freitas", received: 20, converted: 3, rate: 15 }],
  funnel: { received: 42, lost: 4, stages: [{ stage: "new", reached: 42 }, { stage: "in_contact", reached: 30 }, { stage: "converted", reached: 5 }] },
  recentLeads: [{ id: "l1", name: "Sara Khan", status: "in_contact", branchName: "Matriz", createdAt: "2026-09-26T13:12:00.000Z" }],
  welcome: {
    firstName: "Vinicios",
    nextDuty: { scheduleId: "s1", name: "Plantão PF", dutyDate: "2026-09-28", startsAt: "09:00", endsAt: "18:00", running: false, queueName: "Fila PF", brokerCount: 0, minimumBrokers: 1 },
    pulse: { activeQueues: 4, runningDuties: 0, brokersOnDutyNow: 0 },
  },
  generatedAt: "2026-09-26T13:16:00.000Z",
};

afterEach(() => cleanup());

describe("OperationalDashboard", () => {
  it("opens with the welcome band: greeting, next plantão and actions", () => {
    render(<OperationalDashboard model={model} period={30} />);
    expect(screen.getByRole("heading", { level: 1, name: "Olá, Vinicios" })).toBeTruthy();
    expect(screen.getByText(/sábado, 26 de setembro/i)).toBeTruthy();
    expect(screen.getByText("Seg 28/09, 09:00–18:00")).toBeTruthy();
    expect(screen.getByText("sem corretor")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Novo lead/ }).getAttribute("href")).toBe("/leads?new=1");
    expect(screen.getByRole("link", { name: /Nenhum plantão agora · 4 filas ativas/ })).toBeTruthy();
    expect(screen.getByText(/7 pendências pedem atenção agora/)).toBeTruthy();
  });

  it("lays out numbers, work, exceptions, funnel, rankings and shortcuts", () => {
    render(<OperationalDashboard model={model} period={30} />);
    expect(screen.getByRole("link", { name: /Leads recebidos\s*612/ }).getAttribute("href")).toBe("/leads");
    const recent = screen.getByText("Leads recentes").closest("[data-slot=card]") as HTMLElement;
    expect(within(recent).getByText("Sara Khan")).toBeTruthy();
    expect(within(recent).getByText("há 4 min")).toBeTruthy();
    expect(within(recent).getByText("Em atendimento")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Aceite atrasado\s*6/ }).getAttribute("href")).toBe("/leads/distribuicao");
    expect(screen.getByTestId("flow-chart")).toBeTruthy();
    const funnel = screen.getByText("Funil").closest("[data-slot=card]") as HTMLElement;
    expect(within(funnel).getByText("Perdido")).toBeTruthy();
    expect(screen.getByText("Marina Freitas")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Minha fila/ }).getAttribute("href")).toBe("/minha-fila");
  });
});
