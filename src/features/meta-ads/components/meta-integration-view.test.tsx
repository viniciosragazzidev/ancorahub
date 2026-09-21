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
  ads: [{ id: "ad-1", name: "Anúncio principal", status: "ACTIVE", adSetId: "adset-1", campaignId: "campaign-1" }],
};

afterEach(() => {
  cleanup(); refreshMock.mockClear(); disconnectMock.mockReset(); syncMock.mockReset(); setGlobalModeMock.mockReset(); toggleCampaignMock.mockReset(); toggleAdMock.mockReset(); toggleFormMock.mockReset(); batchEligibilityMock.mockReset(); toastSuccessMock.mockClear(); toastWarningMock.mockClear(); toastErrorMock.mockClear();
});

describe("MetaIntegrationView", () => {
  it("paginates asset lists with up to 15 items per page", () => {
    const manyPages = Array.from({ length: 17 }, (_, index) => ({ id: `page-${index + 1}`, name: `Página ${String(index + 1).padStart(2, "0")}`, status: "active" }));
    render(<MetaIntegrationView canConfigure={false} connection={connectedConnection} assets={{ ...connectedAssets, pages: manyPages }} logs={[]} />);
    const pagesList = screen.getByText("Páginas conectadas").closest("div.rounded-lg");
    expect(pagesList).not.toBeNull();
    expect(within(pagesList as HTMLElement).getByText("Página 01")).toBeInTheDocument();
    expect(within(pagesList as HTMLElement).getByText("Página 15")).toBeInTheDocument();
    expect(within(pagesList as HTMLElement).queryByText("Página 16")).not.toBeInTheDocument();
    expect(within(pagesList as HTMLElement).getByText("1–15 de 17")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(within(pagesList as HTMLElement).getByText("Página 16")).toBeInTheDocument();
    expect(within(pagesList as HTMLElement).queryByText("Página 01")).not.toBeInTheDocument();
    expect(within(pagesList as HTMLElement).getByText("16–17 de 17")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(within(pagesList as HTMLElement).getByText("Página 01")).toBeInTheDocument();
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
    expect(screen.getByText("Ativos conectados")).toBeInTheDocument();
    expect(screen.getByText("Âncora Hub")).toBeInTheDocument();
    expect(screen.getAllByText("Âncora Saúde").length).toBeGreaterThan(0);
    expect(screen.getByText("Pixel principal")).toBeInTheDocument();
    // O mapa de aquisição (campanha › anúncio › formulário) só entra no DOM quando aberto.
    expect(screen.queryByText("Campanha de saúde")).not.toBeInTheDocument();
    const map = screen.getByText("Mapa de aquisição").closest("details") as HTMLDetailsElement;
    map.open = true;
    fireEvent(map, new Event("toggle"));
    expect(screen.getAllByText("Formulário principal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Campanha de saúde").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Anúncio principal").length).toBeGreaterThan(0);
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

  it("shows one sync badge instead of a list of recent syncs", () => {
    const now = Date.now();
    const logs = [
      { id: "l1", syncType: "full", status: "error", itemsSynced: 0, durationMs: 1000, startedAt: new Date(now - 3 * 3600_000), completedAt: new Date(now - 3 * 3600_000 + 1000), errorDetails: "boom" },
      { id: "l2", syncType: "full", status: "success", itemsSynced: 12, durationMs: 60000, startedAt: new Date(now - 5 * 60_000), completedAt: new Date(now - 4 * 60_000), errorDetails: null },
    ];
    render(<MetaIntegrationView canConfigure connection={connectedConnection} assets={connectedAssets} logs={logs} />);
    expect(screen.queryByText("Sincronizações recentes")).not.toBeInTheDocument();
    const badges = document.querySelectorAll("[data-slot=\"meta-sync-badge\"]");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("Última sincronização: Concluída");
  });

  it("says when the Meta was never synchronized", () => {
    render(<MetaIntegrationView canConfigure connection={connectedConnection} assets={connectedAssets} logs={[]} />);
    expect(screen.getByText("Última sincronização: Nunca sincronizada")).toBeInTheDocument();
  });

  it("does not render the sync badge before the Meta is connected", () => {
    render(<MetaIntegrationView connection={null} assets={null} logs={[]} />);
    expect(document.querySelector("[data-slot=\"meta-sync-badge\"]")).toBeNull();
  });

  it("reads the capture mode and links to Campanhas, without offering any capture control", () => {
    render(<MetaIntegrationView canConfigure connection={{ ...connectedConnection, globalCaptureMode: "all" }} assets={connectedAssets} logs={[]} />);
    expect(document.querySelector("[data-slot=\"capture-mode\"]")).toHaveTextContent("Captura em todos os ativos");
    expect(screen.getByRole("link", { name: /Gerenciar captura e filas/ })).toHaveAttribute("href", "/marketing/campanhas");
    expect(screen.queryByLabelText("Controle Mestre de Captura Meta Lead Ads")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tornar Elegível" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pausar Todos os Leads" })).not.toBeInTheDocument();
  });

  it("counts the synchronized forms next to campaigns and ads", () => {
    render(<MetaIntegrationView canConfigure connection={connectedConnection} assets={connectedAssets} logs={[]} />);
    expect(screen.getByText("Formulários sincronizados").nextElementSibling).toHaveTextContent("1");
  });
});
