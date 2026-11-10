// @vitest-environment jsdom
import type * as React from "react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  // Sem espera de saída entre as cenas: o teste vê a próxima etapa na hora.
  return { ...actual, useReducedMotion: () => true, AnimatePresence: ({ children }: { children: React.ReactNode }) => children };
});

import { PRESENCE_GUIDE_NARRATION } from "@/features/waha-cadence/pairing-copy";

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
  it("copiar o código leva ao tutorial (tela inicial e 4 toques) antes de abrir o WhatsApp, que abre uma vez só no fim", async () => {
    const open = vi.fn();
    render(<PresenceGuide device="mobile" connection={connection()} duty={duty} presence={presence()} onClose={vi.fn()} openWhatsApp={open} preview={{ step: "codigo" }} />);
    expect(screen.getByText("2 de 7")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: /Copiar código/ })); });
    expect(screen.getByText("Código copiado")).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(1_000); });

    expect(screen.getByText(/Antes de abrir o WhatsApp, veja o que fazer lá/)).toBeTruthy();
    expect(screen.getByText("3 de 7")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Abrir o WhatsApp/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entendi, próximo passo" }));
    expect(screen.getByText("Depois, na lista de Conversas, toque em 4 lugares, nesta ordem:")).toBeTruthy();
    expect(screen.getByText("4 de 7")).toBeTruthy();
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole("button", { name: "Próximo toque" }));
    expect(open).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Abrir o WhatsApp/ }));
    // Antes de sair do app, o resumo: tela inicial e 3 pontinhos. Só o botão do aviso abre o WhatsApp.
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Quando o WhatsApp abrir:" })).toBeTruthy();
    expect(screen.getByText(/toque nos 3 pontinhos/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Entendi, abrir o WhatsApp/ }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByText("5 de 7")).toBeTruthy();
  });

  it("o caminho tem 4 toques e o último abre o WhatsApp e espera a conexão", () => {
    const open = vi.fn();
    render(<PresenceGuide device="mobile" connection={connection()} duty={duty} presence={presence()} onClose={vi.fn()} openWhatsApp={open} preview={{ step: "caminho" }} />);
    for (let i = 0; i < 3; i += 1) fireEvent.click(screen.getByRole("button", { name: "Próximo toque" }));
    fireEvent.click(screen.getByRole("button", { name: /Abrir o WhatsApp/ }));
    fireEvent.click(screen.getByRole("button", { name: /Entendi, abrir o WhatsApp/ }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Digitou o código no WhatsApp? Agora é só esperar uns segundos.")).toBeTruthy();
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

  it("enquanto o código não chega mostra o carregamento; se não vier, pede de novo e depois oferece Tentar de novo", async () => {
    const onGenerate = vi.fn();
    render(<PresenceGuide device="mobile" connection={connection({ code: null, onGenerate })} duty={duty} presence={presence()} onClose={vi.fn()} voiceBase={null} preview={{ step: "codigo" }} />);
    expect(screen.getByText("Só um instante…")).toBeTruthy();
    expect(screen.getByText(/Pode levar até 30 segundos/)).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(2_600); });
    expect(onGenerate).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(2_600); });
    expect(onGenerate).toHaveBeenCalledTimes(2);
    await act(async () => { vi.advanceTimersByTime(2_600); });
    expect(screen.getByText("Não consegui gerar o código agora.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onGenerate).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Só um instante…")).toBeTruthy();
  });

  it("esperando o código há mais de 45 s, troca o carregamento por Tentar de novo", async () => {
    render(<PresenceGuide device="mobile" connection={connection({ code: null, generating: true })} duty={duty} presence={presence()} onClose={vi.fn()} voiceBase={null} preview={{ step: "codigo" }} />);
    await act(async () => { vi.advanceTimersByTime(46_000); });
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
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
    expect(screen.getByText(/vá para a lista de Conversas/)).toBeTruthy();
    expect(screen.getByText("2 de 4")).toBeTruthy();
  });

  it("cada etapa toca a sua narração; o corretor pode parar (e fica parada nas próximas)", async () => {
    const sources: string[] = [];
    const play = vi.fn(function (this: EventTarget & { src: string }) { sources.push(this.src); this.dispatchEvent(new Event("play")); return Promise.resolve(); });
    const pause = vi.fn(function (this: EventTarget) { this.dispatchEvent(new Event("pause")); });
    class FakeAudio extends EventTarget { currentTime = 0; constructor(public src: string) { super(); } play = play; pause = pause; }
    vi.stubGlobal("Audio", FakeAudio);
    render(<PresenceGuide device="mobile" connection={connection()} duty={duty} presence={presence()} onClose={vi.fn()} openWhatsApp={vi.fn()} preview={{ step: "telainicial" }} />);
    await act(async () => {});
    expect(sources.at(-1)).toBe("/onboarding/narracao/presenca/tela-inicial.mp3");
    fireEvent.click(screen.getByRole("button", { name: "Entendi, próximo passo" }));
    await act(async () => {});
    expect(sources.at(-1)).toBe("/onboarding/narracao/presenca/toque-1-android.mp3");
    fireEvent.click(screen.getByRole("button", { name: "Próximo toque" }));
    await act(async () => {});
    expect(sources.at(-1)).toBe("/onboarding/narracao/presenca/toque-2.mp3");

    fireEvent.click(screen.getByRole("button", { name: /Parar a voz/ }));
    expect(pause).toHaveBeenCalled();
    expect(window.localStorage.getItem("ancora:presenca-guia:voz-desligada")).toBe("1");
    play.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Próximo toque" }));
    await act(async () => {});
    expect(play).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Ouvir a explicação desta etapa/ }));
    expect(sources.at(-1)).toBe("/onboarding/narracao/presenca/toque-3.mp3");
    vi.unstubAllGlobals();
  });

  it("toda narração tem o seu áudio gerado", () => {
    for (const key of Object.keys(PRESENCE_GUIDE_NARRATION)) {
      expect(existsSync(join(process.cwd(), "public", "onboarding", "narracao", "presenca", `${key}.mp3`)), key).toBe(true);
    }
  });

  it("a abertura fala que é uma vez só e que as mensagens pessoais ficam protegidas", () => {
    expect(PRESENCE_GUIDE_NARRATION["boas-vindas"]).toMatch(/só faz isso uma vez/);
    expect(PRESENCE_GUIDE_NARRATION["boas-vindas"]).toMatch(/mensagens pessoais ficam protegidas/);
  });

  it("só conectar (botão do topo): sem a presença, termina em conectado com Pronto", () => {
    const onFinish = vi.fn();
    const { rerender } = render(<PresenceGuide mode="connect" device="mobile" connection={connection({ started: false, code: null })} duty={duty} presence={presence({ onFinish })} onClose={vi.fn()} voiceBase={null} />);
    expect(screen.getByText("Vamos conectar o seu WhatsApp.")).toBeTruthy();
    expect(screen.getByText("1 de 6")).toBeTruthy();
    expect(screen.queryByText(/confirmar sua presença/)).toBeNull();
    rerender(<PresenceGuide mode="connect" device="mobile" connection={connection({ ready: true, phase: "ready" })} duty={duty} presence={presence({ onFinish })} onClose={vi.fn()} voiceBase={null} />);
    expect(screen.getByText("6 de 6")).toBeTruthy();
    expect(screen.getByText("Os leads do plantão já podem chegar no seu WhatsApp.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pronto" }));
    expect(onFinish).toHaveBeenCalled();
  });

  it("lembra a etapa para retomar e esquece quando a presença sai", () => {
    const { rerender } = render(<PresenceGuide device="mobile" connection={connection()} duty={duty} presence={presence()} onClose={vi.fn()} />);
    expect(window.localStorage.getItem("ancora:presenca-guia:as1")).toContain("codigo");
    rerender(<PresenceGuide device="mobile" connection={connection({ ready: true })} duty={duty} presence={presence({ stage: "done" })} onClose={vi.fn()} />);
    expect(window.localStorage.getItem("ancora:presenca-guia:as1")).toBeNull();
  });
});
