// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refreshMock, disconnectMock, syncMock, setGlobalModeMock, toggleCampaignMock, toggleAdMock, toggleFormMock, batchEligibilityMock, toastSuccessMock, toastWarningMock, toastErrorMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  disconnectMock: vi.fn(),
  syncMock: vi.fn(),
  setGlobalModeMock: vi.fn(),
  toggleCampaignMock: vi.fn(),
  toggleAdMock: vi.fn(),
  toggleFormMock: vi.fn(),
  batchEligibilityMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastWarningMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("sonner", () => ({ toast: { success: toastSuccessMock, warning: toastWarningMock, error: toastErrorMock } }));
vi.mock("../actions", () => ({
  confirmMetaConnection: vi.fn(),
  disconnectMetaConnection: disconnectMock,
  getMetaMarketingAttemptAssets: vi.fn(),
  recordMetaMarketingOnboardingStep: vi.fn(),
  triggerManualMetaSync: syncMock,
  toggleMetaCampaignCaptureEligibilityAction: toggleCampaignMock,
  toggleMetaAdCaptureEligibilityAction: toggleAdMock,
  toggleMetaFormCaptureEligibilityAction: toggleFormMock,
  batchSetMetaCaptureEligibilityAction: batchEligibilityMock,
  setMetaGlobalCaptureModeAction: setGlobalModeMock,
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
  cleanup(); refreshMock.mockClear(); disconnectMock.mockReset(); syncMock.mockReset(); setGlobalModeMock.mockReset(); toggleCampaignMock.mockReset(); toggleAdMock.mockReset(); toggleFormMock.mockReset(); batchEligibilityMock.mockReset(); toastSuccessMock.mockClear(); toastWarningMock.mockClear(); toastErrorMock.mockClear();
});

describe("MetaIntegrationView", () => {
  it("paginates asset lists with up to 15 items per page", () => {
    const manyPages = Array.from({ length: 17 }, (_, index) => ({ id: `page-${index + 1}`, name: `Página ${String(index + 1).padStart(2, "0")}`, status: "active" }));
    render(<MetaIntegrationView canConfigure={false} connection={connectedConnection} assets={{ ...connectedAssets, pages: manyPages }} logs={[]} />);
    expect(screen.getByText("Página 01")).toBeInTheDocument();
    expect(screen.getByText("Página 15")).toBeInTheDocument();
    expect(screen.queryByText("Página 16")).not.toBeInTheDocument();
    expect(screen.getByText("1–15 de 17")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(screen.getByText("Página 16")).toBeInTheDocument();
    expect(screen.queryByText("Página 01")).not.toBeInTheDocument();
    expect(screen.getByText("16–17 de 17")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(screen.getByText("Página 01")).toBeInTheDocument();
  });

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
    fireEvent.click(screen.getAllByRole("button", { name: "Desconectar" })[0]);
    expect(screen.getByText("Desconectar Marketing da Meta?")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(disconnectMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Desconectar" })[0]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Desconectar" }));
    await waitFor(() => expect(disconnectMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(toastSuccessMock).toHaveBeenCalledWith("Conexão de Marketing desconectada.", { description: expect.any(String) });
  });

  it("explains the missing ad-account permission and offers a safe reconnection", () => {
    render(<MetaIntegrationView canConfigure connection={{ ...connectedConnection, lastError: JSON.stringify({ warnings: [{ code: "missing_ads_read", message: "Grant ads_read." }] }) }} assets={connectedAssets} logs={[]} />);
    expect(screen.getByText("Permissão de anúncios necessária")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconectar permissões" })).toBeInTheDocument();
  });

  it("reports a partial sync without hiding the assets already synchronized", async () => {
    syncMock.mockResolvedValue({ success: true, itemsSynced: 2, warnings: [{ code: "missing_ads_read", message: "Grant ads_read." }] });
    render(<MetaIntegrationView canConfigure connection={connectedConnection} assets={connectedAssets} logs={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Sincronizar" }));
    await waitFor(() => expect(toastWarningMock).toHaveBeenCalledWith("Sincronização parcial da Meta.", { description: "Grant ads_read." }));
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("updates campaign eligibility locally and refreshes the route tree", async () => {
    toggleCampaignMock.mockResolvedValue({ success: true });
    render(<MetaIntegrationView canConfigure connection={connectedConnection} assets={connectedAssets} logs={[]} />);

    fireEvent.click(within(screen.getByRole("region", { name: "Campanhas & Captura CRM" })).getByRole("button", { name: "Tornar Elegível" }));

    await waitFor(() => expect(toggleCampaignMock).toHaveBeenCalledWith({ campaignId: "campaign-1", enabled: true }));
    expect(screen.getByText("Elegível para captura")).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("updates the master capture mode locally and refreshes the route tree", async () => {
    setGlobalModeMock.mockResolvedValue({ success: true });
    render(<MetaIntegrationView canConfigure connection={{ ...connectedConnection, globalCaptureMode: "all" }} assets={connectedAssets} logs={[]} />);

    fireEvent.click(screen.getByLabelText("Controle Mestre de Captura Meta Lead Ads"));
    fireEvent.click(screen.getByRole("option", { name: /Capturar apenas selecionados/i }));

    await waitFor(() => expect(setGlobalModeMock).toHaveBeenCalledWith({ mode: "selective" }));
    expect(screen.getByText(/Modo seletivo/i)).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });
});
