// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/dashboard-header", () => ({ DashboardHeader: ({ title }: { title: string }) => <header>{title}</header> }));

import type { CommandCenterData } from "../today";
import { CommandCenter } from "./command-center";

const data: CommandCenterData = {
  today: {
    received: 42,
    distributed: 30,
    waiting: 5,
    withoutFirstContact: 3,
    queues: [
      { id: "q-pme", name: "FILA PME - RENAN", hue: 10, today: 25, waiting: 4 },
      { id: "q-pf", name: "FILA PF", hue: 200, today: 17, waiting: 0 },
    ],
  },
  welcome: {
    firstName: "Vinicios",
    nextDuty: null,
    runningDuties: [{ scheduleId: "s1", name: "PME 09/10", dutyDate: "2026-10-09", startsAt: "09:00", endsAt: "18:00", running: true, queueName: "FILA PME - RENAN", brokerCount: 4, minimumBrokers: 5 }],
    pulse: { activeQueues: 3, runningDuties: 1, brokersOnDutyNow: 4 },
  },
  attention: [],
  recentLeads: [],
  generatedAt: "2026-10-09T15:00:00.000Z",
};

afterEach(() => { cleanup(); push.mockClear(); });

describe("CommandCenter", () => {
  it("shows today's numbers and the leads of today per queue", () => {
    render(<CommandCenter data={data} />);
    expect(screen.getByText("Olá, Vinicios")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("FILA PME - RENAN").closest("a")?.getAttribute("href")).toBe("/leads?fila=q-pme");
    expect(screen.getByText("4 aguardando")).toBeTruthy();
    expect(screen.getByText("PME 09/10").closest("a")?.getAttribute("href")).toBe("/leads/distribuicao/plantao/s1");
  });

  it("turns the numbers that ask for work into actions and offers the shortcuts", () => {
    render(<CommandCenter data={data} />);
    expect(screen.getByRole("link", { name: /Aguardando corretor/ }).getAttribute("href")).toBe("/leads/distribuicao");
    expect(screen.getByRole("link", { name: /Plantão agora/ }).getAttribute("href")).toBe("/leads/distribuicao/plantao/s1");
    expect(screen.getByRole("link", { name: /Escala do mês/ }).getAttribute("href")).toBe("/leads/distribuicao?view=plantao&escalaMes=2026-10");
    expect(screen.getByRole("link", { name: /Novo lead/ }).getAttribute("href")).toBe("/leads?new=1");
  });

  it("hides management shortcuts from people who cannot manage", () => {
    render(<CommandCenter data={data} canManage={false} />);
    expect(screen.queryByRole("link", { name: /Escala do mês/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Convidar corretor/ })).toBeNull();
  });

  it("searches a lead from the dashboard", () => {
    render(<CommandCenter data={data} />);
    fireEvent.change(screen.getByLabelText("Buscar lead por nome ou telefone"), { target: { value: "Maria 2199" } });
    fireEvent.submit(screen.getByRole("search"));
    expect(push).toHaveBeenCalledWith("/leads?search=Maria%202199");
  });
});
