// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({ BottomSheet: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div role="dialog">{children}</div> : null) }));

import { DeclineSheet } from "./decline-sheet";
import type { LightLeadDetailData } from "./types";
import type { LeadDetailController } from "./use-lead-detail";

afterEach(cleanup);

const lead = { id: "lead-1", nome: "Cliente Exemplo", telefone: null, email: null, status: "distributed", isCurrentBroker: true, createdAt: "2026-11-14T12:00:00Z" } as LightLeadDetailData;

function controller(overrides: Partial<LeadDetailController> = {}) {
  return {
    showDeclineModal: true,
    setShowDeclineModal: vi.fn(),
    declineReason: "Fora da minha região",
    setDeclineReason: vi.fn(),
    declining: false,
    declined: false,
    declineError: null,
    handleConfirmDecline: vi.fn(),
    ...overrides,
  } as unknown as LeadDetailController;
}

describe("DeclineSheet: recusar é nível 1, sem toast", () => {
  it("confirma na própria folha depois do servidor", () => {
    render(<DeclineSheet lead={lead} c={controller({ declined: true })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Lead devolvido");
    expect(screen.queryByRole("button", { name: "Recusar lead" })).toBeNull();
  });

  it("falha mostra a causa e volta como Tentar de novo", () => {
    const c = controller({ declineError: "Não deu para devolver o lead agora. O lead continua com você." });
    render(<DeclineSheet lead={lead} c={c} />);
    expect(screen.getByRole("alert")).toHaveTextContent("O lead continua com você.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(c.handleConfirmDecline).toHaveBeenCalled();
  });
});
