// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./mention-client", () => ({ fetchMentionMenu: vi.fn(async () => []) }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { DevLabProvider, type DevLab } from "@/lib/dev-lab";

import { Composer } from "./composer";

afterEach(() => cleanup());

const lab = { sasa: { simulateMic: true, command: vi.fn(), run: vi.fn() } } as unknown as DevLab;
const wrap = (node: ReactNode) => <DevLabProvider value={lab}>{node}</DevLabProvider>;
const hold = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

describe("Composer: segurar para falar", () => {
  it("segurar grava, soltar transcreve e envia o texto como voz", async () => {
    const voice = vi.fn(async () => ({ ok: true as const, text: "pausa meu plantão" }));
    const onSend = vi.fn();
    render(wrap(<Composer placeholder="Peça algo à Sasá" voice={voice} onSend={onSend} />));
    const mic = screen.getByRole("button", { name: "Segure para falar com a Sasá" });
    fireEvent.pointerDown(mic, { button: 0, clientX: 300, pointerId: 1 });
    expect(await screen.findByText("Deslize para a esquerda para cancelar")).toBeTruthy();
    await hold(550);
    fireEvent.pointerUp(mic, { clientX: 300, pointerId: 1 });
    await waitFor(() => expect(onSend).toHaveBeenCalledWith("pausa meu plantão", expect.objectContaining({ voice: true, clientMessageId: expect.any(String) })));
    const call = (voice.mock.calls as unknown as Array<[{ clientCommandId: string }]>)[0]![0];
    expect(onSend.mock.calls[0]![1].clientMessageId).toBe(call.clientCommandId);
  });

  it("arrastar para a esquerda cancela sem enviar", async () => {
    const voice = vi.fn();
    render(wrap(<Composer voice={voice} onSend={vi.fn()} />));
    const mic = screen.getByRole("button", { name: "Segure para falar com a Sasá" });
    fireEvent.pointerDown(mic, { button: 0, clientX: 300, pointerId: 1 });
    await hold(550);
    fireEvent.pointerMove(mic, { clientX: 200, pointerId: 1 });
    expect(await screen.findByText("Solte para cancelar")).toBeTruthy();
    fireEvent.pointerUp(mic, { clientX: 200, pointerId: 1 });
    await hold(20);
    expect(voice).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Segure para falar com a Sasá" })).toBeTruthy();
  });

  it("toque rápido explica que é para segurar; falha mostra a causa", async () => {
    const voice = vi.fn(async () => ({ ok: false as const, error: "Não consegui entender o áudio. Tente de novo ou escreva." }));
    render(wrap(<Composer voice={voice} onSend={vi.fn()} />));
    const mic = screen.getByRole("button", { name: "Segure para falar com a Sasá" });
    fireEvent.pointerDown(mic, { button: 0, clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(mic, { clientX: 300, pointerId: 1 });
    expect(await screen.findByText("Segure o microfone enquanto fala.")).toBeTruthy();
    fireEvent.pointerDown(mic, { button: 0, clientX: 300, pointerId: 2 });
    await hold(550);
    fireEvent.pointerUp(mic, { clientX: 300, pointerId: 2 });
    expect(await screen.findByText("Não consegui entender o áudio. Tente de novo ou escreva.")).toBeTruthy();
  });

  it("com texto no campo, o botão volta a ser Enviar; o rascunho do Corrigir entra no campo", async () => {
    const { rerender } = render(wrap(<Composer voice={vi.fn()} onSend={vi.fn()} />));
    rerender(wrap(<Composer voice={vi.fn()} onSend={vi.fn()} draft={{ text: "marca retorno com o Pedro amanhã às 10", key: 1 }} />));
    expect(await screen.findByDisplayValue("marca retorno com o Pedro amanhã às 10")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Segure para falar com a Sasá" })).toBeNull();
  });
});
