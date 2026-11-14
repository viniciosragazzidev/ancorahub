// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ action: vi.fn(), refresh: vi.fn(), fire: vi.fn() }));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => mocks.fire }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/broker-workspace/chat/chat-actions", () => ({ runChatServerAction: mocks.action }));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, loading: _loading, variant: _variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string }) => (
    <button type="button" {...props}>{children}</button>
  ),
}));
// Relógio do navegador parado no instante do servidor para os grupos serem previsíveis.
vi.mock("./use-minute-clock", () => ({ useMinuteClock: () => null }));

import type { AgendaEntry } from "@/features/broker-workspace/agenda-connected";
import { ConnectedAgenda, ConnectedAgendaError } from "./connected-agenda";

afterEach(() => cleanup());
beforeEach(() => {
  mocks.action.mockReset().mockResolvedValue({ ok: true, message: "Retorno concluído." });
  mocks.refresh.mockReset();
  mocks.fire.mockReset();
});

const NOW = "2026-11-13T13:00:00.000Z";

const entries: AgendaEntry[] = [
  { id: "t1", leadId: "l1", leadName: "Ana Teste", title: "Retornar contato", dueAt: new Date("2026-11-12T20:00:00Z"), priority: "normal", kind: "retorno", clientId: null },
  { id: "t2", leadId: "l2", leadName: "Bruno Teste", title: "Renovação de Contrato", dueAt: new Date("2026-11-13T18:00:00Z"), priority: "urgent", kind: "renovacao", clientId: "c2" },
  { id: "t3", leadId: "l3", leadName: "Carla Teste", title: "Enviar documentos", dueAt: new Date("2026-11-14T12:00:00Z"), priority: "normal", kind: "tarefa", clientId: null },
];

describe("ConnectedAgenda", () => {
  it("agrupa por dia e cada item abre o lead ou o perfil do cliente", () => {
    render(<ConnectedAgenda entries={entries} duty={null} generatedAt={NOW} />);
    const overdue = screen.getByRole("region", { name: /Atrasados/ });
    expect(within(overdue).getByText("Atrasado")).toBeTruthy();
    expect(within(overdue).getByRole("link", { name: /Retornar contato, Abrir lead Ana Teste/ }).getAttribute("href")).toBe("/leads/l1");

    const today = screen.getByRole("region", { name: /Hoje/ });
    expect(within(today).getByRole("link", { name: /Abrir perfil de Bruno Teste/ }).getAttribute("href")).toBe("/clientes/c2");
    expect(within(today).getByRole("link", { name: "Conversa" }).getAttribute("href")).toBe("/leads/l2");
    expect(within(today).getByText("Urgente")).toBeTruthy();
    expect(within(today).getByText(/Renovação · Bruno Teste/)).toBeTruthy();

    const tomorrow = screen.getByRole("region", { name: /Amanhã/ });
    expect(within(tomorrow).getByText("09:00")).toBeTruthy();
    expect(screen.queryByRole("region", { name: /Próximos/ })).toBeNull();
  });

  it("concluir chama a mesma action da Agenda anterior e atualiza a página", async () => {
    render(<ConnectedAgenda entries={entries} duty={null} generatedAt={NOW} />);
    fireEvent.click(within(screen.getByRole("region", { name: /Atrasados/ })).getByRole("button", { name: "Concluir" }));
    await waitFor(() => expect(mocks.action).toHaveBeenCalledWith("lead.completeReturn", { taskId: "t1" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(screen.getByText("Retorno concluído.")).toBeTruthy();
    expect(screen.getByText("Concluído")).toBeTruthy();
    expect(mocks.fire).toHaveBeenCalledWith("tap");
    expect(mocks.fire).toHaveBeenCalledWith("confirm");
  });

  it("falha deixa o item como estava e oferece tentar de novo", async () => {
    mocks.action.mockResolvedValueOnce({ ok: false, message: "Não encontrei esse retorno." });
    render(<ConnectedAgenda entries={entries} duty={null} generatedAt={NOW} />);
    fireEvent.click(within(screen.getByRole("region", { name: /Atrasados/ })).getByRole("button", { name: "Cancelar" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não encontrei esse retorno. O retorno continua na sua agenda.");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.fire).toHaveBeenCalledWith("error");
    fireEvent.click(within(alert).getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(mocks.action).toHaveBeenLastCalledWith("lead.cancelReturn", { taskId: "t1", leadName: "Ana Teste" }));
  });

  it("mostra o plantão do dia só como atalho para Plantões", () => {
    render(<ConnectedAgenda entries={[]} duty={{ state: "em_andamento", title: "PME", detail: "Em andamento até 18:00" }} generatedAt={NOW} />);
    expect(screen.getByRole("link", { name: /Seu plantão agora/ }).getAttribute("href")).toBe("/plantoes");
    expect(screen.getByText("Nada agendado por enquanto")).toBeTruthy();
  });

  it("falha de leitura oferece tentar de novo sem dizer que está vazio", () => {
    render(<ConnectedAgendaError />);
    expect(screen.queryByText("Nada agendado por enquanto")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
