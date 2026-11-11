// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const open = vi.hoisted(() => ({
  openWhatsApp: vi.fn(),
  tryOpenWhatsAppWithoutGesture: vi.fn(),
}));
vi.mock("@/lib/whatsapp-open", () => open);

import { WhatsAppHandoff, handoffLeadFrom } from "./whatsapp-handoff";

const lead = { name: "Maria Souza", wants: "Plano para a família", plan: "Amil · PF", lives: "3 vidas", city: "Niterói" };
const url = "https://web.whatsapp.com/send?phone=5521999999999&text=Oi";

describe("WhatsAppHandoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    open.openWhatsApp.mockReset();
    open.tryOpenWhatsAppWithoutGesture.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("mostra o lead e o contador de 30 s", () => {
    render(<WhatsAppHandoff lead={lead} whatsappUrl={url} onClose={() => {}} />);
    expect(screen.getByText("Maria Souza")).toBeTruthy();
    expect(screen.getByText("Plano para a família")).toBeTruthy();
    expect(screen.getByText("3 vidas")).toBeTruthy();
    expect(screen.getByText("· 0:30")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText("· 0:25")).toBeTruthy();
  });

  it("tocar na pílula abre na hora e fecha o quadro", () => {
    const onClose = vi.fn();
    render(<WhatsAppHandoff lead={lead} whatsappUrl={url} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir o WhatsApp agora/ }));
    expect(open.openWhatsApp).toHaveBeenCalledWith(url);
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(40_000); });
    expect(open.tryOpenWhatsAppWithoutGesture).not.toHaveBeenCalled();
  });

  it("ao zerar tenta abrir sozinho e fecha quando abriu", async () => {
    open.tryOpenWhatsAppWithoutGesture.mockResolvedValue("opened");
    const onClose = vi.fn();
    render(<WhatsAppHandoff lead={lead} whatsappUrl={url} onClose={onClose} seconds={3} />);
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(open.tryOpenWhatsAppWithoutGesture).toHaveBeenCalledWith(url);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("se o navegador barrar, pede um toque", async () => {
    open.tryOpenWhatsAppWithoutGesture.mockResolvedValue("failed");
    const onClose = vi.fn();
    render(<WhatsAppHandoff lead={lead} whatsappUrl={url} onClose={onClose} seconds={2} />);
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText("Toque para abrir o WhatsApp")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Ficar aqui cancela a abertura automática", () => {
    const onClose = vi.fn();
    render(<WhatsAppHandoff lead={lead} whatsappUrl={url} onClose={onClose} seconds={2} />);
    fireEvent.click(screen.getByRole("button", { name: "Ficar aqui" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(open.tryOpenWhatsAppWithoutGesture).not.toHaveBeenCalled();
  });

  it("pausa com a aba no fundo", () => {
    render(<WhatsAppHandoff lead={lead} whatsappUrl={url} onClose={() => {}} />);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(screen.getByText("· 0:30")).toBeTruthy();
    hidden.mockReturnValue(false);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByText("· 0:28")).toBeTruthy();
    hidden.mockRestore();
  });
});

describe("handoffLeadFrom", () => {
  it("usa o resumo, o plano e as vidas da tela do lead", () => {
    expect(handoffLeadFrom({ nome: "Ana", summary: "Quer plano para 2", planName: "Bradesco", tipo: "PME", livesCount: 2, city: null, clientInfo: [{ label: "Idades", value: "30 e 32" }, { label: "Cidade", value: "Rio" }] }))
      .toEqual({ name: "Ana", wants: "Quer plano para 2", plan: "Bradesco · PME", lives: "2 vidas · idades 30 e 32", city: "Rio" });
  });

  it("sem dados, deixa as linhas vazias", () => {
    expect(handoffLeadFrom({ nome: "Ana" })).toEqual({ name: "Ana", wants: null, plan: null, lives: null, city: null });
  });
});
