// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/leads/closing-outcome-actions", () => ({ holdClosingOutcomeAction: vi.fn(async () => ({ ok: true, message: "Anotado." })) }));

import { ClosingOutcomeCard } from "./closing-outcome-card";
import type { LightLeadDetailData } from "./types";

const lead: LightLeadDetailData = {
  id: "lead-1", nome: "Cliente Exemplo", telefone: null, email: null, status: "under_analysis", isCurrentBroker: true,
  createdAt: "2026-10-01T12:00:00Z", closingOutcome: { pending: true, daysInClosing: 23, heldUntil: null },
};

function controller(leadStatus = "under_analysis") {
  return {
    leadStatus,
    setShowSaleConfirm: vi.fn(),
    setSelectedStep: vi.fn(),
    setObservation: vi.fn(),
    setRegressionJustification: vi.fn(),
    setShowUpdateSheet: vi.fn(),
  };
}

afterEach(cleanup);

describe("desfecho pendente no lead do corretor", () => {
  it("pergunta o desfecho e abre a venda ou a perda com motivo", () => {
    const c = controller();
    render(<ClosingOutcomeCard lead={lead} c={c} />);
    expect(screen.getByText("Desfecho pendente")).toBeTruthy();
    expect(screen.getByText(/23 dias no fechamento/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechou" }));
    expect(c.setShowSaleConfirm).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "Perdeu" }));
    expect(c.setSelectedStep).toHaveBeenCalledWith("no_interest");
    expect(c.setShowUpdateSheet).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Continua em análise" })).toBeTruthy();
  });

  it.each([
    { name: "não pendente", data: { ...lead, closingOutcome: { pending: false, daysInClosing: 3, heldUntil: null } }, status: "under_analysis" },
    { name: "de outro corretor", data: { ...lead, isCurrentBroker: false }, status: "under_analysis" },
    { name: "já saiu do fechamento", data: lead, status: "converted" },
  ])("não aparece quando o lead está $name", ({ data, status }) => {
    render(<ClosingOutcomeCard lead={data} c={controller(status)} />);
    expect(screen.queryByText("Desfecho pendente")).toBeNull();
  });
});
