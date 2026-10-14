// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WhatsAppPlantaoNotice } from "./whatsapp-plantao-notice";

const { recordNoticeAction, getConnection, pathname } = vi.hoisted(() => ({
  recordNoticeAction: vi.fn().mockResolvedValue(undefined),
  getConnection: vi.fn(),
  pathname: { current: "/dashboard" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
}));

vi.mock("@/features/whatsapp-plantao-notice/actions", () => ({
  recordWhatsAppPlantaoNoticeAction: recordNoticeAction,
}));

vi.mock("@/app/(dashboard)/settings/whatsapp-actions", () => ({
  getWhatsAppConnection: getConnection,
}));

vi.mock("@/components/whatsapp/whatsapp-connect-dialog", () => ({
  WhatsAppConnectDialog: ({ open, onConnectionChanged }: { open: boolean; onConnectionChanged?: () => void }) => open ? (
    <div role="dialog">
      QR de conexão
      <button type="button" onClick={onConnectionChanged}>Simular conexão</button>
    </div>
  ) : null,
}));

const initialConnection = {
  tenantId: "tenant-1",
  userId: "user-1",
  sessionId: null,
  sessionName: null,
  status: "disconnected",
  qrCode: null,
  chatInternoAtivo: true,
  connectedAt: null,
} as const;

function mockDesktop(matches: boolean) {
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
    matches: query === "(min-width: 1024px) and (pointer: fine)" ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

describe("WhatsAppPlantaoNotice", () => {
  beforeEach(() => {
    localStorage.clear();
    recordNoticeAction.mockClear();
    getConnection.mockImplementation(async () => initialConnection);
    pathname.current = "/dashboard";
    mockDesktop(true);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("fecha só até o próximo dia local e registra a ação", async () => {
    const { unmount } = render(<WhatsAppPlantaoNotice userId="user-1" mode="daily" />);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Conecte seu WhatsApp até 20/10")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Agora não" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const key = Object.keys(localStorage).find((item) => item.startsWith("whatsapp-plantao-notice:user-1:"));
    expect(key).toBeTruthy();
    expect(localStorage.getItem(key!)).toBe("closed");
    expect(recordNoticeAction).toHaveBeenCalledWith("closed");

    unmount();
    render(<WhatsAppPlantaoNotice userId="user-1" mode="daily" />);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("fecha pelo Escape e registra o mesmo encerramento diário", async () => {
    render(<WhatsAppPlantaoNotice userId="user-1" mode="daily" />);
    expect(await screen.findByRole("dialog")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(recordNoticeAction).toHaveBeenCalledWith("closed");
  });

  it("abre o QR no computador e mostra a orientação sem CTA no celular", async () => {
    const desktop = render(<WhatsAppPlantaoNotice userId="user-1" mode="daily" />);
    expect(await screen.findByRole("button", { name: "Conectar WhatsApp" })).toBeTruthy();
    expect(screen.getByText(/Para continuar recebendo os leads do plantão/)).toBeTruthy();
    expect(screen.getByText(/A conexão é feita pelo computador/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Conectar WhatsApp" }));
    expect(await screen.findByText("QR de conexão")).toBeTruthy();
    expect(recordNoticeAction).toHaveBeenCalledWith("connect_clicked");
    fireEvent.click(screen.getByRole("button", { name: "Simular conexão" }));
    await waitFor(() => expect(screen.queryByText(/Conecte seu WhatsApp até 20\/10 para continuar recebendo/)).toBeNull());

    desktop.unmount();
    mockDesktop(false);
    getConnection.mockClear();
    const mobileDaily = render(<WhatsAppPlantaoNotice userId="user-1" mode="daily" />);
    expect(await screen.findByText("Para conectar, abra o CRM no computador.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conectar WhatsApp" })).toBeNull();
    expect(screen.getByRole("button", { name: "Entendi" })).toBeTruthy();
    expect(getConnection).not.toHaveBeenCalled();

    mobileDaily.unmount();
    render(<WhatsAppPlantaoNotice userId="user-1" mode="sticky" />);
    expect(screen.getByText("Para conectar, abra o CRM no computador.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conectar" })).toBeNull();
  });

  it("mantém o aviso fixo sem opção para fechar", async () => {
    render(<WhatsAppPlantaoNotice userId="user-1" mode="sticky" />);

    expect(await screen.findByText(/Conecte seu WhatsApp até 20\/10/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fechar aviso" })).toBeNull();
  });

  it("omite o aviso diário na conversa com Jack, que tem o aviso fixo", async () => {
    pathname.current = "/dashboard/c/ancora";
    render(<WhatsAppPlantaoNotice userId="user-1" mode="daily" />);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("button", { name: "Conectar WhatsApp" })).toBeNull();
    pathname.current = "/dashboard";
  });
});
