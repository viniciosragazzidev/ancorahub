// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsAppConnectDialog } from "./whatsapp-connect-dialog";

const mocks = vi.hoisted(() => ({
  router: { refresh: vi.fn(), replace: vi.fn() },
  poll: vi.fn(), start: vi.fn(), toggle: vi.fn(), reset: vi.fn(),
  info: vi.fn(), success: vi.fn(), error: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/ui/sonner", () => ({
  toast: { info: mocks.info, success: mocks.success, error: mocks.error },
}));
vi.mock("@/app/(dashboard)/settings/whatsapp-actions", () => ({
  getWhatsAppConnection: vi.fn(),
  pollWhatsAppConnection: mocks.poll,
  startWhatsAppConnection: mocks.start,
  toggleWhatsAppChatAction: mocks.toggle,
  resetWhatsAppSessionAction: mocks.reset,
  forceDisconnectWhatsAppSession: vi.fn(),
}));

const readyConnection = {
  tenantId: "tenant-synthetic", userId: "broker-synthetic",
  sessionId: "session-synthetic", sessionName: "session-synthetic", status: "ready",
  qrCode: null, chatInternoAtivo: true, connectedAt: null,
};
const readySnapshot = {
  success: true, status: "ready", providerStatus: "WORKING", phone: null, qrCode: null,
};

function mockViewport(mobile: boolean) {
  vi.stubGlobal("matchMedia", vi.fn((query: string) => ({
    matches: query === "(max-width: 767px)" && mobile, media: query,
    onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockViewport(true);
  mocks.poll.mockResolvedValue(readySnapshot);
  mocks.toggle.mockResolvedValue({ success: true, active: false });
  vi.spyOn(window, "open").mockReturnValue(null);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("WhatsAppConnectDialog mobile access", () => {
  it("does not tell an already connected broker to use a computer", async () => {
    render(<WhatsAppConnectDialog initial={readyConnection} />);
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp conectado" }));
    await waitFor(() => expect(mocks.poll).toHaveBeenCalled());
    expect(screen.queryByText("Conexão somente pelo computador")).not.toBeInTheDocument();
    expect(screen.queryByText(/Para gerar e ler o QR Code/)).not.toBeInTheDocument();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("opens the native app in the current context on mobile, without a popup", async () => {
    render(<WhatsAppConnectDialog initial={readyConnection} />);
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp conectado" }));
    fireEvent.click(await screen.findByRole("button", { name: /Abrir WhatsApp/ }));
    expect(window.open).toHaveBeenCalledWith("whatsapp://send", "_self");
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("reconciles an existing session on mobile without starting QR pairing or showing a blocking toast", async () => {
    render(<WhatsAppConnectDialog initial={{ ...readyConnection, status: "disconnected" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar WhatsApp" }));
    await waitFor(() => expect(screen.queryByText("Conexão somente pelo computador")).not.toBeInTheDocument());
    expect(mocks.poll).toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("keeps QR setup desktop-only when there is no session", async () => {
    render(<WhatsAppConnectDialog initial={{ ...readyConnection, status: "disconnected", sessionId: null, sessionName: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar WhatsApp" }));
    expect(await screen.findByText("Conexão somente pelo computador")).toBeInTheDocument();
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.poll).not.toHaveBeenCalled();
    // Even a programmatic click cannot start a new mobile QR flow.
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Conectar WhatsApp" }));
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("can toggle the connected chat on mobile", async () => {
    render(<WhatsAppConnectDialog initial={readyConnection} />);
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp conectado" }));
    await waitFor(() => expect(mocks.poll).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Desativar chat" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Ativar chat" })).toBeEnabled());
    expect(mocks.toggle).toHaveBeenCalledOnce();
  });

  it("preserves opening WhatsApp Web in a protected tab on desktop", async () => {
    mockViewport(false);
    render(<WhatsAppConnectDialog initial={readyConnection} />);
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp conectado" }));
    fireEvent.click(await screen.findByRole("button", { name: /Abrir WhatsApp/ }));
    expect(window.open).toHaveBeenCalledWith("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
  });

  it("still starts idempotent pairing on desktop", async () => {
    mockViewport(false);
    mocks.start.mockResolvedValue({ success: true, status: "ready", sessionId: "session-synthetic" });
    render(<WhatsAppConnectDialog initial={{ ...readyConnection, status: "disconnected", sessionId: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar WhatsApp" }));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledWith({ forceNew: false }));
  });

  it("does not automatically restart a failed pairing from mobile", async () => {
    mocks.poll.mockResolvedValueOnce({ ...readySnapshot, status: "initializing", providerStatus: "STARTING" })
      .mockResolvedValue({ ...readySnapshot, status: "error", providerStatus: "FAILED" });
    render(<WhatsAppConnectDialog initial={{ ...readyConnection, status: "initializing" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar WhatsApp" }));
    expect(await screen.findByText("Não foi possível conectar", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(mocks.poll.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("can disconnect on mobile through the existing action", async () => {
    mocks.reset.mockResolvedValue({ success: true });
    render(<WhatsAppConnectDialog initial={readyConnection} />);
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp conectado" }));
    await waitFor(() => expect(mocks.poll).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    expect(await screen.findByText("Conexão somente pelo computador")).toBeInTheDocument();
    expect(mocks.reset).toHaveBeenCalledOnce();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
