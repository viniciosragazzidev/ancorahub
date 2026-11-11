// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("../../broker-brief-actions", () => ({ saveCampaignBrokerOfferAction: mocks.save }));

import { CampaignBrokerOfferLite } from "./campaign-broker-offer-lite";

afterEach(() => {
  cleanup();
  mocks.save.mockReset();
});

describe("plano anunciado da campanha", () => {
  it("salva o texto da gestão pela campanha", async () => {
    mocks.save.mockResolvedValue({ success: true, offer: "Amil custo-benefício a partir de R$ 89" });
    render(<CampaignBrokerOfferLite campaignId="120200000000000009" initialOffer={null} canEdit />);
    const save = screen.getByRole("button", { name: "Salvar plano anunciado" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Plano anunciado"), { target: { value: "Amil custo-benefício a partir de R$ 89" } });
    fireEvent.click(save);
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ campaignId: "120200000000000009", offer: "Amil custo-benefício a partir de R$ 89" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("quem não edita só lê o texto", () => {
    render(<CampaignBrokerOfferLite campaignId="1" initialOffer="Bradesco PME" canEdit={false} />);
    expect(screen.getByText("Bradesco PME")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
