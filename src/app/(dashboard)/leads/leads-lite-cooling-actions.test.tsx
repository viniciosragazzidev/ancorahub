// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LeadWorkspaceItem } from "@/features/leads/components/lead-workspace-types";

const actions = vi.hoisted(() => ({
  assumeCoolingLeadAction: vi.fn(async () => ({ ok: true, message: "O lead agora é seu.", corretorId: "g1" })),
  nudgeCoolingBrokerAction: vi.fn(async (): Promise<Record<string, unknown>> => ({ ok: true, message: "Tarefa criada para Ana Souza." })),
  listCoolingRedistributeOptionsAction: vi.fn(async () => ({ ok: true, onDuty: false, brokers: [{ id: "c2", name: "Bruno Lima" }] })),
  redistributeCoolingLeadAction: vi.fn(async () => ({ ok: true, message: "ok", corretorId: "c2", corretorNome: "Bruno Lima" })),
}));
vi.mock("@/features/leads/cooling-lead-actions", () => actions);

import { LeadsLiteCooling } from "./leads-lite-cooling";
import { CoolingActionPanel, CoolingDrawerActions } from "./leads-lite-cooling-actions";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const now = new Date("2026-11-25T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const lead: LeadWorkspaceItem = {
  id: "a", nome: "Maria Parada", status: "quote_sent", telefone: "21 90000-0000", qualificationStatus: "hot", origem: "manual", sourceCampaign: null, tipo: "PF",
  createdAt: daysAgo(30), assignedAt: null, stageEnteredAt: null, serviceStartedAt: null, firstContactAt: null, lastContactAt: daysAgo(4),
  corretorId: "c1", corretorNome: "Ana Souza", branchId: "b1", branchName: "Centro",
};

describe("ações do radar Esfriando", () => {
  it("corretor não vê o ⋯ nem a coluna de ações", () => {
    render(<LeadsLiteCooling leads={[lead]} onOpen={vi.fn()} now={now} actor={{ role: "broker", userId: "c1" }} onAction={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Ações do lead Maria Parada" })).toBeNull();
  });

  it("gestor vê Assumir, Cobrar corretor e Redistribuir à vista na linha (artifact 27/11/2026)", () => {
    const onAction = vi.fn();
    const onOpen = vi.fn();
    render(<LeadsLiteCooling leads={[lead]} onOpen={onOpen} now={now} actor={{ role: "manager", userId: "g1" }} onAction={onAction} />);
    const row = screen.getAllByRole("row")[1]!;
    expect(within(row).getAllByRole("button").slice(1).map((item) => item.textContent)).toEqual(["Assumir", "Cobrar corretor", "Redistribuir"]);
    fireEvent.click(within(row).getByRole("button", { name: "Cobrar corretor: Maria Parada" }));
    expect(onAction).toHaveBeenCalledWith(lead, "nudge", expect.any(Number));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("cobrar só confirma depois do servidor e avisa o workspace", async () => {
    const onCommitted = vi.fn();
    render(<CoolingActionPanel target={{ lead, action: "nudge", idleMs: 4 * 86_400_000 }} onClose={vi.fn()} onCommitted={onCommitted} />);
    expect(screen.getByText(/Parado há 4 dias/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cobrar corretor" })); });
    expect(actions.nudgeCoolingBrokerAction).toHaveBeenCalledWith("a");
    expect(onCommitted).toHaveBeenCalledWith({ leadId: "a", action: "nudge" });
  });

  it("falha do servidor não avisa o workspace e mostra a causa", async () => {
    actions.nudgeCoolingBrokerAction.mockResolvedValueOnce({ ok: false, message: "O corretor já foi cobrado. A tarefa continua aberta." });
    const onCommitted = vi.fn();
    render(<CoolingActionPanel target={{ lead, action: "nudge", idleMs: 4 * 86_400_000 }} onClose={vi.fn()} onCommitted={onCommitted} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Cobrar corretor" })); });
    expect(onCommitted).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("O corretor já foi cobrado");
  });

  it("na gaveta, redistribuir abre o seletor de corretor e repassa ao escolhido", async () => {
    const onCommitted = vi.fn();
    render(<CoolingDrawerActions lead={lead} actions={["assume", "nudge", "redistribute"]} idleMs={4 * 86_400_000} onCommitted={onCommitted} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Redistribuir" })); });
    expect(actions.listCoolingRedistributeOptionsAction).toHaveBeenCalledWith("a");
    expect(await screen.findByText(/Escolha um corretor da unidade/)).toBeInTheDocument();
  });
});
