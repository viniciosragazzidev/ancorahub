// @vitest-environment jsdom
import type * as React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  // Sem espera de saída entre as cenas: o teste vê a próxima etapa na hora.
  return { ...actual, useReducedMotion: () => true, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

import { PresenceGuide, type PresenceGuideConnection, type PresenceGuidePresence } from "./presence-guide";

const connection = (over: Partial<PresenceGuideConnection> = {}): PresenceGuideConnection => ({
  ready: false, phase: "qr", method: "code", onMethodChange: vi.fn(), qrCode: null, started: true, onStart: vi.fn(),
  phone: "21987654321", phoneValid: true, phoneChecked: true, onPhoneChange: vi.fn(), code: "K7QM2XPD", generating: false,
  expired: false, cooldownSeconds: 0, stalled: false, connectivity: null, issue: null, onGenerate: vi.fn(), ...over,
});
const presence = (over: Partial<PresenceGuidePresence> = {}): PresenceGuidePresence => ({ stage: "connect", onConfirm: vi.fn(), onFinish: vi.fn(), ...over });
const duty = { key: "as1", scheduleName: "PME Manhã", branchName: "Centro", mode: "online" as const, until: "13:00" };

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("PresenceGuide (roteiro guiado de presença, 09/11)", () => {
  it("copiar o código leva à tela inicial, que abre o WhatsApp e depois pede para confirmar a tela Conversas", async () => {
    const open = vi.fn();
    render(<PresenceGuide device="mobile" connection={connection()} duty={duty} presence={presence()} onClose={vi.fn()} openWhatsApp={open} preview={{ step: "codigo" }} />);
    expect(screen.getByText("2 de 7")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Copiar código/ })); });
    expect(screen.getByText("Código copiado")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(1_000); });

    expect(screen.getByText("Abra o WhatsApp e confira se está na tela Conversas.")).toBeTruthy();
    expect(screen.getByText("3 de 7")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Abrir o WhatsApp/ }));
    // Antes de sair do app, o aviso: tela inicial e 3 pontinhos. Só o botão do aviso abre o WhatsApp.
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Quando o WhatsApp abrir:" })).toBeTruthy();
    expect(screen.getByText(/toque nos 3 pontinhos/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Entendi, abrir o WhatsApp/ }));
    expect(open).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Estou na tela de Conversas" }));
    expect(screen.getByText("Agora, no WhatsApp, você vai tocar em 4 lugares. Veja:")).toBeTruthy();
    expect(screen.getByText("4 de 7")).toBeTruthy();
  });

  it("o caminho tem 4 toques e o último abre o WhatsApp e espera a conexão", () => {
    const open = vi.fn();
    render(<PresenceGuide device="mobile" connection={connection()} duty={duty} presence={presence()} onClose={vi.fn()} openWhatsApp={open} preview={{ step: "caminho" }} />);
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole("button", { name: "Próximo toque" }));
    fireEvent.click(screen.getByRole("button", { name: /Abrir o WhatsApp/ }));
    fireEvent.click(screen.getByRole("button", { name: /Entendi, abrir o WhatsApp/ }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Colou o código no WhatsApp? Estou esperando a confirmação.")).toBeTruthy();
  });

  it("conectado e confirmado: um toque confirma; o fim leva ao plantão", () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<PresenceGuide device="mobile" connection={connection({ ready: true, phase: "ready" })} duty={duty} presence={presence({ stage: "confirm", onConfirm })} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar presença" }));
    expect(onConfirm).toHaveBeenCalled();
    const onFinish = vi.fn();
    rerender(<PresenceGuide device="mobile" connection={connection({ ready: true, phase: "ready" })} duty={duty} presence={presence({ stage: "done", confirmedAt: "09:12", onFinish })} onClose={vi.fn()} />);
    expect(screen.getByText("Presença confirmada às 09:12.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ir para o Plantão" }));
    expect(onFinish).toHaveBeenCalled();
  });

  it("código vencido mostra o conserto e gera outro", () => {
    const onGenerate = vi.fn();
    render(<PresenceGuide device="mobile" connection={connection({ code: null, expired: true, onGenerate })} duty={duty} presence={presence()} onClose={vi.fn()} preview={{ step: "codigo" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar o novo código" }));
    expect(onGenerate).toHaveBeenCalled();
  });

  it("fora da janela de 1 hora mostra o motivo do servidor na etapa de confirmar", () => {
    render(<PresenceGuide device="mobile" connection={connection({ ready: true, phase: "ready" })} duty={duty} presence={presence({ stage: "error", error: "Seu plantão já passou do tempo de tolerância (1 hora após o início)." })} onClose={vi.fn()} />);
    expect(screen.getByText(/passou do tempo de tolerância/)).toBeTruthy();
  });

  it("no computador mostra o QR com o caminho ao lado, incluindo a tela Conversas", () => {
    render(<PresenceGuide device="desktop" connection={connection({ method: "qr", qrCode: "data:image/png;base64,AAA" })} duty={duty} presence={presence()} onClose={vi.fn()} preview={{ step: "codigo" }} />);
    expect(screen.getByAltText("QR Code para conectar o WhatsApp")).toBeTruthy();
    expect(screen.getByText(/confira se está na tela Conversas/)).toBeTruthy();
    expect(screen.getByText("2 de 4")).toBeTruthy();
  });

  it("lembra a etapa para retomar e esquece quando a presença sai", () => {
    const { rerender } = render(<PresenceGuide device="mobile" connection={connection()} duty={duty} presence={presence()} onClose={vi.fn()} />);
    expect(window.localStorage.getItem("ancora:presenca-guia:as1")).toContain("codigo");
    rerender(<PresenceGuide device="mobile" connection={connection({ ready: true })} duty={duty} presence={presence({ stage: "done" })} onClose={vi.fn()} />);
    expect(window.localStorage.getItem("ancora:presenca-guia:as1")).toBeNull();
  });
});
