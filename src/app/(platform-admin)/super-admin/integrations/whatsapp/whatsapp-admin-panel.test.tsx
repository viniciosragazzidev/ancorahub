// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refreshMock, disconnectMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  disconnectMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock, error: toastErrorMock } }));
vi.mock("./actions", () => ({
  connectWhatsAppTenantAction: vi.fn(),
  disconnectWhatsAppTenantAction: disconnectMock,
  validateWhatsAppTenantAction: vi.fn(),
}));

import { WhatsAppAdminPanel } from "./whatsapp-admin-panel";

const tenants = [{ id: "tenant-1", name: "Âncora Hub", status: "active" }];
const connections = [{
  id: "channel-1",
  tenantId: "tenant-1",
  displayPhoneNumber: "+55 21 99449-6129",
  verifiedName: "Âncora Hub Oficial",
  status: "active",
  qualityRating: "GREEN",
  lastWebhookAt: null,
}];

afterEach(() => {
  cleanup();
  refreshMock.mockClear();
  disconnectMock.mockReset();
  toastSuccessMock.mockClear();
  toastErrorMock.mockClear();
});

describe("WhatsAppAdminPanel", () => {
  it("asks for confirmation before disconnecting a tenant channel", async () => {
    disconnectMock.mockResolvedValue(undefined);
    render(<WhatsAppAdminPanel tenants={tenants} connections={connections} />);

    fireEvent.click(screen.getByRole("button", { name: "Desconectar canal" }));
    expect(screen.getByRole("heading", { name: "Desconectar este canal oficial?" })).toBeInTheDocument();

    // Cancelar não desconecta.
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(disconnectMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Desconectar canal" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desconectar canal" }));

    await waitFor(() => expect(disconnectMock).toHaveBeenCalledTimes(1));
    const [formData] = disconnectMock.mock.calls[0];
    expect(formData.get("channelId")).toBe("channel-1");
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(toastSuccessMock).toHaveBeenCalledWith("Canal oficial desconectado.", { description: "O histórico foi preservado." });
  });

  it("shows an error toast when disconnecting fails", async () => {
    disconnectMock.mockRejectedValue(new Error("Canal oficial não encontrado."));
    render(<WhatsAppAdminPanel tenants={tenants} connections={connections} />);

    fireEvent.click(screen.getByRole("button", { name: "Desconectar canal" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desconectar canal" }));

    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Canal oficial não encontrado."));
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
