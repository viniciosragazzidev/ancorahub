// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refreshMock, confirmMock, getAssetsMock, trackMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  confirmMock: vi.fn(),
  getAssetsMock: vi.fn(),
  trackMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock("../actions", () => ({
  confirmMetaConnection: confirmMock,
  disconnectMetaConnection: vi.fn(),
  getMetaMarketingAttemptAssets: getAssetsMock,
  recordMetaMarketingOnboardingStep: trackMock,
  triggerManualMetaSync: vi.fn(),
}));

import { MetaMarketingWizard } from "./meta-marketing-wizard";

const assets = {
  business: { id: "business-1", name: "Âncora Hub" },
  pages: [{ id: "page-1", name: "Âncora Saúde" }],
  adAccounts: [{ id: "act_1", name: "Conta principal", currency: "BRL", accountStatus: 1 }],
  pixels: [],
  datasets: [],
  whatsapp: null,
};

afterEach(() => {
  cleanup();
  refreshMock.mockClear();
  confirmMock.mockReset();
  getAssetsMock.mockReset();
  trackMock.mockClear();
});

describe("MetaMarketingWizard", () => {
  it("walks through intro, authorize, review and done", async () => {
    getAssetsMock.mockResolvedValue(assets);
    confirmMock.mockResolvedValue({ success: true });

    render(<MetaMarketingWizard onClose={vi.fn()} />);

    // Passo 1 — intro educativa
    expect(screen.getByRole("heading", { name: "Conectar Marketing da Meta" })).toBeInTheDocument();
    expect(screen.getByText("Páginas e campanhas")).toBeInTheDocument();
    expect(screen.getByText("Formulários e leads")).toBeInTheDocument();

    // Passo 2 — autorização
    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    expect(screen.getByRole("button", { name: "Continuar com Facebook" })).toBeInTheDocument();

    // Sucesso do popup OAuth → Passo 3 — revisão de ativos
    window.dispatchEvent(new MessageEvent("message", {
      data: { type: "META_MARKETING_AUTH_SUCCESS", attemptId: "attempt-1" },
      origin: window.location.origin,
    }));
    await waitFor(() => expect(screen.getByText("Âncora Hub")).toBeInTheDocument());
    expect(screen.getByText("Páginas (1)")).toBeInTheDocument();
    expect(screen.getByText("Contas de anúncios (1)")).toBeInTheDocument();

    // Confirmar → Passo 4 conectando → Passo 5 concluído
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e conectar" }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ attemptId: "attempt-1", businessId: "business-1" }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(screen.getByText("Marketing da Meta conectado!")).toBeInTheDocument();
    expect(screen.getByText("Próximos passos")).toBeInTheDocument();
  });

  it("shows an inline error and returns to review when confirmation fails", async () => {
    getAssetsMock.mockResolvedValue(assets);
    confirmMock.mockRejectedValue(new Error("Um ativo não pertence à autorização."));

    render(<MetaMarketingWizard onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    window.dispatchEvent(new MessageEvent("message", {
      data: { type: "META_MARKETING_AUTH_SUCCESS", attemptId: "attempt-2" },
      origin: window.location.origin,
    }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar e conectar" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Confirmar e conectar" }));
    await waitFor(() => expect(screen.getByText("Um ativo não pertence à autorização.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Confirmar e conectar" })).toBeInTheDocument();
  });
});
