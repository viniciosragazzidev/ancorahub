// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refreshMock, setGlobalModeMock, toggleCampaignMock, toggleAdMock, toggleFormMock, batchEligibilityMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  setGlobalModeMock: vi.fn(),
  toggleCampaignMock: vi.fn(),
  toggleAdMock: vi.fn(),
  toggleFormMock: vi.fn(),
  batchEligibilityMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock("../actions", () => ({
  toggleMetaCampaignCaptureEligibilityAction: toggleCampaignMock,
  toggleMetaAdCaptureEligibilityAction: toggleAdMock,
  toggleMetaFormCaptureEligibilityAction: toggleFormMock,
  batchSetMetaCaptureEligibilityAction: batchEligibilityMock,
  setMetaGlobalCaptureModeAction: setGlobalModeMock,
}));

import { MetaAssetCaptureCard, MetaMasterCaptureControl } from "./meta-capture-controls";

const assets = {
  pages: [{ id: "page-1", name: "Âncora Saúde", status: "active" }],
  adAccounts: [],
  pixels: [],
  datasets: [],
  leadForms: [{ id: "form-1", name: "Formulário principal", status: "ACTIVE", pageId: "page-1" }],
  campaigns: [{ id: "campaign-1", name: "Campanha de saúde", status: "ACTIVE", adAccountId: "act_1" }],
  ads: [{ id: "ad-1", name: "Anúncio principal", status: "ACTIVE", adSetId: "adset-1", campaignId: "campaign-1" }],
};

afterEach(() => {
  cleanup();
  refreshMock.mockClear();
  setGlobalModeMock.mockReset();
  toggleCampaignMock.mockReset();
  toggleAdMock.mockReset();
  toggleFormMock.mockReset();
  batchEligibilityMock.mockReset();
});

describe("MetaAssetCaptureCard", () => {
  it("offers forms, ads and campaigns as independent tabs", () => {
    render(<MetaAssetCaptureCard canConfigure assets={assets} />);
    expect(screen.getByRole("tab", { name: /Formulários \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Anúncios \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Campanhas em lote \(1\)/ })).toBeInTheDocument();
    expect(screen.getByText("Formulário principal")).toBeInTheDocument();
  });

  it("updates campaign eligibility locally and refreshes the route tree", async () => {
    toggleCampaignMock.mockResolvedValue({ success: true });
    render(<MetaAssetCaptureCard canConfigure assets={assets} />);

    fireEvent.click(screen.getByRole("tab", { name: /Campanhas em lote/ }));
    fireEvent.click(within(screen.getByRole("region", { name: "Campanhas & Captura CRM" })).getByRole("button", { name: "Tornar Elegível" }));

    await waitFor(() => expect(toggleCampaignMock).toHaveBeenCalledWith({ campaignId: "campaign-1", enabled: true }), { timeout: 5000 });
    expect(await screen.findByText("Elegível para captura", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("does not let a viewer change capture", () => {
    render(<MetaAssetCaptureCard canConfigure={false} assets={assets} />);
    fireEvent.click(screen.getByRole("tab", { name: /Campanhas em lote/ }));
    expect(within(screen.getByRole("region", { name: "Campanhas & Captura CRM" })).getByRole("button", { name: "Tornar Elegível" })).toBeDisabled();
  });
});

describe("MetaMasterCaptureControl", () => {
  it("updates the master capture mode locally and refreshes the route tree", async () => {
    setGlobalModeMock.mockResolvedValue({ success: true });
    render(<MetaMasterCaptureControl canConfigure globalMode="all" />);

    fireEvent.click(screen.getByLabelText("Controle Mestre de Captura Meta Lead Ads"));
    fireEvent.click(screen.getByRole("option", { name: /Capturar apenas selecionados/i }));

    await waitFor(() => expect(setGlobalModeMock).toHaveBeenCalledWith({ mode: "selective" }), { timeout: 5000 });
    expect(await screen.findByText(/Modo seletivo/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });
});
