// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const hold = vi.hoisted(() => vi.fn(async (): Promise<{ ok: true; message: string } | { ok: false; reason: string }> => ({ ok: true, message: "Anotado." })));
vi.mock("@/features/leads/closing-outcome-actions", () => ({ holdClosingOutcomeAction: hold }));
vi.mock("@/lib/feedback/use-feedback", () => ({ useFeedback: () => () => ({ celebrate: false }) }));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({ BottomSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null) }));
vi.mock("@/components/arc/date-picker/date-picker", () => ({ DatePicker: ({ onChange }: { onChange: (date: Date) => void }) => <button type="button" onClick={() => onChange(new Date(2026, 11, 20, 12))}>Escolher data</button> }));

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

  it("segurar o fechamento: salvando, confirmado só depois do servidor e a resposta dele", async () => {
    render(<ClosingOutcomeCard lead={lead} c={controller()} />);
    fireEvent.click(screen.getByRole("button", { name: "Continua em análise" }));
    expect(screen.getByRole("button", { name: "Salvar data prevista" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Escolher data" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar data prevista" }));
    expect(hold).toHaveBeenCalledWith({ leadId: "lead-1", expectedDate: "2026-12-20" });
    expect(await screen.findByText("Anotado.")).toBeTruthy();
    expect(screen.getAllByText("Data prevista salva").length).toBeGreaterThan(0);
  });

  it("falha mostra a causa e o que continua valendo", async () => {
    hold.mockResolvedValueOnce({ ok: false, reason: "Este lead não está mais no fechamento." });
    render(<ClosingOutcomeCard lead={lead} c={controller()} />);
    fireEvent.click(screen.getByRole("button", { name: "Continua em análise" }));
    fireEvent.click(screen.getByRole("button", { name: "Escolher data" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar data prevista" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Este lead não está mais no fechamento. O lead continua pendente.");
  });
});
