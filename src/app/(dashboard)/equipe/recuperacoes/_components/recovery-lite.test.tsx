// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  approveResetAction: vi.fn(async () => ({ success: true, message: "Solicitação aprovada!" })),
  rejectResetAction: vi.fn(async () => ({ success: true, message: "Solicitação rejeitada com justificativa." })),
}));
vi.mock("../actions", () => actions);
vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { RecoveryLite, type RecoveryLiteRequest } from "./recovery-lite";

afterEach(cleanup);

const base = { userId: "u", directorNotes: null, reviewedAt: null };
const requests: RecoveryLiteRequest[] = [
  // 22:30 em Brasília do dia 24 (já dia 25 em UTC).
  { ...base, id: "r1", userName: "Ana Souza", userEmail: "ana@x.com", status: "requested", createdAt: "2026-10-25T01:30:00.000Z" },
  { ...base, id: "r2", userName: "Bruno Lima", userEmail: "bruno@x.com", status: "rejected", createdAt: "2026-10-20T12:00:00.000Z", reviewedAt: "2026-10-20T13:00:00.000Z", directorNotes: "Procurar o RH" },
  { ...base, id: "r3", userName: "Carla Dias", userEmail: "carla@x.com", status: "approved", createdAt: "2026-10-19T12:00:00.000Z", reviewedAt: "2026-10-19T12:30:00.000Z" },
];

const table = () => document.querySelector('[data-lite="table"]') as HTMLElement;

describe("RecoveryLite", () => {
  it("lista com data de Brasília, busca por e-mail e filtro por status", () => {
    render(<RecoveryLite requests={requests} />);
    expect(within(table()).getByText("24/10/2026, 22:30")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar solicitações" }), { target: { value: "bruno@" } });
    expect(table().querySelectorAll("tbody tr")).toHaveLength(1);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar solicitações" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Pendentes/ }));
    expect(table().querySelectorAll("tbody tr")).toHaveLength(1);
  });

  it("aprova pela mesma Server Action, sem confirmação", async () => {
    render(<RecoveryLite requests={requests} />);
    await act(async () => { fireEvent.click(within(table()).getByRole("button", { name: /Aprovar/ })); });
    const data = (actions.approveResetAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(data.get("requestId")).toBe("r1");
  });

  it("rejeita com justificativa na confirmação Lite e mostra a justificativa salva", async () => {
    render(<RecoveryLite requests={requests} />);
    fireEvent.click(within(table()).getByRole("button", { name: "Rejeitar a solicitação de Ana Souza" }));
    const dialog = screen.getByRole("alertdialog", { name: "Rejeitar solicitação" });
    fireEvent.change(within(dialog).getByLabelText("Justificativa (opcional)"), { target: { value: "Ir ao RH" } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Rejeitar solicitação" })); });
    const data = (actions.rejectResetAction.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(data.get("requestId")).toBe("r1");
    expect(data.get("reason")).toBe("Ir ao RH");
    fireEvent.click(within(table()).getByRole("button", { name: "Ver justificativa de Bruno Lima" }));
    expect(screen.getByText("Procurar o RH")).toBeInTheDocument();
  });
});
