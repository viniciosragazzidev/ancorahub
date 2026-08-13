// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refreshMock, changeMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  changeMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock, error: toastErrorMock } }));
vi.mock("../waha-connection-actions", () => ({
  changeWahaConnectionAction: changeMock,
  createWahaConnectionAction: vi.fn(),
  refreshWahaConnectionAction: vi.fn(),
  updateWahaCapabilitiesAction: vi.fn(),
}));

import { WahaConnectionsCard } from "./waha-connections-card";

const connection = {
  id: "waha-1",
  label: "Atendimento geral",
  scope: "tenant",
  status: "active",
  displayPhoneNumber: "+55 71 98888-8888",
  capabilities: { inbound: true, cadence: false, ai: false },
};

afterEach(() => {
  cleanup();
  refreshMock.mockClear();
  changeMock.mockReset();
  toastSuccessMock.mockClear();
  toastErrorMock.mockClear();
});

describe("WahaConnectionsCard", () => {
  it("asks for confirmation before disconnecting a controlled number", async () => {
    changeMock.mockResolvedValue({ success: true, result: { status: "disconnected", qrCode: null } });
    render(<WahaConnectionsCard connections={[connection]} role="director" enabled />);

    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    expect(screen.getByRole("heading", { name: "Desconectar este número?" })).toBeInTheDocument();

    // Cancelar não desconecta.
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(changeMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desconectar" }));

    await waitFor(() => expect(changeMock).toHaveBeenCalledWith("waha-1", "disconnect"));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(toastSuccessMock).toHaveBeenCalledWith("Número desconectado.");
  });

  it("shows an error toast when disconnecting fails", async () => {
    changeMock.mockResolvedValue({ success: false, error: "Falha ao desconectar." });
    render(<WahaConnectionsCard connections={[connection]} role="director" enabled />);

    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desconectar" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Falha ao desconectar."));
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
