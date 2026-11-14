// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SaleSection } from "./sale-section";
import type { LeadDetailController } from "./use-lead-detail";

afterEach(cleanup);

const controller = (leadStatus: string) =>
  ({
    isDistributed: false,
    leadStatus,
    whatsappOpenedAt: null,
    approvedDocument: null,
    rejectedDocument: null,
    requestingSale: false,
    handleRequestSale: vi.fn(),
    setShowSaleConfirm: vi.fn(),
  }) as unknown as LeadDetailController;

describe("SaleSection: confirmação no próprio lugar", () => {
  it("mostra o check de Venda registrada depois do registro", () => {
    render(<SaleSection c={controller("converted")} registrationV2Enabled justRegistered />);
    expect(screen.getByRole("status")).toHaveTextContent("Venda registrada");
  });

  it("não mostra confirmação enquanto a venda não foi registrada (erro ou fluxo aberto)", () => {
    render(<SaleSection c={controller("in_progress")} registrationV2Enabled />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Registrar venda" })).toBeInTheDocument();
  });

  it("não confirma na visão de gestão", () => {
    render(<SaleSection c={controller("converted")} mode="management" justRegistered />);
    expect(screen.queryByRole("status")).toBeNull();
  });
});
