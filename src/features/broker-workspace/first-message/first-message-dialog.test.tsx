// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ context: vi.fn(), send: vi.fn(), start: vi.fn(), poll: vi.fn() }));
vi.mock("./actions", () => ({ getFirstMessageContextAction: mocks.context, sendFirstMessageAction: mocks.send }));
vi.mock("@/app/(dashboard)/settings/whatsapp-actions", () => ({ startWhatsAppConnection: mocks.start, pollWhatsAppConnection: mocks.poll }));
vi.mock("motion/react", async () => {
  const actual = await vi.importActual<typeof import("motion/react")>("motion/react");
  return { ...actual, useReducedMotion: () => true };
});

import { buildFirstMessage, buildWhatsAppWebUrl } from "./first-message";
import { FirstMessageDialog } from "./first-message-dialog";

const context = (overrides = {}) => ({ ok: true, leadFirstName: "Maria", message: "Olá, Maria! Aqui é Carlos, da Âncora.", connected: true, alreadySent: false, appUrl: "https://wa.me/5521999998888", webUrl: "https://web.whatsapp.com/send?phone=5521999998888", ...overrides });

describe("first message text", () => {
  it("greets the client by first name and introduces the broker and company, without a dash", () => {
    const text = buildFirstMessage({ leadName: "Maria Souza", brokerName: "Carlos Lima", companyName: "Âncora Saúde" });
    expect(text.startsWith("Olá, Maria! Aqui é Carlos, da Âncora Saúde.")).toBe(true);
    expect(text).not.toContain("—");
    expect(buildFirstMessage({ leadName: null, brokerName: null, companyName: null }).startsWith("Olá! Recebi")).toBe(true);
    expect(buildWhatsAppWebUrl("5521999998888", "Oi tudo bem")).toBe("https://web.whatsapp.com/send?phone=5521999998888&text=Oi+tudo+bem");
  });
});

describe("FirstMessageDialog", () => {
  beforeEach(() => { Object.values(mocks).forEach((fn) => fn.mockReset()); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("connected: edits and sends through the system, then says to continue on the phone", async () => {
    mocks.context.mockResolvedValue(context());
    mocks.send.mockResolvedValue({ ok: true, webUrl: "https://web.whatsapp.com/send?phone=5521999998888" });
    const onSent = vi.fn();
    render(<FirstMessageDialog leadId="l1" open onOpenChange={() => {}} onSent={onSent} />);
    const box = await screen.findByLabelText("Mensagem");
    fireEvent.change(box, { target: { value: "Oi Maria, tudo bem?" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Mensagem enviada para Maria")).toBeTruthy();
    expect(mocks.send).toHaveBeenCalledWith({ leadId: "l1", text: "Oi Maria, tudo bem?" });
    expect(onSent).toHaveBeenCalled();
    expect(screen.getByText(/continue pelo seu celular/)).toBeTruthy();
  });

  it("not connected: advantages, step by step, QR in the same dialog, back to the message once connected", async () => {
    mocks.context.mockResolvedValue(context({ connected: false }));
    mocks.start.mockResolvedValue({ success: true, status: "initializing", qrCode: "data:image/png;base64,AAAA" });
    mocks.poll.mockResolvedValue({ success: true, status: "ready", qrCode: null });
    render(<FirstMessageDialog leadId="l1" open onOpenChange={() => {}} />);

    expect(await screen.findByText("Conecte seu WhatsApp e mande daqui")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir no WhatsApp Web" }).getAttribute("href")).toContain("web.whatsapp.com");
    fireEvent.click(screen.getByRole("button", { name: "Conectar meu WhatsApp" }));
    expect(screen.getByText("Passo 1 de 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    fireEvent.click(screen.getByRole("button", { name: "Próximo" }));
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mostrar o QR code" })); });
    expect(screen.getByText("Aponte o celular para o QR code")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_600); });
    expect(screen.getByText("WhatsApp conectado")).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(screen.getByLabelText("Mensagem")).toBeTruthy();
  });

  it("a lead that already got the first message goes straight to continue on the phone", async () => {
    mocks.context.mockResolvedValue(context({ alreadySent: true }));
    render(<FirstMessageDialog leadId="l1" open onOpenChange={() => {}} />);
    expect(await screen.findByText("A primeira mensagem já foi enviada")).toBeTruthy();
  });
});
