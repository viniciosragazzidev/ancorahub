// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WhatsAppConnectDialog } from "./whatsapp-connect-dialog";

const mocks = vi.hoisted(() => ({
  router: { refresh: vi.fn(), replace: vi.fn() },
  poll: vi.fn(), start: vi.fn(), toggle: vi.fn(), reset: vi.fn(),
  pairingPhone: vi.fn(), requestCode: vi.fn(),
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
  getWhatsAppPairingPhone: mocks.pairingPhone,
  requestWhatsAppPairingCode: mocks.requestCode,
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
    matches: mobile && /max-width: 767px|pointer: coarse/.test(query), media: query,
    onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockViewport(true);
  mocks.poll.mockResolvedValue(readySnapshot);
  mocks.toggle.mockResolvedValue({ success: true, active: false });
  mocks.pairingPhone.mockResolvedValue({ phone: "5521999998888" });
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

  it("opens on the pairing code on mobile and starts the session", async () => {
    mocks.start.mockResolvedValue({ success: true, status: "initializing", sessionId: "session-synthetic", providerStatus: "SCAN_QR_CODE" });
    mocks.poll.mockResolvedValue({ ...readySnapshot, status: "initializing", providerStatus: "SCAN_QR_CODE" });
    render(<WhatsAppConnectDialog initial={{ ...readyConnection, status: "disconnected", sessionId: null, sessionName: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar WhatsApp" }));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledWith({ forceNew: false }));
    expect(screen.getByRole("radio", { name: "Código" })).toHaveAttribute("aria-checked", "true");
    expect(await screen.findByText("Conecte com um código")).toBeInTheDocument();
    expect(screen.queryByText("Conexão somente pelo computador")).not.toBeInTheDocument();
  });

  it("keeps the code screen when the server sends a QR the broker never saw", async () => {
    // Old WhatsApp server (no providerStatus) or a session restart: a QR arriving in the
    // background of the code method must not read as "the phone scanned it".
    mocks.start.mockResolvedValue({ success: true, status: "initializing", sessionId: "session-synthetic", qrCode: "qr-synthetic" });
    mocks.poll.mockResolvedValue({ ...readySnapshot, status: "initializing", providerStatus: null, qrCode: null });
    render(<WhatsAppConnectDialog initial={{ ...readyConnection, status: "disconnected", sessionId: null, sessionName: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar WhatsApp" }));
    await waitFor(() => expect(mocks.poll).toHaveBeenCalled());
    expect(await screen.findByText("Conecte com um código")).toBeInTheDocument();
    expect(screen.queryByText("Finalizando vínculo…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar código" })).toBeInTheDocument();
  });

  it("generates the pairing code for the broker's number and shows it", async () => {
    mocks.start.mockResolvedValue({ success: true, status: "initializing", sessionId: "session-synthetic", providerStatus: "SCAN_QR_CODE" });
    mocks.poll.mockResolvedValue({ ...readySnapshot, status: "initializing", providerStatus: "SCAN_QR_CODE" });
    mocks.requestCode.mockResolvedValue({ success: true, pairingCode: "ABCD-1234", retryInMs: null });
    render(<WhatsAppConnectDialog initial={{ ...readyConnection, status: "disconnected" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar WhatsApp" }));
    expect(await screen.findByText("+55 (21) 99999-8888")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Gerar código" }));
    await waitFor(() => expect(mocks.requestCode).toHaveBeenCalledWith({ phone: "5521999998888" }));
    expect(await screen.findByRole("img", { name: "Código A B C D 1 2 3 4" })).toBeInTheDocument();
    expect(await screen.findByText("Digite o código no WhatsApp")).toBeInTheDocument();
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

  it("defaults to the QR on desktop and offers the code as an option", async () => {
    mockViewport(false);
    mocks.start.mockResolvedValue({ success: true, status: "initializing", sessionId: "session-synthetic", providerStatus: "STARTING" });
    mocks.poll.mockResolvedValue({ ...readySnapshot, status: "initializing", providerStatus: "STARTING" });
    render(<WhatsAppConnectDialog initial={{ ...readyConnection, status: "disconnected" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar WhatsApp" }));
    expect(await screen.findByRole("radio", { name: "QR Code" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Código" }));
    expect(await screen.findByText("Conecte com um código")).toBeInTheDocument();
    await waitFor(() => expect(mocks.pairingPhone).toHaveBeenCalled());
  });

  it("can disconnect on mobile through the existing action", async () => {
    mocks.reset.mockResolvedValue({ success: true });
    render(<WhatsAppConnectDialog initial={readyConnection} />);
    fireEvent.click(screen.getByRole("button", { name: "WhatsApp conectado" }));
    await waitFor(() => expect(mocks.poll).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("WhatsApp desconectado."));
    expect(mocks.reset).toHaveBeenCalledOnce();
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
