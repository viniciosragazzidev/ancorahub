// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ action: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/broker-workspace/chat/chat-actions", () => ({ runChatServerAction: mocks.action }));
vi.mock("@/components/arc/badge/badge", () => ({ Badge: ({ children }: { children: ReactNode }) => <span>{children}</span> }));
vi.mock("@/components/arc/button/button", () => ({
  Button: ({ children, loading: _loading, variant: _variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: string }) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

import { Agenda } from "./agenda";

afterEach(() => cleanup());
beforeEach(() => { mocks.action.mockReset().mockResolvedValue({ ok: true, message: "Retorno atualizado." }); });

const items = Array.from({ length: 6 }, (_, index) => ({
  id: `task-${index + 1}`,
  leadId: `lead-${index + 1}`,
  leadName: `Cliente ${index + 1}`,
  title: `Retorno ${index + 1}`,
  dueAt: new Date(Date.now() + (index + 1) * 60_000),
  priority: "normal" as const,
  href: `/leads/lead-${index + 1}#tarefas`,
}));

describe("Agenda", () => {
  it("shows every item and real actions in the full page, while the home preview stays short", () => {
    const { rerender } = render(<Agenda items={items} interactive maxItems={null} heading="Seus retornos" />);
    expect(screen.getByRole("heading", { name: "Seus retornos" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Retorno 6/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Concluir" })).toHaveLength(6);

    rerender(<Agenda items={items} />);
    expect(screen.getAllByRole("link", { name: /Retorno/ })).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Ver retornos" }).getAttribute("href")).toBe("/agenda");
  });

  it("completes, cancels with undo and reschedules through the chat server actions", async () => {
    const { rerender } = render(<Agenda items={items.slice(0, 1)} interactive maxItems={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    await waitFor(() => expect(mocks.action).toHaveBeenCalledWith("lead.completeReturn", { taskId: "task-1" }));

    mocks.action.mockResolvedValueOnce({ ok: true, message: "Cancelado.", undo: { label: "Desfazer", action: { kind: "server", name: "lead.reopenReturn", payload: { taskId: "task-1" } } } });
    rerender(<Agenda items={items.slice(0, 1)} interactive maxItems={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Desfazer" })).toBeTruthy());
    rerender(<Agenda items={[]} interactive maxItems={null} />);
    expect(screen.getByRole("button", { name: "Desfazer" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(mocks.action).toHaveBeenLastCalledWith("lead.reopenReturn", { taskId: "task-1" }));

    rerender(<Agenda items={items.slice(0, 1)} interactive maxItems={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Reagendar" }));
    fireEvent.click(screen.getByRole("button", { name: "Amanhã de manhã" }));
    await waitFor(() => expect(mocks.action).toHaveBeenLastCalledWith("lead.scheduleReturn", { leadId: "lead-1", when: "tomorrow", taskId: "task-1" }));
  });
});
