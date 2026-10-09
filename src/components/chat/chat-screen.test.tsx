// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
// Motion reads matchMedia; reduced motion makes the script render at once.
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { ChatScreen } from "./chat-screen";
import type { ChatScript } from "./types";

const script: ChatScript = {
  status: { label: "Esperando você", tone: "waiting" },
  progress: { title: "Atendendo Maria", done: 0, total: 2 },
  blocks: [
    { type: "date", id: "d", label: "Hoje, 09:41" },
    { type: "assistant", id: "a1", text: "Chegou Maria, PME, 3 vidas." },
    {
      type: "question",
      id: "q1",
      prompt: "O que você quer fazer?",
      choices: [
        { id: "accept", label: "Aceitar", action: { kind: "server", name: "lead.accept", payload: { leadId: "l1" } } },
        { id: "open", label: "Ver a ficha", action: { kind: "href", href: "/leads/l1" } },
        { id: "decline", label: "Recusar", action: { kind: "next", questionId: "q-decline" } },
      ],
    },
    {
      type: "question",
      id: "q-decline",
      prompt: "Por que você vai recusar?",
      choices: [{ id: "busy", label: "Sem horário", action: { kind: "server", name: "lead.decline", payload: { leadId: "l1", reason: "Sem horário" } } }],
    },
  ],
};

beforeEach(() => { push.mockClear(); refresh.mockClear(); });
afterEach(() => cleanup());

function renderChat(runAction = vi.fn().mockResolvedValue({ ok: true, message: "Aceito." })) {
  render(<ChatScreen identity={{ name: "Leads", shape: "mochi", hue: 212 }} backHref="/dashboard" script={script} runAction={runAction} />);
  return runAction;
}

describe("ChatScreen", () => {
  it("plays the script and hides questions opened by another reply", () => {
    renderChat();
    expect(screen.getByText("Chegou Maria, PME, 3 vidas.")).toBeTruthy();
    expect(screen.getByText("O que você quer fazer?")).toBeTruthy();
    expect(screen.queryByText("Por que você vai recusar?")).toBeNull();
    expect(screen.getByText("Esperando você")).toBeTruthy();
    expect(screen.getByText("0 de 2")).toBeTruthy();
    expect(screen.getByPlaceholderText("Responda aqui ou escolha uma opção acima")).toBeTruthy();
  });

  it("turns a chosen reply into the broker's message and runs its action", async () => {
    const runAction = renderChat();
    fireEvent.click(screen.getByRole("button", { name: /Aceitar/ }));
    await waitFor(() => expect(runAction).toHaveBeenCalledWith({ kind: "server", name: "lead.accept", payload: { leadId: "l1" } }, expect.objectContaining({ id: "accept" })));
    expect(await screen.findByText("Aceito.")).toBeTruthy();
    expect(screen.getByText("1 de 2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Recusar/ })).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });

  it("opens the next question and answers it with the keyboard letter", async () => {
    const runAction = renderChat();
    fireEvent.click(screen.getByRole("button", { name: /Recusar/ }));
    expect(await screen.findByText("Por que você vai recusar?")).toBeTruthy();
    await act(async () => { fireEvent.keyDown(window, { key: "a" }); });
    await waitFor(() => expect(runAction).toHaveBeenCalledWith(expect.objectContaining({ name: "lead.decline" }), expect.objectContaining({ id: "busy" })));
  });

  it("shows a partial success as an alert, not as done", async () => {
    renderChat(vi.fn().mockResolvedValue({ ok: true, warning: true, message: "Etapa mudou, lembrete falhou." }));
    fireEvent.click(screen.getByRole("button", { name: /Aceitar/ }));
    expect(await screen.findByText("Etapa mudou, lembrete falhou.")).toBeTruthy();
    expect(screen.getByText("Precisa de atenção")).toBeTruthy();
    expect(screen.queryByText("Pronto")).toBeNull();
  });

  it("navigates for link replies", () => {
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: /Ver a ficha/ }));
    expect(push).toHaveBeenCalledWith("/leads/l1");
  });
});
