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
vi.mock("../actions", () => ({
  confirmMetaConnection: vi.fn(),
  disconnectMetaConnection: disconnectMock,
  getMetaMarketingAttemptAssets: vi.fn(),
  recordMetaMarketingOnboardingStep: vi.fn(),
  triggerManualMetaSync: vi.fn(),
}));
vi.mock("../meta-marketing-oauth-url", () => ({ createMetaMarketingOAuthUrl: vi.fn(() => "https://meta.example/auth") }));

import { MetaIntegrationView } from "./meta-integration-view";

const connectedConnection = {
  id: "connection-1", tenantId: "tenant-1", businessId: "business-1", businessName: "Âncora Hub",
  status: "connected" as const, permissions: [] as string[], expiresAt: null, lastError: null, lastSyncedAt: null,
  pagesCount: 1, adAccountsCount: 1, whatsappConnected: false,
};

const connectedAssets = {
  pages: [{ id: "page-1", name: "Âncora Saúde", status: "active" }],
  adAccounts: [{ id: "act_1", name: "Conta principal", currency: "BRL", status: "active" }],
  pixels: [{ id: "pixel-1", name: "Pixel principal", status: "active" }],
  datasets: [],
  leadForms: [{ id: "form-1", name: "Formulário principal", status: "ACTIVE", pageId: "page-1" }],
  campaigns: [{ id: "campaign-1", name: "Campanha de saúde", status: "ACTIVE", adAccountId: "act_1" }],
  ads: [{ id: "ad-1", name: "Anúncio principal", status: "ACTIVE", adSetId: "adset-1" }],
};

afterEach(() => {
  cleanup(); refreshMock.mockClear(); disconnectMock.mockReset(); toastSuccessMock.mockClear(); toastErrorMock.mockClear();
});

describe("MetaIntegrationView", () => {
  it("keeps WhatsApp outside the Marketing authorization flow", () => {
    render(<MetaIntegrationView connection={null} assets={null} logs={[]} />);
    expect(screen.getByRole("button", { name: "Conectar Marketing" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Conectar Marketing" }));
    expect(screen.getByRole("heading", { name: "Conectar Marketing da Meta" })).toBeInTheDocument();
    expect(screen.getByText(/O WhatsApp oficial é uma conexão separada desta autorização/)).toBeInTheDocument();
  });

  it("shows the tenant-owned business profile, pixels, forms, campaigns and ads", () => {
    render(<MetaIntegrationView canConfigure={false} connection={connectedConnection} assets={connectedAssets} logs={[]} />);
    expect(screen.getByText("Perfil e ativos conectados")).toBeInTheDocument();
    expect(screen.getByText("Âncora Hub")).toBeInTheDocument();
    expect(screen.getByText("Âncora Saúde")).toBeInTheDocument();
    expect(screen.getByText("Pixel principal")).toBeInTheDocument();
    expect(screen.getByText("Formulário principal")).toBeInTheDocument();
    expect(screen.getByText("Campanha de saúde")).toBeInTheDocument();
    expect(screen.getByText("Anúncio principal")).toBeInTheDocument();
  });

  it("asks for confirmation before disconnecting and refreshes the page state", async () => {
    disconnectMock.mockResolvedValue({ success: true });
    render(<MetaIntegrationView canConfigure connection={connectedConnection} assets={connectedAssets} logs={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    expect(screen.getByText("Desconectar Marketing da Meta?")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(disconnectMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Desconectar" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(disconnectMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(toastSuccessMock).toHaveBeenCalledWith("Conexão de Marketing desconectada.", { description: expect.any(String) });
  });
});
