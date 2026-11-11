// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/carteira/retorno-actions", () => ({
  agendarRetornoAction: vi.fn(async () => ({ ok: true })),
  reagendarRetornoAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/features/leads/task-actions", () => ({ setLeadTaskDoneAction: vi.fn(async () => ({ success: true })) }));
vi.mock("@/components/arc/bottom-sheet/bottom-sheet", () => ({
  BottomSheet: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
}));

import { instantToSaoPauloInput, LightNextActionPanel, localInputToSaoPauloIso } from "./light-client-next-action";

afterEach(() => cleanup());

describe("horário de São Paulo no retorno", () => {
  it("envia o campo local com o fuso fixo de São Paulo", () => {
    expect(localInputToSaoPauloIso("2026-11-12T10:30")).toBe("2026-11-12T10:30:00-03:00");
    expect(localInputToSaoPauloIso("12/11/2026 10:30")).toBeNull();
    expect(localInputToSaoPauloIso("")).toBeNull();
  });

  it("pré-preenche o reagendamento no horário de São Paulo", () => {
    expect(instantToSaoPauloInput("2026-11-12T13:30:00.000Z")).toBe("2026-11-12T10:30");
  });
});

describe("próxima ação do corretor", () => {
  it("sem retorno: diz que não há retorno, sem prometer em dia, e oferece agendar", () => {
    render(<LightNextActionPanel clientId="c1" leadId="l1" nextAction={{ state: "none", taskId: null, title: null, dueAt: null, reason: "Nenhum retorno agendado para este cliente." }} />);
    expect(screen.getByText("Nenhum retorno agendado para este cliente.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Agendar retorno" })).toBeTruthy();
    expect(screen.queryByText(/em dia/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Já falei" })).toBeNull();
  });

  it("retorno atrasado oferece concluir e reagendar", () => {
    render(<LightNextActionPanel clientId="c1" leadId="l1" nextAction={{ state: "overdue", taskId: "t1", title: "Retorno", dueAt: "2026-11-10T15:00:00.000Z", reason: "Retorno atrasado há 1 dia." }} />);
    expect(screen.getByRole("button", { name: "Já falei" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reagendar" })).toBeTruthy();
  });

  it("falha ao carregar mostra erro e tentar de novo, não 'sem retorno'", () => {
    render(<LightNextActionPanel clientId="c1" leadId="l1" nextAction={null} />);
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível carregar");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeTruthy();
    expect(screen.queryByText(/Nenhum retorno/)).toBeNull();
  });
});
