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
vi.mock("../actions", () => ({ disconnectMetaCloudChannelAction: disconnectMock, setMetaCloudChannelStatusAction: vi.fn() }));

import { MetaCloudSetupCard } from "./meta-cloud-setup-card";

afterEach(() => {
  cleanup();
  refreshMock.mockClear();
  disconnectMock.mockReset();
  toastSuccessMock.mockClear();
  toastErrorMock.mockClear();
});

const activeChannel = {
  id: "channel-1", displayPhoneNumber: "+55 71 99999-9999", verifiedName: "Âncora Saúde", status: "active",
  qualityRating: "GREEN", messagingLimit: "1K", businessId: "business-1", wabaId: "waba-1", phoneNumberId: "phone-1",
  lastWebhookAt: null, activatedAt: new Date("2026-08-12T12:00:00Z"),
};

describe("MetaCloudSetupCard", () => {
  it("gives the Director clear controls for the isolated official number", () => {
    render(<MetaCloudSetupCard enabled configured missing={[]} companyAccount={activeChannel} canManage />);

    expect(screen.getByText("Status do número oficial")).toBeInTheDocument();
    expect(screen.getByText("Este canal é independente de Marketing, páginas e contas de anúncios.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pausar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Desconectar número" }));
    expect(screen.getByRole("heading", { name: "Desconectar este número do CRM?" })).toBeInTheDocument();
  });

  it("explains the next action when no number is connected", () => {
    render(<MetaCloudSetupCard enabled configured missing={[]} companyAccount={null} canManage />);

    expect(screen.getByText("Nenhum número oficial conectado")).toBeInTheDocument();
    expect(screen.getByText("Use o botão abaixo para escolher a conta WhatsApp Business e o número corporativo.")).toBeInTheDocument();
  });

  it("shows an error toast when disconnecting the official number fails", async () => {
    disconnectMock.mockRejectedValue(new Error("Falha ao desconectar na Meta."));
    render(<MetaCloudSetupCard enabled configured missing={[]} companyAccount={activeChannel} canManage />);

    fireEvent.click(screen.getByRole("button", { name: "Desconectar número" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desconectar número" }));

    await waitFor(() => expect(disconnectMock).toHaveBeenCalledTimes(1));
    expect(toastErrorMock).toHaveBeenCalledWith("Falha ao desconectar na Meta.");
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
