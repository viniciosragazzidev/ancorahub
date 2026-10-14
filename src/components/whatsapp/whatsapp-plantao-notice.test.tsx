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
    expect(await screen.findByText(/A partir de 20\/10, conecte seu WhatsApp/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    await waitFor(() => expect(screen.queryByText(/A partir de 20\/10, conecte seu WhatsApp/)).toBeNull());
    const key = Object.keys(localStorage).find((item) => item.startsWith("whatsapp-plantao-notice:user-1:"));
    expect(key).toBeTruthy();
    expect(localStorage.getItem(key!)).toBe("closed");
    expect(recordNoticeAction).toHaveBeenCalledWith("closed");

    unmount();
    render(<WhatsAppPlantaoNotice userId="user-1" mode="daily" />);
    await waitFor(() => expect(screen.queryByText(/A partir de 20\/10, conecte seu WhatsApp/)).toBeNull());
  });

  it("abre o QR no computador e mostra a orientação no celular", async () => {
    const desktop = render(<WhatsAppPlantaoNotice userId="user-1" mode="daily" />);
    expect(await screen.findByRole("button", { name: "Conectar WhatsApp" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Conectar WhatsApp" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(recordNoticeAction).toHaveBeenCalledWith("connect_clicked");
    fireEvent.click(screen.getByRole("button", { name: "Simular conexão" }));
    await waitFor(() => expect(screen.queryByText(/A partir de 20\/10, conecte seu WhatsApp/)).toBeNull());

    desktop.unmount();
    mockDesktop(false);
    getConnection.mockClear();
    render(<WhatsAppPlantaoNotice userId="user-1" mode="daily" />);
    expect(await screen.findByRole("button", { name: "Conectar WhatsApp" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Conectar WhatsApp" }));
    expect(await screen.findByText("Você está no celular. Para conectar, abra o CRM no computador.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getConnection).not.toHaveBeenCalled();
  });

  it("mantém o aviso fixo sem opção para fechar", async () => {
    render(<WhatsAppPlantaoNotice userId="user-1" mode="sticky" />);

    expect(await screen.findByText(/A partir de 20\/10, conecte seu WhatsApp/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fechar aviso" })).toBeNull();
  });

  it("omite o aviso diário na conversa com Jack, que tem o aviso fixo", async () => {
    pathname.current = "/dashboard/c/ancora";
    render(<WhatsAppPlantaoNotice userId="user-1" mode="daily" />);

    await waitFor(() => expect(screen.queryByText(/A partir de 20\/10, conecte seu WhatsApp/)).toBeNull());
    expect(screen.queryByRole("button", { name: "Conectar WhatsApp" })).toBeNull();
    pathname.current = "/dashboard";
  });
});
