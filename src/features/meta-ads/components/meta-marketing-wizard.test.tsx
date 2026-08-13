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
  business: { id: "business-1", name: "Ancora Hub" },
  pages: [{ id: "page-1", name: "Pagina escolhida" }, { id: "page-2", name: "Outra pagina" }],
  adAccounts: [
    { id: "act_1", name: "Conta escolhida", currency: "BRL", accountStatus: 1 },
    { id: "act_2", name: "Outra conta", currency: "BRL", accountStatus: 1 },
  ],
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

function resolveAuthorization(attemptId = "attempt-1") {
  window.dispatchEvent(new MessageEvent("message", {
    data: { type: "META_MARKETING_AUTH_SUCCESS", attemptId },
    origin: window.location.origin,
  }));
}

describe("MetaMarketingWizard", () => {
  it("walks through authorization and explicitly confirms assets", async () => {
    getAssetsMock.mockResolvedValue(assets);
    confirmMock.mockResolvedValue({ success: true });
    render(<MetaMarketingWizard onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    resolveAuthorization();
    await waitFor(() => expect(screen.getByText("Ancora Hub")).toBeInTheDocument());
    expect(screen.getByLabelText("Pagina escolhida")).not.toBeChecked();
    expect(screen.getByLabelText("Conta escolhida")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Confirmar e conectar" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Pagina escolhida"));
    fireEvent.click(screen.getByLabelText("Conta escolhida"));

    fireEvent.click(screen.getByRole("button", { name: "Confirmar e conectar" }));
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1));
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ attemptId: "attempt-1", businessId: "business-1" }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("persists only the Meta assets explicitly selected by the user", async () => {
    getAssetsMock.mockResolvedValue(assets);
    confirmMock.mockResolvedValue({ success: true });
    render(<MetaMarketingWizard onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    resolveAuthorization("attempt-2");
    await waitFor(() => expect(screen.getByLabelText("Outra pagina")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Pagina escolhida"));
    await waitFor(() => expect(screen.getByLabelText("Pagina escolhida")).toBeChecked());
    fireEvent.click(screen.getByLabelText("Conta escolhida"));
    await waitFor(() => expect(screen.getByLabelText("Conta escolhida")).toBeChecked());
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e conectar" }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({
      pages: [{ id: "page-1", name: "Pagina escolhida" }],
      adAccounts: [{ id: "act_1", name: "Conta escolhida", currency: "BRL" }],
    })));
  });

  it("returns to review with an inline confirmation error", async () => {
    getAssetsMock.mockResolvedValue(assets);
    confirmMock.mockRejectedValue(new Error("Ativo não autorizado."));
    render(<MetaMarketingWizard onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Começar" }));
    resolveAuthorization("attempt-3");
    await waitFor(() => expect(screen.getByRole("button", { name: "Confirmar e conectar" })).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Pagina escolhida"));
    await waitFor(() => expect(screen.getByLabelText("Pagina escolhida")).toBeChecked());
    fireEvent.click(screen.getByRole("button", { name: "Confirmar e conectar" }));
    await waitFor(() => expect(screen.getByText("Ativo não autorizado.")).toBeInTheDocument());
  });
});
